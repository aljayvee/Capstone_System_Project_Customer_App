import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

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
            { id: 1, name: 'Supermarket & Grocery', status: 'Active' },
            { id: 2, name: 'Pharmacy & Health', status: 'Active' },
            { id: 3, name: 'Bakery & Pastries', status: 'Active' },
            { id: 4, name: 'Food & Restaurant', status: 'Active' },
            { id: 5, name: 'Retail & General Merchandise', status: 'Active' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
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
    // The categories hook caches at module scope so the grid and the "See More"
    // sheet share one fetch. Clear it between tests or the first test's list
    // satisfies the next one and the fetch under test never runs.
    __resetMerchantCategoriesCache();
  });

  it('renders recommended categories grid with all 6 quick-access buttons', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    expect(res.getByText('What would you like to buy?')).toBeTruthy();
    expect(res.getByTestId('category-btn-pabili')).toBeTruthy();
    expect(res.getByTestId('category-btn-malls')).toBeTruthy();
    expect(res.getByTestId('category-btn-pharmacy')).toBeTruthy();
    expect(res.getByTestId('category-btn-bakery')).toBeTruthy();
    expect(res.getByTestId('category-btn-restaurant')).toBeTruthy();
    expect(res.getByTestId('category-btn-see_more')).toBeTruthy();
  });

  it('navigates to ErrandForm when Pabili is pressed and opens MerchantCategoriesModal when See More is pressed', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    // Press Pabili -> Goes to ErrandForm
    await fireEvent.press(res.getByTestId('category-btn-pabili'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrandForm', {
      user: mockUser,
      selectedServices: ['Pabili'],
    });

    // Press See More -> Opens MerchantCategoriesModal collection
    await fireEvent.press(res.getByTestId('category-btn-see_more'));
    expect(res.getByText('Store & Merchant Categories')).toBeTruthy();

    // Selecting a category from the modal navigates directly to ErrandItems
    await fireEvent.press(res.getByTestId('merchant-category-card-Retail & General Merchandise'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user: mockUser,
      selectedCats: ['Retail & General Merchandise'],
    });
  });

  it('directly navigates to ErrandItems with chosen category when specific store button is pressed', async () => {
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
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user: mockUser,
      selectedCats: ['Pharmacy & Health'],
    });

    // Press Restaurant
    await fireEvent.press(res.getByTestId('category-btn-restaurant'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user: mockUser,
      selectedCats: ['Food & Restaurant'],
    });
  });

  it('renders active errand card with summary item box and status badge', async () => {
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={mockActiveErrand}
        recentErrands={mockRecentErrands}
        onViewTrack={jest.fn()}
      />
    );

    expect(res.getByText(/Active Errand/)).toBeTruthy();
    expect(res.getByText('Summary Item:')).toBeTruthy();
    expect(res.getByText(/2x Rice/)).toBeTruthy();
    expect(res.getByText('See more...')).toBeTruthy();
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
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Supermarket & Grocery', status: 'Active' },
        { id: 2, name: 'Food & Restaurant', status: 'Active' },
        { id: 3, name: 'Pharmacy & Health', status: 'Inactive' }, // Deactivated category
      ],
    });

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
  });

  it('renders prompt to set address for new customers with no saved locations, and renders formatted address when saved', async () => {
    // 1. New customer with NO address
    const emptyRes: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        defaultAddressText={null}
        defaultLocationLabel={null}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    expect(emptyRes.getByText('DELIVERING TO')).toBeTruthy();
    expect(emptyRes.getByText('+ Tap to set your delivery address')).toBeTruthy();
    expect(emptyRes.queryByText(/Poblacion, Tacurong City, Sultan Kudarat/)).toBeNull();
    // When recentErrands is empty, Recent Activity section is completely hidden
    expect(emptyRes.queryByText('Recent Activity')).toBeNull();

    // 2. Customer WITH saved address
    const savedRes: any = await render(
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

    expect(savedRes.getByText('DELIVERING TO')).toBeTruthy();
    expect(savedRes.getByText('Home • Barangay San Emmanuel, Tacurong City')).toBeTruthy();
    expect(savedRes.queryByText('Recent Activity')).toBeNull();
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
});


