import { useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { defaultLocationOf, useSavedLocations } from './useSavedLocations';

/** The saved place this errand is delivered to, as GET /customer-locations returns it. */
export interface DeliveryLocation {
  address: string;
  latitude: number;
  longitude: number;
  streetName?: string | null;
  landmark?: string | null;
  notes?: string | null;
}

/**
 * The customer's default delivery location, from the shared saved-locations
 * list (hooks/useSavedLocations.ts).
 *
 * It used to be fetched afresh on every focus with `loading` set, so the store
 * rows that wait on it went back to their skeletons each time the customer
 * came back to Home or a merchant screen (2026-10-14). Now a focus refreshes
 * quietly when the list is over a minute old, and the last location stays on
 * screen meanwhile; a default set in Saved Locations is here the moment the
 * customer returns, because both read the same list.
 *
 * `failed` is kept apart from "no location saved": the first means "try again",
 * the second means "set one", and showing the second for a network error sends
 * the customer to set a place they already have. It is only reported when
 * there is no list to show at all.
 */
export function useDefaultDeliveryLocation(userId: string | number | undefined) {
  const { data, isLoading, error, revalidate, hasUser } = useSavedLocations(userId);

  useFocusEffect(
    useCallback(() => {
      void revalidate();
      return undefined;
    }, [revalidate])
  );

  const location = useMemo<DeliveryLocation | null>(() => {
    const def = defaultLocationOf(data);
    return def
      ? {
          address: def.address,
          latitude: def.latitude,
          longitude: def.longitude,
          streetName: def.streetName ?? null,
          landmark: def.landmark ?? null,
          notes: def.notes ?? null,
        }
      : null;
  }, [data]);

  const retry = useCallback(() => {
    void revalidate({ force: true });
  }, [revalidate]);

  return {
    location,
    loading: hasUser ? isLoading : false,
    failed: hasUser && data === undefined && error !== null,
    retry,
  };
}
