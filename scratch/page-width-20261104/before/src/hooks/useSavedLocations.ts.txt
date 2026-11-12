import { apiClient } from '../services/apiClient';
import { fetchIntoCache, mutateCache, readCache, useCachedResource } from '../services/swrCache';
import type { SavedLocation } from '../screens/location/types';

/**
 * The customer's saved delivery locations, one cached list for every screen
 * that shows them (2026-10-14): the Home header's "Delivering to", the store
 * lists' distances, Pabili Review, and Saved Locations itself.
 *
 * Each of those used to fetch GET /customer-locations on its own, every visit.
 * On a slow connection the header lost the address and showed "Set address",
 * and Saved Locations opened on "Could not load saved locations" though the
 * same list had loaded seconds before. Now the last list shows at once and is
 * refreshed quietly; a change made in Saved Locations reaches the others
 * immediately, because they read the same answer.
 */

/** Kept a minute before a visit fetches it again; changes made here update it at once. */
export const SAVED_LOCATIONS_STALE_MS = 60 * 1000;

export const savedLocationsKey = (userId: string | number) => `locations:${userId}`;

export async function fetchSavedLocations(userId: string | number): Promise<SavedLocation[]> {
  const res = await apiClient.get(`/customer-locations/${userId}`);
  return Array.isArray(res.data) ? (res.data as SavedLocation[]) : [];
}

/** The default location, or the first saved one, or null. */
export function defaultLocationOf<T extends { isDefault?: boolean }>(locations: T[] | undefined): T | null {
  if (!locations || locations.length === 0) return null;
  return locations.find((l) => l.isDefault) ?? locations[0];
}

export function useSavedLocations(userId: string | number | null | undefined) {
  const hasUser = userId !== undefined && userId !== null && String(userId) !== '' && String(userId) !== '0';
  const key = hasUser ? savedLocationsKey(userId!) : null;
  const resource = useCachedResource<SavedLocation[]>(key, () => fetchSavedLocations(userId!), {
    staleMs: SAVED_LOCATIONS_STALE_MS,
    persist: true,
  });
  return { ...resource, locations: resource.data ?? [], hasUser };
}

/** Fetches the list again now and keeps it; a quiet reconcile after a change. */
export function refreshSavedLocations(userId: string | number): Promise<void> {
  return fetchIntoCache(savedLocationsKey(userId), () => fetchSavedLocations(userId), { persist: true }).then(
    () => undefined,
    () => undefined
  );
}

/**
 * Makes `location` the default at once, everywhere it shows, then tells the
 * server. If the server refuses, the old default comes back and the error is
 * rethrown for the caller to explain. On success the list is fetched again in
 * the background, in case the server changed more than the flag.
 */
export async function setDefaultLocationOptimistic(userId: string | number, location: SavedLocation): Promise<void> {
  const key = savedLocationsKey(userId);
  const undo = mutateCache<SavedLocation[]>(
    key,
    (current) => (current ?? [location]).map((l) => ({ ...l, isDefault: l.id === location.id })),
    { persist: true }
  );
  try {
    await apiClient.put(`/customer-locations/${location.id}`, {
      label: location.label,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      isDefault: true,
    });
  } catch (err) {
    undo();
    throw err;
  }
  void refreshSavedLocations(userId);
}

/** Removes `location` at once, then on the server; puts it back if refused. */
export async function deleteLocationOptimistic(userId: string | number, location: SavedLocation): Promise<void> {
  const key = savedLocationsKey(userId);
  const undo = mutateCache<SavedLocation[]>(key, (current) => (current ?? []).filter((l) => l.id !== location.id), {
    persist: true,
  });
  try {
    await apiClient.delete(`/customer-locations/${location.id}`);
  } catch (err) {
    undo();
    throw err;
  }
  void refreshSavedLocations(userId);
}

/** The cached list, without subscribing; for code outside a component. */
export function cachedSavedLocations(userId: string | number): SavedLocation[] | undefined {
  return readCache<SavedLocation[]>(savedLocationsKey(userId))?.data;
}
