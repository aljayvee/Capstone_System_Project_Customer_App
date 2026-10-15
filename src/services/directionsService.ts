import { apiClient } from './apiClient';
import { MapCoordinate } from '../utils/coords';

/**
 * How the server chose the route when asked for the fastest
 * (server/src/lib/routing/bestRoute.ts). For a tracked errand it is the rider's
 * own verdict, reused, so both apps show the same map and line. `drawnWith` is
 * whose roads the line follows, and so which map to show under it.
 */
export interface RouteSelection {
  strategy: 'fastest';
  chosen: string;
  drawnWith: string;
  candidates: { provider: string; durationSeconds: number; distanceMeters: number }[];
}

export interface RouteRequestOptions {
  /** Ask for the fastest of OSRM and Google (the rider app's rule). */
  choose?: 'fastest';
  /** The errand being tracked: its rider's verdict is reused. */
  errandId?: string;
  /**
   * The roads of the map on screen: 'osrm' for OpenStreetMap, 'google' for
   * Google. The server redraws the route on them where it can, and otherwise
   * answers on the other engine's roads (useLiveRoute never draws that one).
   */
  provider?: 'osrm' | 'google';
  /**
   * Route with this engine alone (server bestRoute `keep`). The server
   * replaces it with the rider's verdict whenever `errandId` finds one, so it
   * only means anything sent without the errand.
   */
  keep?: 'osrm' | 'google';
}

export interface RouteLegSummary {
  distanceMeters: number;
  durationSeconds: number;
}

export interface DirectionsResult {
  /** Full route geometry, stitched from the per-leg road segments */
  coordinates: MapCoordinate[];
  /** Coordinates for the first leg only (rider → first store, or rider → customer when no waypoints) */
  pickupLegCoordinates: MapCoordinate[] | null;
  /** Coordinates for all legs after the first (stores → customer) */
  deliveryLegCoordinates: MapCoordinate[] | null;
  /**
   * Each leg's own distance and time, in visiting order: rider to the first
   * store, store to store, then the last store to the customer. What lets the
   * map quote the stretch it is drawing rather than the whole errand.
   */
  legs: RouteLegSummary[];
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
  selection: RouteSelection | null;
}

/**
 * Fetches a driving route via the backend routing proxy endpoint, optionally
 * routed through store waypoints before the customer destination.
 * Fails soft to null on any error.
 */
export async function fetchDrivingRoute(
  origin: MapCoordinate,
  destination: MapCoordinate,
  waypoints?: MapCoordinate[],
  options: RouteRequestOptions = {}
): Promise<DirectionsResult | null> {
  try {
    const payload: any = { origin, destination };
    if (waypoints && waypoints.length > 0) {
      payload.waypoints = waypoints;
    }
    if (options.choose) payload.choose = options.choose;
    if (options.errandId) payload.errandId = options.errandId;
    if (options.provider) payload.provider = options.provider;
    if (options.keep) payload.keep = options.keep;

    const response = await apiClient.post('/routing/directions', payload);
    const data = response.data;

    return {
      coordinates: data.coordinates || [],
      pickupLegCoordinates: data.pickupLegCoordinates || null,
      deliveryLegCoordinates: data.deliveryLegCoordinates || null,
      legs: Array.isArray(data.legs)
        ? data.legs.map((leg: any) => ({
            distanceMeters: Number(leg?.distanceMeters) || 0,
            durationSeconds: Number(leg?.durationSeconds) || 0,
          }))
        : [],
      distanceMeters: data.distanceMeters || 0,
      durationSeconds: data.durationSeconds || 0,
      provider: data.provider || 'unknown',
      // Absent means an older server that predates the field. Treating that as
      // "not degraded" keeps the map looking exactly as it does today rather
      // than flagging every route on a server that cannot tell us either way.
      degraded: data.degraded === true,
      selection: data.selection ?? null,
    };
  } catch (err) {
    console.warn('[Directions API Proxy] Failed to fetch route:', err);
    return null;
  }
}

