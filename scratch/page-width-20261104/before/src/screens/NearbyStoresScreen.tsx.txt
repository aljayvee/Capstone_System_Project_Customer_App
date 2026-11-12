import React from 'react';
import { useDefaultDeliveryLocation } from '../hooks/useDefaultDeliveryLocation';
import { useNearbyStoresPages } from '../hooks/useNearbyStoresPages';
import { StorePickScreen } from '../components/stores/StorePickScreen';
import type { RootStackScreenProps } from '../navigation/types';

/**
 * "Stores near you" (2026-10-11), opened from Home's "Stores near you" row: its
 * arrow and its "See all" card (which opened the store search before), and a
 * tap on one of its stores, which arrives already picked (`selected`; the tap
 * went straight to the Shopping list before). It behaves as "Popular Stores"
 * does (components/stores/StorePickScreen.tsx): photo cards, the next page as
 * the list reaches its end up to 20, up to 3 picked, then "Proceed".
 *
 * The stores are the server's recommendation order around the saved location:
 * distance first, then the customer's own past orders and everyone's. No sort
 * row: the order is the point of the list.
 */
export default function NearbyStoresScreen({ route, navigation }: RootStackScreenProps<'NearbyStores'>) {
  const { user, selected } = route.params || ({} as any);
  const { location, loading: locationLoading } = useDefaultDeliveryLocation(user?.id);
  const near = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  const nearby = useNearbyStoresPages(near, !locationLoading);

  return (
    <StorePickScreen
      user={user}
      navigation={navigation}
      title="Stores near you"
      testIDPrefix="nearby-stores"
      pages={nearby}
      initialPicks={selected ? [selected] : undefined}
      copy={{
        error: "We couldn't load stores near you. Check your connection, then try again.",
        empty: 'No stores found near your saved location yet. You can still search for one by name.',
        unavailable: "Stores near you aren't available right now. You can still search for a store by name.",
        end: (count, max) =>
          count >= max ? `That's the ${max} stores nearest you.` : "That's every store we found near you.",
      }}
    />
  );
}
