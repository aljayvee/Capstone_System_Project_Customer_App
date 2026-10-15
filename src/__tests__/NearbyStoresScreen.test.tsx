import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import { clearNearbyEstablishmentCache } from '../services/establishments';
import NearbyStoresScreen from '../screens/NearbyStoresScreen';
import NearbyStoresRow from '../components/NearbyStoresRow';

/**
 * "Stores near you" (2026-10-11), opened from Home's row as "Popular Stores"
 * is from its own: photo cards, more as the list reaches its end (up to 20),
 * up to 3 picked, then "Proceed"; a store tapped on Home arrives picked.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../services/alertModal', () => ({
  showAppAlert: jest.fn(),
}));

// The real hook uses useFocusEffect, which throws outside a navigator.
jest.mock('../hooks/useDefaultDeliveryLocation', () => ({
  useDefaultDeliveryLocation: () => ({
    location: { address: 'Purok 5', latitude: 6.69, longitude: 124.68 },
    loading: false,
    failed: false,
    retry: jest.fn(),
  }),
}));

jest.mock('../hooks/useMerchantCategories', () => ({
  useMerchantCategories: () => ({ categories: [], isLoading: false, reload: jest.fn() }),
}));

const user = { id: 4, username: 'maria' };
const store = (i: number) => ({
  key: `n${i}`,
  source: 'google',
  name: `Shop ${i}`,
  address: 'Poblacion, Tacurong',
  latitude: 6.69,
  longitude: 124.68,
  placeId: null,
  googlePlaceId: `n${i}`,
  categoryId: 3,
  categoryName: 'Pharmacy',
  distanceMeters: 100 + i * 50,
  orderedBefore: false,
  photoUrl: null,
});
const ALL = Array.from({ length: 22 }, (_, i) => store(i + 1));

// The server: four without a page asked for (Home's row), else `limit` from `offset`, at most 20.
const server = (pagesSupported = true) =>
  (apiClient.get as jest.Mock).mockImplementation((_url: string, { params }: any) => {
    const set = ALL.slice(0, 20);
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 4;
    const items = set.slice(offset, offset + limit);
    return Promise.resolve({
      data: pagesSupported
        ? { google: 'ok', items, hasMore: offset + items.length < set.length }
        : { google: 'ok', items: set.slice(0, 4) },
    });
  });

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const draw = (selected?: object) =>
  render(
    <NearbyStoresScreen
      navigation={navigation as any}
      route={{ key: 'n', name: 'NearbyStores', params: { user, selected } } as any}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  clearNearbyEstablishmentCache();
});

describe('the Stores near you screen', () => {
  it("opens on Home's own answer, then loads six more each time the list reaches its end, up to 20", async () => {
    server();
    const row: any = await render(
      <NearbyStoresRow user={user} navigation={{ navigate: jest.fn() }} categoryImages={{}} contentWidth={360} />
    );
    await row.findByTestId('nearby-store-n1');
    await row.unmount();

    const res: any = await draw();
    expect(await res.findByTestId('nearby-stores-screen-store-n4')).toBeTruthy();
    expect(res.getByText('Stores near you')).toBeTruthy();
    // The first page is the row's, not asked for again.
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    for (const [offset, limit] of [[4, 6], [10, 6], [16, 4]]) {
      await fireEvent(res.getByTestId('nearby-stores-screen-list'), 'onEndReached');
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/places/establishments',
        expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1, offset, limit } })
      );
      await waitFor(() => expect(res.queryByTestId('nearby-stores-screen-more-loading')).toBeNull());
    }
    expect(res.getByText("That's the 20 stores nearest you.")).toBeTruthy();
    await fireEvent(res.getByTestId('nearby-stores-screen-list'), 'onEndReached');
    expect(apiClient.get).toHaveBeenCalledTimes(4);
  });

  it("arrives with the store tapped on Home already picked, and proceeds with it and up to two more", async () => {
    server();
    const res: any = await draw(store(2));

    await res.findByTestId('nearby-stores-screen-store-n2');
    expect(res.getByTestId('nearby-stores-screen-store-n2').props.accessibilityState).toEqual({ selected: true });
    expect(res.getByText('Proceed with this store (1)')).toBeTruthy();

    await fireEvent.press(res.getByTestId('nearby-stores-screen-store-n1'));
    expect(res.getByText('Proceed with these stores (2)')).toBeTruthy();
    await fireEvent.press(res.getByTestId('nearby-stores-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user,
      selectedCats: ['Shop 2', 'Shop 1'],
      stores: [expect.objectContaining({ name: 'Shop 2' }), expect.objectContaining({ name: 'Shop 1' })],
    });
  });

  it('shows the four an older server sends, and says that is all', async () => {
    server(false);
    const res: any = await draw();
    expect(await res.findByTestId('nearby-stores-screen-store-n4')).toBeTruthy();
    expect(res.getByText("That's every store we found near you.")).toBeTruthy();
  });

  it('offers Try again when the stores cannot load, and a search when there are none', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    const failed: any = await draw();
    expect(await failed.findByTestId('nearby-stores-screen-error')).toBeTruthy();

    (apiClient.get as jest.Mock).mockResolvedValue({ data: { google: 'ok', items: [] } });
    const empty: any = await draw();
    await empty.findByTestId('nearby-stores-screen-empty');
    await fireEvent.press(empty.getByTestId('nearby-stores-screen-empty-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('StoreSearch', { user });
  });
});
