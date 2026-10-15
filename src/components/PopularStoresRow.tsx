import React from 'react';
import { MapPin, Search, Star, TrendingUp } from 'lucide-react-native';
import { useDefaultDeliveryLocation } from '../hooks/useDefaultDeliveryLocation';
import { usePopularStores } from '../hooks/usePopularStores';
import { OUTSIDE_SERVICE_AREA_MESSAGE, type Establishment } from '../services/establishments';
import { StoreCardRow } from './stores/StoreCardRow';

interface PopularStoresRowProps {
  user: any;
  navigation: { navigate: (screen: any, params?: any) => void };
  categoryImages: Record<number, string>;
  contentWidth: number;
}

/** Three in the row (four until 2026-10-10); "See all popular stores" pages through up to 20. */
const ROW_CARDS = 3;

/**
 * "Popular Stores" on the Home tab, under the Search button and above "Stores
 * near you" (swapped 2026-10-10): the shops Google
 * considers most popular nearby, best rated first (server
 * lib/places/storeRanking.ts rankByRating). The same cards as "Stores near
 * you", with each shop's star rating on its photo, since that is why it is here.
 */
export default function PopularStoresRow({ user, navigation, categoryImages, contentWidth }: PopularStoresRowProps) {
  const { location, loading: locationLoading } = useDefaultDeliveryLocation(user?.id);
  const near = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  const popular = usePopularStores(near, !locationLoading);

  // A store opens the Popular Stores screen with it already picked, so up to
  // two more can join it before "Proceed" (2026-10-11; straight to the
  // Shopping list before, unlike the screen).
  const openWith = (store: Establishment) => navigation.navigate('PopularStores', { user, selected: store });
  const seeAll = () => navigation.navigate('PopularStores', { user });
  // An empty popular list has nothing more to show on its own screen.
  const searchStores = () => navigation.navigate('StoreSearch', { user });
  const changeLocation = () => navigation.navigate('CustomerLocation', { user });

  return (
    <StoreCardRow
      title="Popular Stores"
      Icon={TrendingUp}
      testID="popular-stores"
      cardTestIDPrefix="popular-store"
      items={popular.items}
      status={popular.status}
      onRetry={popular.retry}
      onStorePress={openWith}
      cardActionLabel="Opens Popular Stores with it picked"
      onSeeAll={seeAll}
      seeAll={{
        title: 'See all popular stores',
        body: 'The best rated stores near you',
        Icon: Star,
        accessibilityLabel: 'See all popular stores',
      }}
      errorMessage="We couldn't load popular stores. Check your connection, then try again."
      empty={
        popular.outsideServiceArea
          ? {
              message: OUTSIDE_SERVICE_AREA_MESSAGE,
              actionLabel: 'Change location',
              ActionIcon: MapPin,
              onPress: changeLocation,
            }
          : {
              message: popular.googleAvailable
                ? 'No rated stores found near your saved location yet.'
                : "Popular stores aren't available right now.",
              actionLabel: 'Search stores',
              ActionIcon: Search,
              onPress: searchStores,
            }
      }
      categoryImages={categoryImages}
      contentWidth={contentWidth}
      showRating
      maxCards={ROW_CARDS}
    />
  );
}
