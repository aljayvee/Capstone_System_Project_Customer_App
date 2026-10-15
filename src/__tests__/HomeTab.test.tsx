import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/socketClient', () => ({
  // The Bento grid must render from HTTP alone; realtime only keeps it current.
  // Stubbed with a socket that never emits so these tests exercise the fetch
  // path deterministically.
  getSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn() })),
  subscribeToErrand: jest.fn(),
  unsubscribeFromErrand: jest.fn(),
  resetSocket: jest.fn(),
}));

jest.mock('../services/apiClient', () => ({
  getCustomerToken: jest.fn(() => null),
  refreshCustomerSession: jest.fn(() => Promise.resolve('token')),
  SECURE_TOKEN_KEY: 'sugo_customer_jwt_token',
  STORAGE_KEY_TOKEN_FALLBACK: '@sugo_customer_jwt_token',
  apiClient: {
    get: jest.fn((url: string) => {
      if (url === '/merchant-categories') {
        return Promise.resolve({
          data: [
            { id: 1, name: 'Supermarket & Grocery', description: 'Fresh produce and pantry staples', status: 'Active' },
            { id: 2, name: 'Pharmacy & Health', description: 'Medicines and wellness essentials', status: 'Active' },
            { id: 3, name: 'Bakery & Pastries', description: 'Freshly baked bread and cakes', status: 'Active' },
            { id: 4, name: 'Food & Restaurant', description: 'Local meals and dining', status: 'Active' },
            { id: 5, name: 'Retail & General Merchandise', description: 'Everyday household goods', status: 'Active' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

// "Stores near you" centres on the customer's saved place. The real hook uses
// useFocusEffect, which throws outside a navigator. The row itself is covered
// in NearbyStoresRow.test.tsx.
jest.mock('../hooks/useDefaultDeliveryLocation', () => ({
  useDefaultDeliveryLocation: () => ({
    location: { address: 'Purok 5', latitude: 6.69, longitude: 124.68 },
    loading: false,
    failed: false,
    retry: jest.fn(),
  }),
}));

jest.mock('../hooks/useRateConfig', () => ({
  useRateConfig: () => ({
    baseFee: 50,
    rateConfig: { baseFee: 50, perKmRate: 10 },
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

import HomeTab from '../screens/portal/HomeTab';
import { __resetMerchantCategoriesCache } from '../hooks/useMerchantCategories';
import { apiClient } from '../services/apiClient';

const mockUser = {
  id: 'cust-123',
  username: 'juandelacruz',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
};

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockActiveErrand = {
  id: 101,
  orderId: 'SGO-A12B45',
  status: 'PENDING',
  categories: 'Pabili Shopping Request',
  items: [
    { name: 'Rice (5kg)', quantity: 2 },
    { name: 'Fresh Milk', quantity: 1 },
    { name: 'Tray of Eggs', quantity: 3 },
  ],
  totalCost: 150,
  grandTotal: 150,
};

const mockRecentErrands = [
  {
    id: 1,
    orderId: 'SGO-78F901',
    status: 'COMPLETED',
    categories: 'Food & Restaurant',
    items: [{ name: 'Burger Meal', quantity: 1 }],
    grandTotal: 120,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    orderId: 'SGO-65C432',
    status: 'DELIVERED',
    categories: 'Pharmacy & Health',
    items: [{ name: 'Paracetamol', quantity: 2 }],
    grandTotal: 250,
    createdAt: new Date().toISOString(),
  },
];

jest.setTimeout(30000);

describe('HomeTab Revamped UI/UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetMerchantCategoriesCache();
  });

  it('renders Explore merchants categories as an unboxed vertical list with all active categories and descriptions', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    expect(res.queryByText('What would you like to buy?')).toBeNull();
    expect(res.queryByTestId('category-btn-pabili')).toBeNull();
    expect(res.getByTestId('home-store-search')).toBeTruthy();
    expect(res.getByTestId('nearby-stores')).toBeTruthy();
    expect(res.getByText('Stores near you')).toBeTruthy();
    expect(res.getByText('Explore merchants categories')).toBeTruthy();
    expect(res.queryByText('Merchant Categories')).toBeNull();

    const tree = JSON.stringify(res.toJSON());
    const at = (marker: string) => tree.indexOf(marker);
    expect(at('"popular-stores"')).toBeLessThan(at('"nearby-stores"'));
    expect(at('"nearby-stores"')).toBeLessThan(at('"Explore merchants categories"'));
    expect(at('"Explore merchants categories"')).toBeLessThan(at('"category-btn-pharmacy"'));

    expect(res.getByTestId('explore-merchants-categories-list')).toBeTruthy();
    expect(res.getByTestId('category-btn-malls')).toBeTruthy();
    expect(res.getByTestId('category-btn-pharmacy')).toBeTruthy();
    expect(res.getByTestId('category-btn-bakery')).toBeTruthy();
    expect(res.getByTestId('category-btn-restaurant')).toBeTruthy();
    expect(res.getByTestId('category-btn-retail')).toBeTruthy();
    expect(res.getByText('Fresh produce and pantry staples')).toBeTruthy();
    expect(res.getByText('Medicines and wellness essentials')).toBeTruthy();
    // Merchant category description must have a smaller font size than the merchant category name
    const catTitleStyle = StyleSheet.flatten(res.getByText('Pharmacy & Health').props.style);
    const catDescStyle = StyleSheet.flatten(res.getByTestId('category-desc-pharmacy').props.style);
    expect(catDescStyle.fontSize).toBeLessThan(catTitleStyle.fontSize);
    // Bento "See More" tile is removed because all active categories are shown in the vertical list
    expect(res.queryByTestId('category-btn-see_more')).toBeNull();
    expect(res.queryByText(/From 20min/i)).toBeNull();
  });

  it('opens the store search from the Search button', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    await fireEvent.press(res.getByTestId('home-store-search'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('StoreSearch', { user: mockUser });
  });

  it("opens MerchantCategoryStores when a category row is pressed", async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    // Press Pharmacy
    await fireEvent.press(res.getByTestId('category-btn-pharmacy'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MerchantCategoryStores', {
      user: mockUser,
      category: {
        id: 2,
        name: 'Pharmacy & Health',
        description: 'Medicines and wellness essentials',
      },
    });

    // Press Restaurant
    await fireEvent.press(res.getByTestId('category-btn-restaurant'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MerchantCategoryStores', {
      user: mockUser,
      category: {
        id: 4,
        name: 'Food & Restaurant',
        description: 'Local meals and dining',
      },
    });
  });

  it('shows active errands as a liquid glass button that opens Active Errands, not as a card (2026-10-10)', async () => {
    const second = { ...mockActiveErrand, id: 102, orderId: 'SGO-C34D56', status: 'IN_TRANSIT' };
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={mockActiveErrand}
        activeErrands={[mockActiveErrand, second, mockRecentErrands[0]]}
        recentErrands={mockRecentErrands}
        onViewTrack={jest.fn()}
      />
    );

    // The old card is gone.
    expect(res.queryByText(/Active Errand #/)).toBeNull();
    expect(res.queryByText('Summary Item:')).toBeNull();
    // The button counts the active ones only.
    expect(res.getByTestId('active-errands-fab-count')).toBeTruthy();
    expect(res.getByText('2')).toBeTruthy();

    await fireEvent.press(res.getByTestId('active-errands-fab'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ActiveErrands', {
      user: mockUser,
      errands: [mockActiveErrand, second],
    });
  });

  it('leaves the active errands button out when nothing is active', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        activeErrands={[]}
        recentErrands={mockRecentErrands}
        onViewTrack={jest.fn()}
      />
    );
    expect(res.queryByTestId('active-errands-fab')).toBeNull();
  });

  it('renders recent activity with DELIVERED status badge for fulfilled orders and supports navigation', async () => {
    const onNavigateErrands = jest.fn();

    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={mockRecentErrands}
        onViewTrack={jest.fn()}
        onNavigateErrands={onNavigateErrands}
      />
    );

    expect(res.getByText('Recent Activity')).toBeTruthy();
    // In consumer view, completed status is displayed as humanized Delivered
    expect(res.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);

    // Tap navigate arrow
    await fireEvent.press(res.getByTestId('navigate-my-errands'));
    expect(onNavigateErrands).toHaveBeenCalledTimes(1);
  });

  it('dynamically hides category buttons when deactivated by the owner in the backend', async () => {
    // Answered by address, not as "the next call": Home makes several requests
    // on mount (the account reminder's profile among them), in no fixed order.
    const defaultGet = (apiClient.get as jest.Mock).getMockImplementation()!;
    (apiClient.get as jest.Mock).mockImplementation((url: string) =>
      url === '/merchant-categories'
        ? Promise.resolve({
            data: [
              { id: 1, name: 'Supermarket & Grocery', status: 'Active' },
              { id: 2, name: 'Food & Restaurant', status: 'Active' },
              { id: 3, name: 'Pharmacy & Health', status: 'Inactive' }, // Deactivated category
            ],
          })
        : defaultGet(url)
    );

    try {
      const res: any = await render(
        <HomeTab
          user={mockUser}
          navigation={mockNavigation}
          activeErrand={null}
          recentErrands={[]}
          onViewTrack={jest.fn()}
        />
      );

      // Active categories are rendered
      expect(res.getByTestId('category-btn-malls')).toBeTruthy();
      expect(res.getByTestId('category-btn-restaurant')).toBeTruthy();

      // Deactivated category is HIDDEN
      expect(res.queryByTestId('category-btn-pharmacy')).toBeNull();
    } finally {
      (apiClient.get as jest.Mock).mockImplementation(defaultGet);
    }
  });

  it('floats the search bar above the page and leaves the address to the header (2026-10-11)', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        defaultAddressText="Barangay San Emmanuel, Tacurong City"
        defaultLocationLabel="Home"
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    // Fixed over the page rather than a sticky row of it, so it never scrolls away.
    const slot = StyleSheet.flatten(res.getByTestId('home-sticky-search').props.style);
    expect(slot).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0 });
    // The "Delivering to" card is gone from Home.
    expect(res.queryByTestId('home-location-pill')).toBeNull();
    expect(res.queryByText('DELIVERING TO')).toBeNull();
    expect(res.queryByText(/Barangay San Emmanuel/)).toBeNull();
  });

  it('hides Recent Activity when no past orders exist and displays it once orders are present', async () => {
    // Hidden when empty
    const noOrdersRes: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );
    expect(noOrdersRes.queryByText('Recent Activity')).toBeNull();

    // Visible when orders exist
    const hasOrdersRes: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={mockRecentErrands}
        onViewTrack={jest.fn()}
      />
    );
    expect(hasOrdersRes.getByText('Recent Activity')).toBeTruthy();
  });

  it('renders RECOMMENDED badges for the first 4 merchant categories and omits for subsequent categories', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    await waitFor(() => {
      // First 4 categories have RECOMMENDED badge
      expect(res.getByTestId('category-badge-recommended-malls')).toBeTruthy();
      expect(res.getByTestId('category-badge-recommended-pharmacy')).toBeTruthy();
      expect(res.getByTestId('category-badge-recommended-bakery')).toBeTruthy();
      expect(res.getByTestId('category-badge-recommended-restaurant')).toBeTruthy();

      // 5th category does not have RECOMMENDED badge
      expect(res.queryByTestId('category-badge-recommended-retail')).toBeNull();
    });
  });

});

