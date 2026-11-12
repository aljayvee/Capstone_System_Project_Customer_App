import { apiClient } from './apiClient';
import { MapCoordinate } from '../utils/coords';

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  barangay: string | null;
  latitude: number;
  longitude: number;
}

/**
 * Resolves a coordinate to the nearest verified establishment in the Tacurong
 * catalogue, or null when nothing is close enough.
 *
 * This is the Tier-1 answer for "what is at this pin". The device geocoder
 * cannot name an establishment — for a coordinate with no street address of its
 * own it returns a plus code — whereas the catalogue holds real POIs under names
 * a rider recognises.
 *
 * Fails soft to null on any error, matching fetchDrivingRoute: callers always
 * have the OS geocoder to fall back to, so a lookup failure must never surface
 * as an error.
 */
export async function fetchNearestPlace(
  coordinate: MapCoordinate
): Promise<NearbyPlace | null> {
  try {
    const response = await apiClient.get('/places/reverse', {
      params: { lat: coordinate.latitude, lng: coordinate.longitude },
    });
    return response.data?.place ?? null;
  } catch (err) {
    console.warn('[Places API] Nearest-place lookup failed:', err);
    return null;
  }
}
