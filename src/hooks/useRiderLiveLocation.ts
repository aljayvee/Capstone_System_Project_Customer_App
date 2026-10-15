import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import type { Socket } from 'socket.io-client';
import { database } from '../firebase/config';
import { getSocket } from '../services/socketClient';
import { MapCoordinate } from '../utils/coords';
import {
  classifyFreshness,
  freshnessLabel,
  SIGNAL_LOST_THRESHOLD_MS,
  type PositionFreshness,
} from '../constants/tracking';

export interface RiderLiveLocation extends MapCoordinate {
  heading: number | null;
  updatedAt: number;
}

export interface RiderLiveLocationState {
  /** Last position received. Retained even once stale — see `freshness`. */
  location: RiderLiveLocation | null;
  freshness: PositionFreshness;
  ageMs: number;
  /** Customer-facing explanation, or null while the feed is live. */
  label: string | null;
}

/** The server's `rider:location` event (riderLocationBroadcast.ts). */
interface SocketRiderLocation {
  riderId: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  recordedAt: number;
}

// How often the age is re-evaluated. Firebase only pushes on change, so without
// this a pin that stopped updating would keep claiming to be live forever.
const FRESHNESS_TICK_MS = 5000;

// A refused listen is retried a few times, then left to the socket feed. Since
// 2026-10-07 a customer may read a rider only while that rider works their
// errand (server lib/riderWatch.ts writes who may), and a map that opens a
// moment before the grant lands would otherwise stay empty: Firebase does not
// retry a refused listen by itself.
const LISTEN_RETRY_MS = 4000;
const LISTEN_RETRIES = 5;

/**
 * Subscribes to a rider's live position at `riders/{riderId}` — this project's
 * documented Firebase RTDB convention (see AGENTS.md) for rider GPS, written by
 * RiderMobileApp's location broadcast.
 *
 * Returns the last known position together with how old it is, rather than the
 * raw coordinate alone. That distinction is the point: this hook previously
 * returned a bare coordinate with no notion of age, so a rider whose phone died
 * twenty minutes ago still rendered as a confident "Live GPS" pin. A frozen pin
 * presented as live is worse than an honest "weak signal here" — the customer
 * makes decisions based on it.
 */
export function useRiderLiveLocation(
  riderId: number | null | undefined,
  /**
   * ADDITIVE, 2026-09-23. The errand being tracked, so a (re)connecting socket
   * can ask for the rider's last known position at once instead of showing
   * nothing until the next fix. Optional: without it the socket feed still
   * runs, it just starts empty.
   */
  errandId?: string | null
): RiderLiveLocationState {
  const [location, setLocation] = useState<RiderLiveLocation | null>(null);
  // The second feed: the server's `rider:location` over Socket.IO. RTDB and
  // the socket are independent paths from the rider's phone, and on a weak
  // signal one is often stuck while the other still delivers, so the newer of
  // the two is shown.
  const [socketLocation, setSocketLocation] = useState<RiderLiveLocation | null>(null);
  // Set when the server says this rider stopped reporting (their one-second
  // heartbeat stopped, or they went offline). Cleared by the rider coming back,
  // or by any position newer than the moment it was set.
  const [statusLostAt, setStatusLostAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [listenAttempt, setListenAttempt] = useState(0);

  // A different rider starts with a full set of retries.
  useEffect(() => setListenAttempt(0), [riderId]);

  useEffect(() => {
    if (!riderId) {
      setSocketLocation(null);
      return;
    }

    let disposed = false;
    let socket: Socket | null = null;

    const accept = (fix: SocketRiderLocation | null | undefined) => {
      if (disposed || !fix || Number(fix.riderId) !== Number(riderId)) return;
      if (typeof fix.latitude !== 'number' || typeof fix.longitude !== 'number') return;
      const recordedAt = typeof fix.recordedAt === 'number' ? fix.recordedAt : Date.now();
      // Never let a late-arriving fix drag the pin backwards.
      setSocketLocation((prev) =>
        prev && prev.updatedAt >= recordedAt
          ? prev
          : {
              latitude: fix.latitude,
              longitude: fix.longitude,
              heading: typeof fix.heading === 'number' ? fix.heading : null,
              updatedAt: recordedAt,
            }
      );
    };

    // The server knows within about three seconds when the rider's phone stops
    // reporting. Without this, the card only said so once no position had
    // arrived for a full minute.
    const onStatus = (event: { riderId?: number; riderStatus?: string } | null | undefined) => {
      if (disposed || !event || Number(event.riderId) !== Number(riderId)) return;
      setStatusLostAt(event.riderStatus === 'AVAILABLE_ONLINE' ? null : Date.now());
    };

    const requestLast = () => {
      if (!errandId || !socket) return;
      socket.emit('rider:last_location', errandId, (reply?: { ok?: boolean; location?: SocketRiderLocation | null }) => {
        if (reply?.ok && reply.location) accept(reply.location);
      });
    };

    void getSocket()
      .then((s) => {
        if (disposed) return;
        socket = s;
        // Delivered to this customer's own room, which the socket joins when it
        // authenticates, for as long as the rider is working their errand.
        s.on('rider:location', accept);
        s.on('rider:status_changed', onStatus);
        s.on('connect', requestLast);
        if (s.connected) requestLast();
      })
      // No socket means RTDB alone, which is how this hook always worked.
      .catch(() => {});

    return () => {
      disposed = true;
      socket?.off('rider:location', accept);
      socket?.off('rider:status_changed', onStatus);
      setStatusLostAt(null);
      socket?.off('connect', requestLast);
      setSocketLocation(null);
    };
  }, [riderId, errandId]);

  useEffect(() => {
    if (!riderId) {
      setLocation(null);
      return;
    }

    let retry: ReturnType<typeof setTimeout> | null = null;
    const locationRef = ref(database, `riders/${riderId}`);
    const unsubscribe = onValue(
      locationRef,
      (snapshot) => {
        const val = snapshot.val();
        if (!val || typeof val.latitude !== 'number' || typeof val.longitude !== 'number') {
          setLocation(null);
          return;
        }
        setLocation({
          latitude: val.latitude,
          longitude: val.longitude,
          heading: typeof val.heading === 'number' ? val.heading : null,
          updatedAt: typeof val.updatedAt === 'number' ? val.updatedAt : Date.now(),
        });
      },
      () => {
        if (listenAttempt >= LISTEN_RETRIES) return;
        retry = setTimeout(() => setListenAttempt((n) => n + 1), LISTEN_RETRY_MS);
      }
    );

    return () => {
      if (retry) clearTimeout(retry);
      unsubscribe();
      setLocation(null);
    };
  }, [riderId, listenAttempt]);

  const newest: RiderLiveLocation | null =
    location && socketLocation
      ? socketLocation.updatedAt > location.updatedAt
        ? socketLocation
        : location
      : location ?? socketLocation;

  // Ages the position even when no new data arrives.
  useEffect(() => {
    if (!newest) return;
    const timer = setInterval(() => setNow(Date.now()), FRESHNESS_TICK_MS);
    return () => clearInterval(timer);
  }, [newest]);

  return useMemo(() => {
    if (!newest) {
      return { location: null, freshness: 'LOST' as const, ageMs: 0, label: null };
    }
    const ageMs = Math.max(0, now - newest.updatedAt);
    // A position that arrived after the "lost" news is newer news: the rider
    // is evidently back, even if the "online" event has not landed yet.
    if (statusLostAt !== null && newest.updatedAt < statusLostAt) {
      return { location: newest, freshness: 'LOST' as const, ageMs, label: freshnessLabel('LOST', ageMs) };
    }
    const freshness = classifyFreshness(newest.updatedAt, now);
    return { location: newest, freshness, ageMs, label: freshnessLabel(freshness, ageMs) };
  }, [newest, now, statusLostAt]);
}

export { SIGNAL_LOST_THRESHOLD_MS };
