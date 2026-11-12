import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { apiClient } from '../services/apiClient';
import { getSocket } from '../services/socketClient';
import type { MapCoordinate } from '../utils/coords';

/**
 * The line the rider is following to this customer's door, as Sugo Rider was
 * given it (server services/riderRouteService.ts).
 *
 * The Track map used to calculate a line of its own, again every 30 seconds
 * and on every ~11 m the rider moved. When the rider bypassed the route, their
 * phone said "Recalculating" and this map quietly drew some other road. Now,
 * while the rider is heading to the door, it draws the rider's own line and
 * changes it only when the rider's does.
 *
 * Null while there is none to show: the rider is still shopping, has not been
 * given a route since the server restarted, or has wandered well away from it.
 * The map then falls back to calculating a line itself, as before.
 */
export interface RiderLine {
  /** Rises with every new line. */
  version: number;
  coordinates: MapCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  /** Whose roads the line follows: "osrm" or "google". */
  lineEngine: string;
  /** When the rider last left a route to this door and was given a new one, epoch ms. */
  reroutedAt: number | null;
}

/** The `rider:route` notice: a new line exists. */
interface RiderRouteNotice {
  version?: number;
  errandIds?: string[];
}

/**
 * Asked again this often even when no notice arrives. A notice can be missed
 * on a weak signal, and the server forgets lines when it restarts. Cheap: an
 * unchanged line is answered with `unchanged`, not resent.
 */
export const RIDER_LINE_POLL_MS = 30_000;

function toLine(raw: any): RiderLine | null {
  if (!raw || !Array.isArray(raw.coordinates)) return null;
  const coordinates: MapCoordinate[] = raw.coordinates
    .map((point: any) => ({ latitude: Number(point?.latitude), longitude: Number(point?.longitude) }))
    .filter((point: MapCoordinate) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (coordinates.length < 2) return null;
  return {
    version: Number(raw.version) || 0,
    coordinates,
    distanceMeters: Number(raw.distanceMeters) || 0,
    durationSeconds: Number(raw.durationSeconds) || 0,
    lineEngine: String(raw.lineEngine ?? ''),
    reroutedAt: typeof raw.reroutedAt === 'number' ? raw.reroutedAt : null,
  };
}

export function useRiderLine(errandId: string | null | undefined, enabled: boolean): RiderLine | null {
  const [line, setLine] = useState<RiderLine | null>(null);
  const versionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!errandId || !enabled) {
      versionRef.current = null;
      setLine(null);
      return;
    }

    let disposed = false;
    let inFlight = false;
    let again = false;
    let socket: Socket | null = null;

    const load = () => {
      // One request at a time; a notice that lands meanwhile asks once more.
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      const params: Record<string, string | number> = { errandId };
      if (versionRef.current != null) params.since = versionRef.current;

      apiClient
        .get('/routing/rider-route', { params })
        .then((response) => {
          if (disposed) return;
          const data = response.data ?? {};
          if (data.unchanged) return;
          const next = toLine(data.route);
          versionRef.current = next ? next.version : null;
          setLine(next);
        })
        // A failed read keeps the line on screen: the rider is still on it,
        // as far as anyone knows, and the next poll or notice asks again.
        .catch(() => {})
        .finally(() => {
          inFlight = false;
          if (again && !disposed) {
            again = false;
            load();
          }
        });
    };

    const onNotice = (notice: RiderRouteNotice | null | undefined) => {
      if (!notice?.errandIds?.includes(errandId)) return;
      if (notice.version != null && notice.version === versionRef.current) return;
      load();
    };

    load();
    const poll = setInterval(load, RIDER_LINE_POLL_MS);

    void getSocket()
      .then((s) => {
        if (disposed) return;
        socket = s;
        // Sent to this customer's own room, joined when the socket signs in.
        s.on('rider:route', onNotice);
        // Notices sent while the socket was down are gone; ask on return.
        s.on('connect', load);
      })
      // No socket: the poll alone keeps the line current.
      .catch(() => {});

    return () => {
      disposed = true;
      clearInterval(poll);
      socket?.off('rider:route', onNotice);
      socket?.off('connect', load);
    };
  }, [errandId, enabled]);

  return line;
}
