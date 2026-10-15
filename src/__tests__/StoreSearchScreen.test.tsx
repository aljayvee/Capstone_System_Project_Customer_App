import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import { showAppAlert } from '../services/alertModal';
import StoreSearchScreen from '../screens/StoreSearchScreen';
import { clearNearbyEstablishmentCache } from '../services/establishments';
import { establishmentsFromStops, isSameStore } from '../services/establishments';

/**
 * Step 1 of a Pabili errand since 2026-10-10: search for the stores to buy
 * from, pick 1 to 3, then the Shopping list. Opened from Home's Search button
 * and the bottom bar's "+".
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
  useMerchantCategories: () => ({
    categories: [{ id: 3, name: 'Pharmacy' }, { id: 7, name: 'Bakery' }],
    isLoading: false,
    reload: jest.fn(),
  }),
}));

const user = { id: 4, username: 'maria' };

const store = (key: string, name: string, extra: object = {}) => ({
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
  distanceMeters: 210,
  orderedBefore: false,
  ...extra,
});

const NEARBY = [
  store('g1', 'Mercury Drug', { photoUrl: 'https://lh3.googleusercontent.com/places/g1/photos/p1', photoAttribution: 'Juan' }),
  store('g2', 'Rose Pharmacy'),
  store('g3', 'Generika'),
  store('g4', 'Watsons'),
];

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const draw = () =>
  render(<StoreSearchScreen navigation={navigation as any} route={{ key: 's', name: 'StoreSearch', params: { user } } as any} />);

beforeEach(() => {
  jest.clearAllMocks();
  // Find stores keeps its list (stale-while-revalidate): each test starts with none.
  clearNearbyEstablishmentCache();
  (apiClient.get as jest.Mock).mockResolvedValue({ data: { google: 'ok', items: NEARBY } });
});

describe('the store search screen', () => {
  it('opens on step 1 with the keyboard up and the stores near the customer', async () => {
    const res: any = await draw();

    expect(await res.findByTestId('establishment-g1')).toBeTruthy();
    expect(res.getByText('Find stores')).toBeTruthy();
    expect(res.getByTestId('establishment-search-input').props.autoFocus).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/places/establishments',
      // Find stores before typing (2026-10-14): featured brands first, ten at a time.
      expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1, featured: 1, limit: 10 } })
    );
    // Nothing picked yet: no Proceed button.
    expect(res.queryByTestId('store-search-proceed')).toBeNull();
  });

  it('shows each store as a photo card, with only the search field above the list (2026-10-10)', async () => {
    const res: any = await draw();
    await res.findByTestId('establishment-g1');

    expect(res.getByTestId('establishment-photo-g1')).toBeTruthy();
    expect(res.getByText('Photo: Juan')).toBeTruthy();
    // No photo of its own: the category icon stands in.
    expect(res.getByTestId('establishment-icon-g2')).toBeTruthy();
    expect(res.getByTestId('establishment-pick-g1')).toBeTruthy();
    expect(res.queryByText('Where should we shop?')).toBeNull();
    expect(res.queryByText('Pick up to 3')).toBeNull();
  });

  it('goes to the Shopping list with the picked stores', async () => {
    const res: any = await draw();
    await fireEvent.press(await res.findByTestId('establishment-g1'));
    await fireEvent.press(res.getByTestId('establishment-g3'));
    expect(res.getByText('Proceed with these stores (2)')).toBeTruthy();
    expect(res.getByTestId('establishment-g1').props.accessibilityState).toEqual({ selected: true });

    await fireEvent.press(res.getByTestId('store-search-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user,
      selectedCats: ['Mercury Drug', 'Generika'],
      stores: [
        expect.objectContaining({ key: 'Mercury Drug', name: 'Mercury Drug' }),
        expect.objectContaining({ key: 'Generika', name: 'Generika' }),
      ],
    });
  });

  it('proceeds with a single store', async () => {
    const res: any = await draw();
    await fireEvent.press(await res.findByTestId('establishment-g2'));
    expect(res.getByText('Proceed with this store (1)')).toBeTruthy();

    await fireEvent.press(res.getByTestId('store-search-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', expect.objectContaining({ selectedCats: ['Rose Pharmacy'] }));
  });

  it('stops at three stores and says why', async () => {
    const res: any = await draw();
    for (const key of ['g1', 'g2', 'g3']) await fireEvent.press(await res.findByTestId(`establishment-${key}`));
    await fireEvent.press(res.getByTestId('establishment-g4'));

    expect(res.getByTestId('store-limit-error')).toBeTruthy();
    expect(showAppAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Store Limit (Max 3)' }));
    expect(res.getByText('Proceed with these stores (3)')).toBeTruthy();

    // Unpicking one makes room again; unpicking all takes the button away.
    await fireEvent.press(res.getByTestId('establishment-g1'));
    expect(res.getByText('Proceed with these stores (2)')).toBeTruthy();
    expect(res.queryByTestId('store-limit-error')).toBeNull();
    await fireEvent.press(res.getByTestId('establishment-g2'));
    await fireEvent.press(res.getByTestId('establishment-g3'));
    expect(res.queryByTestId('store-search-proceed')).toBeNull();
  });

  it('searches by name as the customer types', async () => {
    const res: any = await draw();
    await res.findByTestId('establishment-g1');
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { google: 'ok', items: [store('m1', 'Mercury Drug Alunan')] } });

    await fireEvent.changeText(res.getByTestId('establishment-search-input'), 'mercury');
    expect(await res.findByTestId('establishment-m1', {}, { timeout: 2000 })).toBeTruthy();
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/places/establishments',
        expect.objectContaining({ params: expect.objectContaining({ q: 'mercury' }) })
      )
    );
  });

  it('goes back', async () => {
    const res: any = await draw();
    await fireEvent.press(res.getByTestId('back-button'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('Order again (2026-10-10)', () => {
  // A past errand's stops, as the customer's errand list sends them.
  const stops = [
    { storeName: 'Mercury Drug', latitude: 6.69, longitude: 124.68, placeId: null, categoryId: 3 },
    { storeName: "Rogelio's Bakery", latitude: '6.6912', longitude: '124.6801', placeId: 'vp-9', categoryId: 7, storeCategory: 'Bakery' },
  ];

  it('turns the stops into picked stores, keyed so the nearby list can tell them apart', () => {
    const stores = establishmentsFromStops(stops);
    expect(stores).toEqual([
      expect.objectContaining({ key: 'past:0:Mercury Drug', name: 'Mercury Drug', latitude: 6.69, categoryId: 3, categoryName: null }),
      expect.objectContaining({ key: 'catalogue:vp-9', source: 'catalogue', placeId: 'vp-9', latitude: 6.6912, categoryName: 'Bakery' }),
    ]);
  });

  it('leaves out stops with no name or spot, counts a shop pinned twice once, and keeps three', () => {
    const many = [
      { storeName: '', latitude: 6.69, longitude: 124.68 },
      { storeName: 'No Spot', latitude: null, longitude: null },
      { storeName: 'A', latitude: 6.69, longitude: 124.68 },
      { storeName: ' a ', latitude: 6.6901, longitude: 124.68 }, // ~11 m away: the same shop
      { storeName: 'B', latitude: 6.70, longitude: 124.68 },
      { storeName: 'C', latitude: 6.71, longitude: 124.68 },
      { storeName: 'D', latitude: 6.72, longitude: 124.68 },
    ];
    expect(establishmentsFromStops(many).map((s) => s.name)).toEqual(['A', 'B', 'C']);
    expect(establishmentsFromStops(null)).toEqual([]);
  });

  it('calls two shops the same only with the same name in the same spot', () => {
    const here = { name: 'Mercury Drug', latitude: 6.69, longitude: 124.68 };
    expect(isSameStore(here, { ...here, name: 'mercury  drug' })).toBe(true);
    expect(isSameStore(here, { ...here, latitude: 6.691 })).toBe(false); // ~110 m: another branch
    expect(isSameStore(here, { ...here, name: 'Rose Pharmacy' })).toBe(false);
  });

  const drawReorder = (stores: object[]) =>
    render(
      <StoreSearchScreen
        navigation={navigation as any}
        route={{ key: 's', name: 'StoreSearch', params: { user, reorderFrom: { errandId: 'PB-1', stores } } } as any}
      />
    );

  it('opens with the past stores picked, ready to continue, and lists them once', async () => {
    const res: any = await drawReorder(establishmentsFromStops(stops));

    expect(res.getByTestId('store-search-reorder-note')).toBeTruthy();
    expect(res.getByText('Proceed with these stores (2)')).toBeTruthy();
    // The stores are here already: no keyboard over them.
    expect(res.getByTestId('establishment-search-input').props.autoFocus).toBe(false);
    // The nearby list's own Mercury Drug (same name, same spot) is not listed again.
    await res.findByTestId('establishment-g2');
    expect(res.queryByTestId('establishment-g1')).toBeNull();
    // The catalogue category's name is filled in from its id.
    expect(res.getByTestId('establishment-past:0:Mercury Drug').props.accessibilityLabel).toBe(
      'Mercury Drug, Pharmacy. Picked. Tap to remove it'
    );

    await fireEvent.press(res.getByTestId('store-search-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user,
      selectedCats: ['Mercury Drug', "Rogelio's Bakery"],
      stores: [
        expect.objectContaining({ name: 'Mercury Drug', categoryId: 3, categoryName: 'Pharmacy', placeId: null }),
        expect.objectContaining({ name: "Rogelio's Bakery", categoryId: 7, categoryName: 'Bakery', placeId: 'vp-9' }),
      ],
    });
  });

  it('lets the customer change the past stores before continuing', async () => {
    const res: any = await drawReorder(establishmentsFromStops(stops));
    await fireEvent.press(res.getByTestId('establishment-past:0:Mercury Drug'));
    await fireEvent.press(await res.findByTestId('establishment-g3'));

    await fireEvent.press(res.getByTestId('store-search-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ErrandItems',
      expect.objectContaining({ selectedCats: ["Rogelio's Bakery", 'Generika'] })
    );
  });

  it('says so when the past order had no stores it can pick, and opens on the search', async () => {
    const res: any = await drawReorder([]);
    expect(res.getByText("We couldn't find the stores from that order. Search for them by name.")).toBeTruthy();
    expect(res.getByTestId('establishment-search-input').props.autoFocus).toBe(true);
    expect(res.queryByTestId('store-search-proceed')).toBeNull();
  });
});

describe("a merchant category's stores (2026-10-10)", () => {
  const pharmacy = { id: 3, name: 'Pharmacy' };
  const drawCategory = () =>
    render(
      <StoreSearchScreen
        navigation={navigation as any}
        route={{ key: 's', name: 'StoreSearch', params: { user, category: pharmacy } } as any}
      />
    );

  it("lists the category's stores, with its chip, and no keyboard over them", async () => {
    const res: any = await drawCategory();

    expect(await res.findByTestId('establishment-g1')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith(
      '/places/establishments',
      expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1, categoryId: 3 } })
    );
    expect(res.getByTestId('establishment-category-chip')).toBeTruthy();
    expect(res.getByText('Pharmacy stores near you')).toBeTruthy();
    expect(res.getByTestId('establishment-search-input').props.autoFocus).toBe(false);
    expect(res.getByTestId('establishment-search-input').props.placeholder).toBe('Search Pharmacy stores');
  });

  it('searches inside the category as the customer types', async () => {
    const res: any = await drawCategory();
    await res.findByTestId('establishment-g1');

    await fireEvent.changeText(res.getByTestId('establishment-search-input'), 'mercury');
    await waitFor(
      () =>
        expect(apiClient.get).toHaveBeenLastCalledWith(
          '/places/establishments',
          expect.objectContaining({ params: expect.objectContaining({ q: 'mercury', categoryId: 3 }) })
        ),
      { timeout: 2000 }
    );
  });

  it("picks the category's stores and goes to the Shopping list", async () => {
    const res: any = await drawCategory();
    await fireEvent.press(await res.findByTestId('establishment-g2'));
    await fireEvent.press(res.getByTestId('store-search-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', expect.objectContaining({ selectedCats: ['Rose Pharmacy'] }));
  });

  it('clears the category to search every store', async () => {
    const res: any = await drawCategory();
    await res.findByTestId('establishment-g1');

    await fireEvent.press(res.getByTestId('establishment-category-clear'));
    expect(res.queryByTestId('establishment-category-chip')).toBeNull();
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/places/establishments',
        // Find stores before typing (2026-10-14): featured brands first, ten at a time.
      expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1, featured: 1, limit: 10 } })
      )
    );
    expect(await res.findByText('Stores near you')).toBeTruthy();
  });

  it('offers to let the rider pick when the category has no stores nearby', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { google: 'ok', items: [] } });
    const res: any = await drawCategory();

    expect(await res.findByText('No Pharmacy stores found near your saved location.')).toBeTruthy();
    await fireEvent.press(res.getByTestId('establishment-let-rider-pick'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', { user, selectedCats: ['Pharmacy'] });
  });

  it('makes no such offer in the plain store search', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { google: 'ok', items: [] } });
    const res: any = await draw();
    await res.findByTestId('establishment-empty');
    expect(res.queryByTestId('establishment-let-rider-pick')).toBeNull();
  });
});

/**
 * Find stores before anything is typed (2026-10-14): the featured brands first
 * ("Recommended for you"), then the rest ("More stores near you"), ten at a
 * time with "See more". It showed the four stores of Home's row.
 */
describe('the recommended list and See more', () => {
  const page = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => store(`n${from + i}`, `Store ${from + i}`));
  const FIRST = [
    store('f1', 'Jollibee Tacurong', { featured: true, categoryName: 'Fast Food' }),
    store('f2', '7-Eleven Tacurong New Isabela (3453)', { featured: true, categoryName: 'Convenience Store' }),
    ...page(1, 8).map((s) => ({ ...s, featured: false })),
  ];
  const NEXT = page(9, 10).map((s) => ({ ...s, featured: false }));

  const answerPages = (pages: { first: object[]; next: object[]; nextHasMore?: boolean }) =>
    (apiClient.get as jest.Mock).mockImplementation((_url: string, config: any) =>
      Promise.resolve({
        data: config?.params?.offset
          ? { google: 'ok', items: pages.next, hasMore: pages.nextHasMore ?? false }
          : { google: 'ok', items: pages.first, hasMore: true },
      })
    );

  it('lists the featured brands under Recommended for you, then the rest', async () => {
    answerPages({ first: FIRST, next: NEXT });
    const res: any = await draw();

    expect(await res.findByText('Recommended for you')).toBeTruthy();
    expect(res.getByText('More stores near you')).toBeTruthy();
    const featured = within(res.getByTestId('establishment-featured'));
    expect(featured.getByTestId('establishment-f1')).toBeTruthy();
    expect(featured.getByTestId('establishment-f2')).toBeTruthy();
    expect(featured.queryByTestId('establishment-n1')).toBeNull();
    expect(within(res.getByTestId('establishment-results')).getByTestId('establishment-n1')).toBeTruthy();
  });

  it('loads ten more with See more, and stops offering it at the end', async () => {
    answerPages({ first: FIRST, next: NEXT });
    const res: any = await draw();
    await res.findByTestId('establishment-n8');
    expect(res.queryByTestId('establishment-n9')).toBeNull();

    await fireEvent.press(res.getByTestId('establishment-see-more'));

    expect(await res.findByTestId('establishment-n18')).toBeTruthy();
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/places/establishments',
      expect.objectContaining({ params: expect.objectContaining({ offset: 10, limit: 10, featured: 1 }) })
    );
    // The first ten are still there, and twenty is the most it lists.
    expect(res.getByTestId('establishment-f1')).toBeTruthy();
    expect(res.queryByTestId('establishment-see-more')).toBeNull();
  });

  it('still lists every store, unlabelled, from a server that marks none', async () => {
    answerPages({ first: page(1, 10), next: [] });
    const res: any = await draw();
    await res.findByTestId('establishment-n1');
    expect(res.queryByText('Recommended for you')).toBeNull();
    expect(res.getByText('Stores near you')).toBeTruthy();
    expect(res.getByTestId('establishment-see-more')).toBeTruthy();
  });

  it('keeps the Proceed bar clear of the bottom bar when opened as the Search tab', async () => {
    const { StyleSheet } = require('react-native');
    const { StoreSearchView } = require('../screens/StoreSearchScreen');
    answerPages({ first: FIRST, next: NEXT });
    const res: any = await render(
      <StoreSearchView user={user} navigation={navigation} onBack={jest.fn()} inTab />
    );
    await fireEvent.press(await res.findByTestId('establishment-n1'));
    const button = res.getByTestId('store-search-proceed');
    const dock = button.parent;
    expect(StyleSheet.flatten(dock.props.style).paddingBottom).toBeGreaterThanOrEqual(68);
  });
});
