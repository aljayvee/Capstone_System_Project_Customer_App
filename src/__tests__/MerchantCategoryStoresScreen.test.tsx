import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import {
  clearNearbyEstablishmentCache,
  doesEstablishmentMatchCategory,
  type Establishment,
} from '../services/establishments';
import MerchantCategoryStoresScreen from '../screens/errand/MerchantCategoryStoresScreen';

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
    categories: [{ id: 2, name: 'Pharmacy & Health', status: 'Active' }],
    isLoading: false,
    reload: jest.fn(),
  }),
}));

const user = {
  id: 4,
  username: 'maria',
  firstName: 'Maria',
  lastName: 'Clara',
};

const category = {
  id: 2,
  name: 'Pharmacy & Health',
  description: 'Medicines and wellness essentials',
};

const makeStore = (i: number, overrides: Partial<Establishment> = {}): Establishment => ({
  key: `google:p${i}`,
  source: 'google',
  name: `Pharmacy ${i}`,
  address: `Street ${i}, Tacurong`,
  latitude: 6.69,
  longitude: 124.68,
  placeId: null,
  googlePlaceId: `p${i}`,
  categoryId: 2,
  categoryName: 'Pharmacy & Health',
  distanceMeters: 500 - i * 30,
  orderedBefore: false,
  photoUrl: null,
  rating: 4.5,
  ratingCount: 50 + i,
  ...overrides,
});

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const draw = (selected?: Establishment) =>
  render(
    <MerchantCategoryStoresScreen
      navigation={navigation as any}
      route={{
        key: 'mcs',
        name: 'MerchantCategoryStores',
        params: { user, category, selected },
      } as any}
    />
  );

describe('MerchantCategoryStoresScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearNearbyEstablishmentCache();
  });

  it('renders Popular Stores (up to 10) with ratings, Nearby Stores sorted by distance, and All Category Stores in the unified unboxed StoreCard template with green distance highlights', async () => {
    const popularItems = Array.from({ length: 12 }, (_, idx) =>
      makeStore(idx + 1, {
        key: `google:pop${idx + 1}`,
        name: `Popular Pharmacy ${idx + 1}`,
        distanceMeters: 1300,
      })
    );
    const categoryItems = [
      makeStore(1, { key: 'catalogue:c1', source: 'catalogue', placeId: 'uuid-1', googlePlaceId: 'pop1', name: 'Popular Pharmacy 1', distanceMeters: 420, rating: null, ratingCount: null }),
      makeStore(2, { key: 'catalogue:c2', source: 'catalogue', placeId: 'uuid-2', googlePlaceId: 'pop2', name: 'Closest Pharmacy', distanceMeters: 90, rating: null, ratingCount: null }),
      makeStore(3, { key: 'catalogue:c3', source: 'catalogue', placeId: 'uuid-3', googlePlaceId: 'pop3', name: 'Mid Pharmacy', distanceMeters: 1300, rating: null, ratingCount: null }),
    ];

    (apiClient.get as jest.Mock).mockImplementation((url: string, config: any) => {
      if (url === '/places/establishments/popular') {
        expect(config?.params).toMatchObject({
          lat: 6.69,
          lng: 124.68,
          categoryId: 2,
          limit: 10,
        });
        return Promise.resolve({
          data: { google: 'ok', items: popularItems.slice(0, 10), hasMore: true },
        });
      }
      if (url === '/places/establishments') {
        expect(config?.params).toMatchObject({
          lat: 6.69,
          lng: 124.68,
          photos: 1,
          categoryId: 2,
        });
        return Promise.resolve({
          data: { google: 'ok', items: categoryItems, hasMore: false },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const res: any = await draw();

    expect(await res.findByTestId('category-popular-list')).toBeTruthy();
    expect(await res.findByTestId('category-nearby-list')).toBeTruthy();
    expect(res.getByText('Pharmacy & Health')).toBeTruthy();
    expect(res.getByText('Medicines and wellness essentials')).toBeTruthy();
    expect(res.getByText('Popular stores')).toBeTruthy();
    expect(res.getByText('Nearby stores')).toBeTruthy();
    expect(res.getByText('All Pharmacy & Health stores')).toBeTruthy();

    // Up to 10 popular stores rendered
    expect(res.getByTestId('category-popular-store-google:pop1')).toBeTruthy();
    expect(res.getByTestId('category-popular-store-google:pop10')).toBeTruthy();
    expect(res.queryByTestId('category-popular-store-google:pop11')).toBeNull();

    // Popular stores show their star rating chip (same template as Popular Stores screen)
    expect(res.getByTestId('category-popular-store-rating-google:pop1')).toBeTruthy();
    expect(res.getByText('4.5 (51)')).toBeTruthy();

    // Distance (e.g. 1.3 km) has green highlight (#065F46) matching Popular Stores screen
    const popDist = res.getByTestId('category-popular-store-distance-google:pop1');
    expect(popDist.props.children).toBe('1.3 km');
    expect(popDist.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#065F46' })])
    );
    const allDist = res.getByTestId('category-all-store-distance-catalogue:c3');
    expect(allDist.props.children).toBe('1.3 km');
    expect(allDist.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#065F46' })])
    );

    // Nearby stores sorted by ascending distanceMeters: Closest Pharmacy (90m) before Popular Pharmacy 1 (420m) before Mid Pharmacy (1300m)
    const nearbyRendered = res
      .getAllByTestId(/^category-nearby-store-catalogue:c\d+$/)
      .map((el: any) => el.props.testID);
    expect(nearbyRendered).toEqual([
      'category-nearby-store-catalogue:c2',
      'category-nearby-store-catalogue:c1',
      'category-nearby-store-catalogue:c3',
    ]);

    // 2026-10-14: the sideways rows use Home's fixed card width, not 58% of
    // the column, so a row shows two and a bit cards with room around them.
    const { StyleSheet } = require('react-native');
    const widthOf = (id: string) => StyleSheet.flatten(res.getByTestId(id).props.style).width;
    expect(widthOf('category-popular-store-google:pop1')).toBe(150);
    expect(widthOf('category-nearby-store-catalogue:c2')).toBe(150);

    // Merchant category description is smaller than the category title
    const descEl = res.getByTestId('merchant-category-stores-description');
    const titleEl = res.getByText('Pharmacy & Health');
    const descFontSize = descEl.props.style.find((s: any) => s?.fontSize)?.fontSize;
    const titleFontSize = titleEl.props.style.find((s: any) => s?.fontSize)?.fontSize;
    expect(descFontSize).toBeLessThan(titleFontSize);

    // Strictly no "From 20min" or fake discounts
    expect(res.queryByText(/From 20min/i)).toBeNull();
  });

  it('supports picking up to 3 stores across sections, deduplicates Google vs Catalogue entries (even with googlePlaceId: null and city/punctuation suffixes) while preserving placeId, blocks a 4th store, and proceeds to ErrandItems', async () => {
    const popularItems = [
      makeStore(1, {
        key: 'google:g-shared',
        source: 'google',
        placeId: null,
        googlePlaceId: 'g-shared',
        name: 'Mercury Drug - Tacurong City',
        latitude: 6.69,
        longitude: 124.68,
      }),
      makeStore(2, {
        key: 'google:g2',
        source: 'google',
        placeId: null,
        googlePlaceId: 'g2',
        name: 'Rose Pharmacy',
        latitude: 6.691,
        longitude: 124.681,
      }),
    ];
    const categoryItems = [
      makeStore(1, {
        key: 'catalogue:cat-shared',
        source: 'catalogue',
        placeId: 'verified-uuid-mercury',
        googlePlaceId: null, // Real server fromCatalogue() always sets googlePlaceId: null
        name: 'Mercury Drug',
        latitude: 6.6901,
        longitude: 124.6801,
      }),
      makeStore(3, {
        key: 'catalogue:cat-3',
        source: 'catalogue',
        placeId: 'verified-uuid-3',
        googlePlaceId: null,
        name: 'Southstar Drug',
        latitude: 6.692,
        longitude: 124.682,
      }),
      makeStore(4, {
        key: 'catalogue:cat-4',
        source: 'catalogue',
        placeId: 'verified-uuid-4',
        googlePlaceId: null,
        name: 'Generika Drugstore',
        latitude: 6.693,
        longitude: 124.683,
      }),
    ];

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/places/establishments/popular') {
        return Promise.resolve({ data: { google: 'ok', items: popularItems } });
      }
      if (url === '/places/establishments') {
        return Promise.resolve({ data: { google: 'ok', items: categoryItems } });
      }
      return Promise.resolve({ data: {} });
    });

    const res: any = await draw();
    await res.findByTestId('category-popular-store-google:g-shared');
    await res.findByTestId('category-all-store-catalogue:cat-shared');

    // Pick store 1 from Popular Stores (a Google result that matches a catalogue entry with googlePlaceId: null)
    await fireEvent.press(res.getByTestId('category-popular-store-google:g-shared'));
    expect(res.getByText('Proceed with this store (1)')).toBeTruthy();

    // Both the Popular item and the Catalogue item in Nearby/All show as selected
    expect(res.getByTestId('category-popular-store-google:g-shared').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(res.getByTestId('category-all-store-catalogue:cat-shared').props.accessibilityState).toEqual({
      selected: true,
    });

    // Pick store 2 from Popular Stores and store 3 from All Category Stores
    await fireEvent.press(res.getByTestId('category-popular-store-google:g2'));
    await fireEvent.press(res.getByTestId('category-all-store-catalogue:cat-3'));
    expect(res.getByText('Proceed with these stores (3)')).toBeTruthy();

    // Attempting to pick a 4th store shows the limit error banner and keeps count at 3
    await fireEvent.press(res.getByTestId('category-all-store-catalogue:cat-4'));
    expect(res.getByTestId('merchant-category-stores-limit-error')).toBeTruthy();
    expect(res.getByText('You can pick up to 3 stores for a single errand.')).toBeTruthy();

    // Proceed to ErrandItems: verified catalogue placeId is preserved for Mercury Drug
    await fireEvent.press(res.getByTestId('merchant-category-stores-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user,
      selectedCats: ['Mercury Drug - Tacurong City', 'Rose Pharmacy', 'Southstar Drug'],
      stores: [
        expect.objectContaining({
          name: 'Mercury Drug - Tacurong City',
          placeId: 'verified-uuid-mercury',
        }),
        expect.objectContaining({
          name: 'Rose Pharmacy',
          placeId: null,
        }),
        expect.objectContaining({
          name: 'Southstar Drug',
          placeId: 'verified-uuid-3',
        }),
      ],
    });
  });

  it('upgrades placeId when the user picks a Popular store BEFORE categorySearch.items finishes loading', async () => {
    let resolveCategorySearch!: (value: any) => void;
    const categorySearchPromise = new Promise((resolve) => {
      resolveCategorySearch = resolve;
    });

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/places/establishments/popular') {
        return Promise.resolve({
          data: {
            google: 'ok',
            items: [
              makeStore(1, {
                key: 'google:g-late',
                source: 'google',
                placeId: null,
                googlePlaceId: 'g-late',
                name: 'Mercury Drug - Tacurong',
                latitude: 6.69,
                longitude: 124.68,
              }),
            ],
          },
        });
      }
      if (url === '/places/establishments') {
        return categorySearchPromise;
      }
      return Promise.resolve({ data: {} });
    });

    const res: any = await draw();
    // Popular stores finishes first while categorySearch is still loading
    await res.findByTestId('category-popular-store-google:g-late');
    expect(res.getByTestId('category-all-loading')).toBeTruthy();

    // Tap the popular store before catalogue items arrive
    await fireEvent.press(res.getByTestId('category-popular-store-google:g-late'));
    expect(res.getByText('Proceed with this store (1)')).toBeTruthy();

    // Now categorySearch resolves with the matching catalogue store (googlePlaceId: null)
    resolveCategorySearch({
      data: {
        google: 'ok',
        items: [
          makeStore(1, {
            key: 'catalogue:cat-late',
            source: 'catalogue',
            placeId: 'verified-uuid-late',
            googlePlaceId: null,
            name: 'Mercury Drug',
            latitude: 6.6901,
            longitude: 124.68,
          }),
        ],
      },
    });

    await res.findByTestId('category-all-store-catalogue:cat-late');
    expect(res.getByTestId('category-all-store-catalogue:cat-late').props.accessibilityState).toEqual({
      selected: true,
    });

    await fireEvent.press(res.getByTestId('merchant-category-stores-proceed'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user,
      selectedCats: ['Mercury Drug - Tacurong'],
      stores: [
        expect.objectContaining({
          name: 'Mercury Drug - Tacurong',
          placeId: 'verified-uuid-late',
        }),
      ],
    });
  });

  it('handles error recovery and empty states gracefully', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network down'));
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network down'));

    const res: any = await draw();
    expect(await res.findByTestId('category-popular-error')).toBeTruthy();
    expect(await res.findByTestId('category-all-error')).toBeTruthy();

    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { google: 'ok', items: [] },
    });

    await fireEvent.press(res.getByTestId('category-popular-error-action'));
    await fireEvent.press(res.getByTestId('category-all-error-action'));

    await waitFor(() => {
      expect(res.getByTestId('category-popular-empty')).toBeTruthy();
      expect(res.getByTestId('category-all-empty')).toBeTruthy();
    });
  });

  it('strictly filters out stores from other merchant categories in Popular Stores, Nearby Stores, and All Category Stores', async () => {
    const mixedPopularItems: Establishment[] = [
      makeStore(1, {
        key: 'google:pop-pharmacy',
        name: 'Mercury Drug Tacurong',
        categoryId: 2,
        categoryName: 'Pharmacy & Health',
        rating: 4.8,
        ratingCount: 120,
      }),
      makeStore(2, {
        key: 'google:pop-bakery',
        name: "Rogelio's Bakery Café",
        categoryId: 4,
        categoryName: 'Bakery',
        rating: 4.9,
        ratingCount: 250,
      }),
      makeStore(3, {
        key: 'google:pop-cafe',
        name: 'Decent Cup Coffee Shop',
        categoryId: 8,
        categoryName: 'Cafe',
        rating: 4.7,
        ratingCount: 90,
      }),
      makeStore(4, {
        key: 'google:pop-convenience',
        name: '7-Eleven Tacurong',
        categoryId: 6,
        categoryName: 'Convenience Store',
        rating: 4.3,
        ratingCount: 60,
      }),
    ];

    const mixedCategoryItems: Establishment[] = [
      makeStore(10, {
        key: 'google:near-pharmacy-1',
        name: 'Rose Pharmacy',
        categoryId: 2,
        categoryName: 'Pharmacy & Health',
        distanceMeters: 250,
      }),
      makeStore(11, {
        key: 'google:near-restaurant',
        name: "Chiccoi's Diner",
        categoryId: 7,
        categoryName: 'Restaurant',
        distanceMeters: 100,
      }),
      makeStore(12, {
        key: 'google:near-retail',
        name: 'MR.DIY',
        categoryId: 5,
        categoryName: 'Retail & General Merchandise',
        distanceMeters: 150,
      }),
    ];

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/places/establishments/popular') {
        return Promise.resolve({ data: { google: 'ok', items: mixedPopularItems, hasMore: false } });
      }
      if (url === '/places/establishments') {
        return Promise.resolve({ data: { google: 'ok', items: mixedCategoryItems, hasMore: false } });
      }
      return Promise.resolve({ data: {} });
    });

    const res: any = await draw();
    expect(await res.findByTestId('category-popular-store-google:pop-pharmacy')).toBeTruthy();
    expect(await res.findByTestId('category-nearby-store-google:near-pharmacy-1')).toBeTruthy();
    expect(await res.findByTestId('category-all-store-google:near-pharmacy-1')).toBeTruthy();

    // Non-matching categories must NOT appear in Popular, Nearby, or All Category sections
    expect(res.queryByTestId('category-popular-store-google:pop-bakery')).toBeNull();
    expect(res.queryByTestId('category-popular-store-google:pop-cafe')).toBeNull();
    expect(res.queryByTestId('category-popular-store-google:pop-convenience')).toBeNull();
    expect(res.queryByTestId('category-nearby-store-google:near-restaurant')).toBeNull();
    expect(res.queryByTestId('category-nearby-store-google:near-retail')).toBeNull();
    expect(res.queryByTestId('category-all-store-google:near-restaurant')).toBeNull();
    expect(res.queryByTestId('category-all-store-google:near-retail')).toBeNull();
  });

  it('shows inline popular empty state while rendering unrated catalogue store in Nearby and All stores for custom owner category', async () => {
    const customCategory = {
      id: 42,
      name: 'Tacurong Pasalubong & Kakanin',
      description: 'Local delicacies and native treats',
    };
    const catalogueStore = makeStore(101, {
      key: 'catalogue:501',
      source: 'catalogue',
      name: 'Aling Nena Native Delicacies',
      categoryId: 42,
      categoryName: 'Tacurong Pasalubong & Kakanin',
      rating: null,
      ratingCount: null,
      distanceMeters: 310,
    });

    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/places/establishments/popular') {
        return Promise.resolve({ data: { google: 'ok', items: [], hasMore: false } });
      }
      if (url === '/places/establishments') {
        return Promise.resolve({ data: { google: 'ok', items: [catalogueStore], hasMore: false } });
      }
      return Promise.resolve({ data: {} });
    });

    const res: any = await render(
      <MerchantCategoryStoresScreen
        navigation={navigation as any}
        route={{
          key: 'mcs',
          name: 'MerchantCategoryStores',
          params: { user, category: customCategory },
        } as any}
      />,
    );

    expect(await res.findByTestId('category-popular-empty')).toBeTruthy();
    expect(await res.findByTestId('category-nearby-store-catalogue:501')).toBeTruthy();
    expect(await res.findByTestId('category-all-store-catalogue:501')).toBeTruthy();
  });

  it('matches plural/singular compound category names and rejects conflicting categoryName on colliding categoryId', () => {
    const restaurantStore = makeStore(1, {
      categoryId: 7,
      categoryName: 'Restaurant',
    });
    const cafeStore = makeStore(2, {
      categoryId: 8,
      categoryName: 'Cafe',
    });
    const collidingWrongStore = makeStore(3, {
      categoryId: 2,
      categoryName: 'Restaurant',
    });

    expect(
      doesEstablishmentMatchCategory(restaurantStore, 99, 'Restaurants & Cafes'),
    ).toBe(true);
    expect(
      doesEstablishmentMatchCategory(cafeStore, 99, 'Restaurants & Cafes'),
    ).toBe(true);
    expect(
      doesEstablishmentMatchCategory(collidingWrongStore, 2, 'Pharmacy & Health'),
    ).toBe(false);
  });
});

