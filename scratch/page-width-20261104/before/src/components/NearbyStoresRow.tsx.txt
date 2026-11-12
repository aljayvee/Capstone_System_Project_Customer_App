import React from 'react';
import { MapPin, Navigation, Search } from 'lucide-react-native';
import { useDefaultDeliveryLocation } from '../hooks/useDefaultDeliveryLocation';
import { useEstablishmentSearch } from '../hooks/useEstablishmentSearch';
// The Home tab remounts on every tab switch; the stores near a customer do not
// change that fast. Shared with the "Stores near you" screen's first page.
import { NEARBY_MAX_AGE_MS } from '../hooks/useNearbyStoresPages';
import { OUTSIDE_SERVICE_AREA_MESSAGE, type Establishment } from '../services/establishments';
import { StoreCardRow } from './stores/StoreCardRow';

/** Three in the row (four until 2026-10-10); "See all" opens "Stores near you", up to 20. */
const ROW_CARDS = 3;

interface NearbyStoresRowProps {
  user: any;
  navigation: { navigate: (screen: any, params?: any) => void };
  /** Owner-set category photos by category id, already loaded by the Home tab. */
  categoryImages: Record<number, string>;
  /** The Home column's width; cards are sized from it. */
  contentWidth: number;
}

/**
 * "Stores near you" on the Home tab: real stores in a row that scrolls
 * sideways, the way foodpanda lists shops. It sits under the Search button and
 * "Popular Stores", above the Merchant Categories bento: real stores first,
 * kinds of store after. Each card shows the shop's own photo from Google Maps
 * where it has one.
 *
 * The same list as step 1's Location tab, in the same order: the server ranks
 * it (distance first, then the customer's own past orders and everyone's;
 * server lib/places/storeRanking.ts). A card starts an order from that store in
 * one tap, as a category tile does; "See all" opens the store search.
 */
export default function NearbyStoresRow({ user, navigation, categoryImages, contentWidth }: NearbyStoresRowProps) {
  const { location, loading: locationLoading } = useDefaultDeliveryLocation(user?.id);
  const near = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  const search = useEstablishmentSearch('', near, !locationLoading, { maxAgeMs: NEARBY_MAX_AGE_MS, withPhotos: true });

  // As Popular Stores' row does (2026-10-11): a store opens "Stores near you"
  // with it already picked, and the arrow and See all open it too. Both went
  // elsewhere before: a store straight to the Shopping list, the arrow to the
  // store search.
  const openWith = (store: Establishment) => navigation.navigate('NearbyStores', { user, selected: store });
  const seeAll = () => navigation.navigate('NearbyStores', { user });
  // An empty list has nothing more on its own screen: search by name instead.
  const searchStores = () => navigation.navigate('StoreSearch', { user });
  const changeLocation = () => navigation.navigate('CustomerLocation', { user });

  return (
    <StoreCardRow
      title="Stores near you"
      Icon={MapPin}
      testID="nearby-stores"
      cardTestIDPrefix="nearby-store"
      items={search.items}
      status={search.status}
      onRetry={search.retry}
      onStorePress={openWith}
      cardActionLabel="Opens Stores near you with it picked"
      onSeeAll={seeAll}
      seeAll={{
        title: 'See all stores near you',
        body: 'The nearest stores first',
        Icon: Navigation,
        accessibilityLabel: 'See all stores near you',
      }}
      errorMessage="We couldn't load stores near you. Check your connection, then try again."
      empty={
        search.outsideServiceArea
          ? {
              message: OUTSIDE_SERVICE_AREA_MESSAGE,
              actionLabel: 'Change location',
              ActionIcon: MapPin,
              onPress: changeLocation,
            }
          : {
              message: 'No stores found near your saved location yet. You can still search for one by name.',
              actionLabel: 'Search stores',
              ActionIcon: Search,
              onPress: searchStores,
            }
      }
      categoryImages={categoryImages}
      contentWidth={contentWidth}
      maxCards={ROW_CARDS}
    />
  );
}
