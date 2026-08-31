import { apiClient } from './apiClient';
import { MapCoordinate } from '../utils/coords';

export interface DirectionsResult {
  /** Full route geometry, stitched from the per-leg road segments */
  coordinates: MapCoordinate[];
  /** Coordinates for the first leg only (rider → first store, or rider → customer when no waypoints) */
  pickupLegCoordinates: MapCoordinate[] | null;
  /** Coordinates for all legs after the first (stores → customer) */
  deliveryLegCoordinates: MapCoordinate[] | null;
  distanceMeters: number;
  durationSeconds: number;
  /** Which engine answered: 'osrm', 'google', or 'haversine'. */
  provider: string;
  /**
   * True when the shape is an estimate rather than a measured road route — the
   * haversine fallback returns straight lines between the stops. The map must
   * not present that as a path the rider will take.
   */
  degraded: boolean;
}

/**
 * Fetches a driving route via the backend routing proxy endpoint, optionally
 * routed through store waypoints before the customer destination.
 * Fails soft to null on any error.
 */
export async function fetchDrivingRoute(
  origin: MapCoordinate,
  destination: MapCoordinate,
  waypoints?: MapCoordinate[]
): Promise<DirectionsResult | null> {
  try {
    const payload: any = { origin, destination };
    if (waypoints && waypoints.length > 0) {
      payload.waypoints = waypoints;
    }

    const response = await apiClient.post('/routing/directions', payload);
    const data = response.data;

    return {
      coordinates: data.coordinates || [],
      pickupLegCoordinates: data.pickupLegCoordinates || null,
      deliveryLegCoordinates: data.deliveryLegCoordinates || null,
      distanceMeters: data.distanceMeters || 0,
      durationSeconds: data.durationSeconds || 0,
      provider: data.provider || 'unknown',
      // Absent means an older server that predates the field. Treating that as
      // "not degraded" keeps the map looking exactly as it does today rather
      // than flagging every route on a server that cannot tell us either way.
      degraded: data.degraded === true,
    };
  } catch (err) {
    console.warn('[Directions API Proxy] Failed to fetch route:', err);
    return null;
  }
}

