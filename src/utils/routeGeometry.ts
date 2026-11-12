import type { MapCoordinate } from './coords';

/**
 * Geometry for placing a rider on a route line.
 *
 * The same maths as Sugo Rider's utils/routeGeometry.ts, which the rider's own
 * map trims its line with. Kept in step with it on purpose: the customer's map
 * now draws the rider's line (hooks/useRiderLine.ts), and the two should cut it
 * at the same place.
 *
 * All of it works in a locally-flattened plane: longitude is scaled by
 * cos(latitude) so a degree east covers the same ground as a degree north.
 */

const EARTH_RADIUS_M = 6371000;
const DEG = Math.PI / 180;

export interface PathProjection {
  /** The point on the path closest to the input. */
  point: MapCoordinate;
  /** Index of the segment it landed on (the segment from [index] to [index+1]). */
  segmentIndex: number;
  /** How far along that segment, 0..1. */
  t: number;
  /** Perpendicular distance from the input to the path, in metres. */
  distanceMeters: number;
}

/** Metres between two coordinates. Equirectangular, which is fine at city scale. */
export function metresBetween(a: MapCoordinate, b: MapCoordinate): number {
  const scale = Math.cos(((a.latitude + b.latitude) / 2) * DEG);
  const dx = (b.longitude - a.longitude) * scale * DEG * EARTH_RADIUS_M;
  const dy = (b.latitude - a.latitude) * DEG * EARTH_RADIUS_M;
  return Math.hypot(dx, dy);
}

function lerpCoordinate(a: MapCoordinate, b: MapCoordinate, t: number): MapCoordinate {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

/** The closest point on `path` to `point`. */
export function projectOntoPath(point: MapCoordinate, path: MapCoordinate[]): PathProjection | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return { point: path[0], segmentIndex: 0, t: 0, distanceMeters: metresBetween(point, path[0]) };
  }

  const scale = Math.cos(point.latitude * DEG);
  let best: PathProjection | null = null;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const vx = (b.longitude - a.longitude) * scale;
    const vy = b.latitude - a.latitude;
    const lengthSq = vx * vx + vy * vy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point.longitude - a.longitude) * scale * vx + (point.latitude - a.latitude) * vy) / lengthSq)
          );
    const candidate = lerpCoordinate(a, b, t);
    const distanceMeters = metresBetween(point, candidate);
    if (!best || distanceMeters < best.distanceMeters) {
      best = { point: candidate, segmentIndex: i, t, distanceMeters };
    }
  }

  return best;
}

/** Distance from the start of `path` to each of its vertices, in metres. */
export function cumulativeLengths(path: MapCoordinate[]): number[] {
  const out = new Array<number>(path.length);
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    if (i > 0) total += metresBetween(path[i - 1], path[i]);
    out[i] = total;
  }
  return out;
}

/**
 * The part of `path` from `metres` along it to its end: the line still ahead
 * of the rider.
 */
export function pathFromDistance(path: MapCoordinate[], cumulative: number[], metres: number): MapCoordinate[] {
  if (path.length < 2 || metres <= 0) return path;
  const total = cumulative[cumulative.length - 1];
  // Past the end: nothing left to draw. One point, which no polyline draws.
  if (metres >= total) return [path[path.length - 1]];

  let i = 0;
  while (i < path.length - 2 && cumulative[i + 1] <= metres) i++;
  const segment = cumulative[i + 1] - cumulative[i];
  const t = segment > 0 ? (metres - cumulative[i]) / segment : 0;
  return [lerpCoordinate(path[i], path[i + 1], t), ...path.slice(i + 1)];
}

/** Where the rider is along the route. */
export interface RouteProgress {
  projection: PathProjection;
  /** Metres from the route's start to the projection. */
  alongMeters: number;
}

/** How far behind the last position a fix is searched for. */
const PROGRESS_BACK_WINDOW_METERS = 60;
/**
 * How far ahead of the last position a fix is searched for. Fixes reach this
 * app a second or two apart, so this covers a rider at highway speed; one that
 * arrives after a longer gap is simply found wherever on the route it is.
 */
const PROGRESS_AHEAD_WINDOW_METERS = 110;
/**
 * Metres of along-route distance that cost as much as one metre off the road,
 * when choosing where on the route a fix belongs. At a corner, or where the
 * route runs back beside itself, two stretches can be equally near a scattered
 * fix; the one that does not ask the rider to have leapt along the route wins.
 */
const PROGRESS_CONTINUITY_WEIGHT = 0.25;
/** Only a fix this much nearer elsewhere on the route beats continuity. */
const PROGRESS_ELSEWHERE_MARGIN_METERS = 25;
/**
 * A step back smaller than this is GPS scatter along the road, not the rider
 * reversing, and is held rather than drawn. Held, the line never regrows
 * behind the rider every other second.
 */
export const PROGRESS_BACKTRACK_TOLERANCE_METERS = 25;

/**
 * The rider's progress along the route for a new fix, given the last one.
 *
 * A fix is placed where it is near the road AND near where the rider was a
 * moment ago, unless they are plainly elsewhere now, and small steps backwards
 * are held. The plain nearest-point projection did neither: at a corner it
 * flipped between two stretches, and scatter moved the start of the line
 * backwards as often as forwards.
 */
export function followRouteProgress(
  point: MapCoordinate,
  path: MapCoordinate[],
  cumulative: number[],
  previous: RouteProgress | null
): RouteProgress | null {
  const global = projectOntoPath(point, path);
  if (!global) return null;
  const globalAlong = (cumulative[global.segmentIndex] ?? 0) + metresBetween(path[global.segmentIndex], global.point);
  if (path.length < 2 || !previous) return { projection: global, alongMeters: globalAlong };

  const from = previous.alongMeters - PROGRESS_BACK_WINDOW_METERS;
  const to = previous.alongMeters + PROGRESS_AHEAD_WINDOW_METERS;

  let best: { projection: PathProjection; along: number; score: number } | null = null;
  const scale = Math.cos(point.latitude * DEG);
  for (let i = 0; i < path.length - 1; i++) {
    if (cumulative[i + 1] < from) continue;
    if (cumulative[i] > to) break;
    const a = path[i];
    const b = path[i + 1];
    const vx = (b.longitude - a.longitude) * scale;
    const vy = b.latitude - a.latitude;
    const lengthSq = vx * vx + vy * vy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point.longitude - a.longitude) * scale * vx + (point.latitude - a.latitude) * vy) / lengthSq)
          );
    const candidate = lerpCoordinate(a, b, t);
    const distanceMeters = metresBetween(point, candidate);
    const along = cumulative[i] + metresBetween(a, candidate);
    const score = distanceMeters + PROGRESS_CONTINUITY_WEIGHT * Math.abs(along - previous.alongMeters);
    if (!best || score < best.score) {
      best = { projection: { point: candidate, segmentIndex: i, t, distanceMeters }, along, score };
    }
  }

  // Nothing nearby, or the route elsewhere is plainly where the rider is now
  // (a shortcut, a fix catching up after a gap in signal).
  const elsewhere =
    !best || best.projection.distanceMeters > global.distanceMeters + PROGRESS_ELSEWHERE_MARGIN_METERS;
  const projection = elsewhere ? global : best!.projection;
  const alongMeters = elsewhere ? globalAlong : best!.along;

  const backwards = previous.alongMeters - alongMeters;
  if (!elsewhere && backwards > 0 && backwards < PROGRESS_BACKTRACK_TOLERANCE_METERS) {
    // Held where it was along the road, but still reporting how far off the
    // road this fix is.
    return {
      projection: { ...previous.projection, distanceMeters: projection.distanceMeters },
      alongMeters: previous.alongMeters,
    };
  }
  return { projection, alongMeters };
}
