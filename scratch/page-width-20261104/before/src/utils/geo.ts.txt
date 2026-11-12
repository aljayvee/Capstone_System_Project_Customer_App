import { MapCoordinate } from './coords';

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Great-circle distance between two points, in kilometers. Mirrors
// server/src/lib/geo.ts's haversineDistanceKm — no client-side equivalent
// existed before this.
export function haversineDistanceKm(a: MapCoordinate, b: MapCoordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

// Nearest of a list of points to `from`, or null if the list is empty.
export function nearestPoint<T extends MapCoordinate>(from: MapCoordinate, points: T[]): T | null {
  if (points.length === 0) return null;
  return points.reduce((closest, p) =>
    haversineDistanceKm(from, p) < haversineDistanceKm(from, closest) ? p : closest
  );
}

// Initial bearing from `a` to `b`, in degrees clockwise from north.
//
// The rider's own `heading` is preferred when the phone reports one, but it is
// frequently null — a stationary phone has no course to report, and mock-location
// apps generally omit it entirely. Deriving it from consecutive fixes means the
// marker still points the way it is travelling.
export function bearingBetween(a: MapCoordinate, b: MapCoordinate): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}
