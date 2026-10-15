import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import { showAppAlert } from '../services/alertModal';
import { clearNearbyEstablishmentCache } from '../services/establishments';
import PopularStoresRow from '../components/PopularStoresRow';
import PopularStoresScreen from '../screens/PopularStoresScreen';

/**
 * Home's "Popular Stores" (2026-10-09): Google's most popular shops nearby,
 * best rated first, as the same cards as "Stores near you" with the stars on
 * the photo. Three in the row; "See all popular stores" opens a screen that
 * loads six at a time up to 20, with sort settings (2026-10-10).
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
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

jest.mock('../services/alertModal', () => ({
  showAppAlert: jest.fn(),
}));

jest.mock('../hooks/useMerchantCategories', () => ({
  useMerchantCategories: () => ({ categories: [], isLoading: false, reload: jest.fn() }),
}));

const user = { id: 4, username: 'maria' };

const store = (key: string, name: string, rating: number | null, ratingCount: number | null, extra: object = {}) => ({
  key,
  source: 'google',
  name,
  address: 'Poblacion, Tacurong',
  latitude: 6.69,
  longitude: 124.68,
  placeId: null,
  googlePlaceId: key,
  categoryId: 3,
  categoryName: 'Pharmacy',
  distanceMeters: 640,
  orderedBefore: false,
  photoUrl: null,
  rating,
  ratingCount,
  ...extra,
});

// Best rated first, as the server sends them.
const SIX = [
  store('g1', 'Mercury Drug Alunan', 4.9, 1240),
  store('g2', 'Rose Pharmacy', 4.7, 85),
  store('g3', 'Jollibee Tacurong', 4.5, 2300),
  store('g4', 'Savemore Market', 4.4, 410),
  store('g5', 'Fitmart', 4.2, 160),
  store('g6', 'Generika', 4.0, 12),
];

const answer = (items: object[], google = 'ok') => Promise.resolve({ data: { google, items } });

beforeEach(() => {
  jest.clearAllMocks();
  clearNearbyEstablishmentCache();
});

describe('Popular Stores on Home', () => {
  const navigation = { navigate: jest.fn() };
  const draw = async () =>
    render(<PopularStoresRow user={user} navigation={navigation} categoryImages={{}} contentWidth={360} />);

  it("asks for the popular list with photos, and shows three cards with each shop's stars", async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer(SIX));
    const res: any = await draw();

    expect(await res.findByTestId('popular-store-g1')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith(
      '/places/establishments/popular',
      expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1 } })
    );
    expect(res.getByText('Popular Stores')).toBeTruthy();
    expect(res.getByText('4.9 (1.2k)')).toBeTruthy();
    expect(res.getByText('4.7 (85)')).toBeTruthy();
    // Three in the row; the rest wait on the See all screen.
    expect(res.getByTestId('popular-store-g3')).toBeTruthy();
    expect(res.queryByTestId('popular-store-g4')).toBeNull();
    expect(res.getByTestId('popular-stores-see-all-card')).toBeTruthy();
  });

  it('opens the Popular Stores screen from See all, and the arrow', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer(SIX));
    const res: any = await draw();
    await res.findByTestId('popular-store-g1');

    await fireEvent.press(res.getByTestId('popular-stores-see-all-card'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('PopularStores', { user });
    await fireEvent.press(res.getByTestId('popular-stores-see-all'));
    expect(navigation.navigate).toHaveBeenCalledTimes(2);
  });

  it('opens the Popular Stores screen with the tapped store already picked (2026-10-11)', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer(SIX));
    const res: any = await draw();

    await fireEvent.press(await res.findByTestId('popular-store-g2'));
    expect(navigation.navigate).toHaveBeenCalledWith('PopularStores', {
      user,
      selected: expect.objectContaining({ key: 'g2', name: 'Rose Pharmacy' }),
    });
    expect(navigation.navigate).not.toHaveBeenCalledWith('ErrandItems', expect.anything());
  });

  it('says when Google cannot answer, and offers a search instead', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer([], 'unavailable'));
    const res: any = await draw();

    await res.findByTestId('popular-stores-empty');
    expect(res.getByText("Popular stores aren't available right now.")).toBeTruthy();
    await fireEvent.press(res.getByTestId('popular-stores-empty-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('StoreSearch', { user });
  });

  it('offers Try again when the list cannot load', async () => {
    (apiClient.get as jest.Mock)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockReturnValueOnce(answer(SIX));
    const res: any = await draw();

    await res.findByTestId('popular-stores-error');
    await fireEvent.press(res.getByTestId('popular-stores-error-action'));
    expect(await res.findByTestId('popular-store-g1')).toBeTruthy();
  });
});

describe('the Popular Stores screen', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const draw = async () =>
    render(<PopularStoresScreen navigation={navigation as any} route={{ key: 'p', name: 'PopularStores', params: { user } } as any} />);

  it('lists all six, best rated first, as full-width cards with their stars', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer(SIX));
    const res: any = await draw();

    await res.findByTestId('popular-stores-screen-store-g1');
    const tree = JSON.stringify(res.toJSON());
    const order = SIX.map((s) => tree.indexOf(`"popular-stores-screen-store-${s.key}"`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(res.getByText('4.0 (12)')).toBeTruthy();
    // A server that sends one page of six has nothing more.
    expect(res.getByText("That's every popular store near you.")).toBeTruthy();
  });

  it('shows the same answer Home just showed, without asking again', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer(SIX));
    const home: any = await render(
      <PopularStoresRow user={user} navigation={{ navigate: jest.fn() }} categoryImages={{}} contentWidth={360} />
    );
    await home.findByTestId('popular-store-g1');
    await home.unmount();

    const res: any = await draw();
    expect(await res.findByTestId('popular-stores-screen-store-g6')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('picks a store with a tap, then proceeds with it, and goes back', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer(SIX));
    const res: any = await draw();

    // Nothing picked: no button along the bottom.
    await res.findByTestId('popular-stores-screen-store-g5');
    expect(res.queryByTestId('popular-stores-proceed')).toBeNull();

    await fireEvent.press(res.getByTestId('popular-stores-screen-store-g5'));
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(res.getByText('Proceed with this store (1)')).toBeTruthy();
    expect(res.getByTestId('popular-stores-screen-store-g5').props.accessibilityState).toEqual({ selected: true });

    await fireEvent.press(res.getByTestId('popular-stores-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', expect.objectContaining({ selectedCats: ['Fitmart'] }));
    await fireEvent.press(res.getByTestId('back-button'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('picks up to three stores, refuses a fourth, and unpicks with a second tap (2026-10-10)', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer(SIX));
    const res: any = await draw();
    for (const key of ['g1', 'g3', 'g6']) await fireEvent.press(await res.findByTestId(`popular-stores-screen-store-${key}`));
    expect(res.getByText('Proceed with these stores (3)')).toBeTruthy();

    await fireEvent.press(res.getByTestId('popular-stores-screen-store-g2'));
    expect(showAppAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Store Limit (Max 3)' }));
    expect(res.getByTestId('popular-stores-limit-error')).toBeTruthy();
    expect(res.getByTestId('popular-stores-screen-store-g2').props.accessibilityState).toEqual({ selected: false });

    await fireEvent.press(res.getByTestId('popular-stores-screen-store-g3'));
    expect(res.getByText('Proceed with these stores (2)')).toBeTruthy();
    await fireEvent.press(res.getByTestId('popular-stores-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user,
      selectedCats: ['Mercury Drug Alunan', 'Generika'],
      stores: [
        expect.objectContaining({ name: 'Mercury Drug Alunan' }),
        expect.objectContaining({ name: 'Generika' }),
      ],
    });
  });

  it("arrives with Home's tapped store picked, deduplicates across Google and catalogue keys while preserving placeId, and proceeds with it and others", async () => {
    const catalogueItem = {
      ...SIX[1],
      key: 'catalogue:cat-rose',
      source: 'catalogue' as const,
      placeId: 'verified-rose-uuid',
      googlePlaceId: null,
    };
    (apiClient.get as jest.Mock).mockReturnValue(answer([SIX[0], catalogueItem, ...SIX.slice(2)]));
    const res: any = await render(
      <PopularStoresScreen
        navigation={navigation as any}
        route={{ key: 'p', name: 'PopularStores', params: { user, selected: SIX[1] } } as any}
      />
    );

    const pickedItem = await res.findByTestId('popular-stores-screen-store-catalogue:cat-rose');
    expect(pickedItem.props.accessibilityState).toEqual({ selected: true });
    // Store item is strictly unboxed (no card border, fill, or shadow)
    expect(pickedItem.props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ borderWidth: expect.any(Number) })])
    );
    expect(res.getByText('Proceed with this store (1)')).toBeTruthy();

    await fireEvent.press(res.getByTestId('popular-stores-screen-store-g4'));
    await fireEvent.press(res.getByTestId('popular-stores-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ErrandItems',
      expect.objectContaining({
        selectedCats: ['Rose Pharmacy', 'Savemore Market'],
        stores: [
          expect.objectContaining({ name: 'Rose Pharmacy', placeId: 'verified-rose-uuid' }),
          expect.objectContaining({ name: 'Savemore Market' }),
        ],
      })
    );
  });

  it('explains an empty list and offers a search', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer([]));
    const res: any = await draw();

    await res.findByTestId('popular-stores-screen-empty');
    await fireEvent.press(res.getByTestId('popular-stores-screen-empty-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('StoreSearch', { user });
  });

  describe('scrolling for more, and sorting (2026-10-10)', () => {
    // 22 popular stores; the server pages through its first 20.
    const ALL = Array.from({ length: 22 }, (_, i) => store(`p${i + 1}`, `Shop ${i + 1}`, 4.9 - i * 0.05, 400 - i));
    const server = (failAt: number | null = null) =>
      (apiClient.get as jest.Mock).mockImplementation((_url: string, { params }: any) => {
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 6;
        if (offset === failAt) return Promise.reject(new Error('Network Error'));
        const set = ALL.slice(0, 20);
        const ordered = params.sort === 'distance' ? [...set].reverse() : set;
        const items = ordered.slice(offset, offset + limit);
        return Promise.resolve({ data: { google: 'ok', items, total: set.length, hasMore: offset + items.length < set.length } });
      });
    const pageAsked = (offset: number, limit: number) =>
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/places/establishments/popular',
        expect.objectContaining({ params: expect.objectContaining({ offset, limit }) })
      );

    it('loads six more each time the list reaches its end, and stops at 20', async () => {
      server();
      const res: any = await draw();
      await res.findByTestId('popular-stores-screen-store-p6');
      expect(res.queryByTestId('popular-stores-screen-store-p7')).toBeNull();

      for (const [offset, limit] of [[6, 6], [12, 6], [18, 2]]) {
        await fireEvent(res.getByTestId('popular-stores-screen-list'), 'onEndReached');
        pageAsked(offset, limit);
        await waitFor(() => expect(res.queryByTestId('popular-stores-screen-more-loading')).toBeNull());
      }
      expect(res.getByTestId('popular-stores-screen-store-p7')).toBeTruthy();
      expect(res.getByText("That's the top 20 popular stores near you.")).toBeTruthy();

      // The end of the list again asks for nothing more.
      await fireEvent(res.getByTestId('popular-stores-screen-list'), 'onEndReached');
      expect(apiClient.get).toHaveBeenCalledTimes(4);
    });

    it('keeps the cards when the next page fails, and asks again only from Try again', async () => {
      server(6);
      const res: any = await draw();
      await res.findByTestId('popular-stores-screen-store-p6');

      await fireEvent(res.getByTestId('popular-stores-screen-list'), 'onEndReached');
      expect(await res.findByTestId('popular-stores-screen-more-error')).toBeTruthy();
      expect(res.getByTestId('popular-stores-screen-store-p1')).toBeTruthy();
      await fireEvent(res.getByTestId('popular-stores-screen-list'), 'onEndReached');
      expect(apiClient.get).toHaveBeenCalledTimes(2);

      server();
      await fireEvent.press(res.getByTestId('popular-stores-screen-more-retry'));
      expect(await res.findByTestId('popular-stores-screen-store-p7')).toBeTruthy();
      expect(res.queryByTestId('popular-stores-screen-more-error')).toBeNull();
    });

    it('asks the server for the chosen sort and starts again from the top', async () => {
      server();
      const res: any = await draw();
      await res.findByTestId('popular-stores-screen-store-p1');
      for (const label of ['Recommended', 'Top rated', 'Nearest', 'Most reviews']) {
        expect(res.getByText(label)).toBeTruthy();
      }

      // A pick made before sorting is kept.
      await fireEvent.press(res.getByTestId('popular-stores-screen-store-p1'));
      await fireEvent.press(res.getByTestId('popular-sort-distance'));
      expect(await res.findByTestId('popular-stores-screen-store-p20')).toBeTruthy();
      expect(res.getByText('Proceed with this store (1)')).toBeTruthy();
      expect(res.queryByTestId('popular-stores-screen-store-p1')).toBeNull();
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/places/establishments/popular',
        expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1, sort: 'distance' } })
      );

      // Paging carries on in the new order.
      await fireEvent(res.getByTestId('popular-stores-screen-list'), 'onEndReached');
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/places/establishments/popular',
        expect.objectContaining({ params: expect.objectContaining({ sort: 'distance', offset: 6 }) })
      );
    });
  });
});
