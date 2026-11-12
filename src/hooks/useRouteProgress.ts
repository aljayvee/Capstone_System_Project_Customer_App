import { useMemo, useRef } from 'react';
import type { MapCoordinate } from '../utils/coords';
import { cumulativeLengths, followRouteProgress, type RouteProgress } from '../utils/routeGeometry';

export interface RouteProgressState {
  /** Metres from the start of the line to where the rider is on it. */
  alongMeters: number;
  /** The whole line's length, in metres. */
  totalMeters: number;
  /** Each vertex's distance from the start, for trimming the line. */
  cumulative: number[];
  /** How far off the line the rider's fix is, in metres. */
  offLineMeters: number;
}

/**
 * How far along a route line the rider is, fix by fix.
 *
 * A route is now kept while the rider follows it, not fetched again every few
 * metres, so the line no longer starts at the rider by itself. This is what the
 * map trims the line with and what the remaining distance is worked out from.
 *
 * Progress is remembered per line (by identity): a new line starts from where
 * the rider is on it, not from where they were on the old one.
 */
export function useRouteProgress(
  line: MapCoordinate[] | null | undefined,
  rider: MapCoordinate | null | undefined
): RouteProgressState | null {
  const cumulative = useMemo(() => (line && line.length > 1 ? cumulativeLengths(line) : null), [line]);
  const lastRef = useRef<{ line: MapCoordinate[]; progress: RouteProgress } | null>(null);

  const latitude = rider?.latitude;
  const longitude = rider?.longitude;

  return useMemo(() => {
    if (!line || !cumulative || latitude == null || longitude == null) {
      lastRef.current = null;
      return null;
    }
    const previous = lastRef.current?.line === line ? lastRef.current.progress : null;
    const progress = followRouteProgress({ latitude, longitude }, line, cumulative, previous);
    if (!progress) return null;
    lastRef.current = { line, progress };
    return {
      alongMeters: progress.alongMeters,
      totalMeters: cumulative[cumulative.length - 1],
      cumulative,
      offLineMeters: progress.projection.distanceMeters,
    };
  }, [line, cumulative, latitude, longitude]);
}
