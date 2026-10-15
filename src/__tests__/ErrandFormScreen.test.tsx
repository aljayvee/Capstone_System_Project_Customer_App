import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import ErrandFormScreen from '../screens/ErrandFormScreen';
import { clearNearbyEstablishmentCache } from '../services/establishments';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({ data: { id: 'PABILI-TEST-123' } }),
    get: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

// The Location list centres on the customer's saved place. The real hook uses
// useFocusEffect, which throws outside a navigator.
jest.mock('../hooks/useDefaultDeliveryLocation', () => ({
  useDefaultDeliveryLocation: () => ({
    location: { address: 'Purok 5', latitude: 6.69, longitude: 124.68 },
    loading: false,
    failed: false,
    retry: jest.fn(),
  }),
}));

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('ErrandFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Pabili categories and enforces max 3 categories limit', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        selectedServices: ['Pabili'],
      },
    };

    const res: any = await render(
      <ErrandFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByTestId('pabili-section')).toBeTruthy();

    // Select 3 categories
    await fireEvent.press(res.getByTestId('category-card-Fast Food & Restaurant'));
    await fireEvent.press(res.getByTestId('category-card-Pharmacy & Health'));
    await fireEvent.press(res.getByTestId('category-card-Supermarket & Grocery'));

    // Attempt 4th category -> triggers limit error
    await fireEvent.press(res.getByTestId('category-card-Retail & General Merchandise'));
    expect(res.getByTestId('category-limit-error')).toBeTruthy();
  }, 15000);

  it('validates missing categories and continues to item entry with selected categories', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        selectedServices: ['Pabili'],
      },
    };

    const res: any = await render(
      <ErrandFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    // With nothing selected the form refuses to advance. It does this by
    // disabling the button rather than by erroring after the press, so the
    // press must be a no-op and no banner should appear.
    const submit = res.getByTestId('submit-errand-form-button');
    expect(submit.props.accessibilityState?.disabled ?? submit.props.disabled).toBe(true);
    await fireEvent.press(submit);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(res.queryByTestId('validation-error-banner')).toBeNull();

    // Select category
    await fireEvent.press(res.getByTestId('category-card-Pharmacy & Health'));

    // Continue with a valid selection -> hands off to the item-entry screen
    await fireEvent.press(res.getByTestId('submit-errand-form-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'ErrandItems',
      expect.objectContaining({
        user: mockRoute.params.user,
        selectedCats: ['Pharmacy & Health'],
      })
    );
  });
});

describe('ErrandFormScreen, Location', () => {
  const route: any = { params: { user: { id: 'u1', username: 'testuser' } } };
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
    distanceMeters: 350,
    ...extra,
  });
  let reply: () => Promise<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Find stores keeps its list (stale-while-revalidate): each test starts with none.
    clearNearbyEstablishmentCache();
    reply = () =>
      Promise.resolve({
        data: {
          google: 'ok',
          items: [
            store('g1', 'Mercury Drug', { orderedBefore: true }),
            store('g2', 'Mercury Drug', { latitude: 6.7 }),
            store('g3', 'Rose Pharmacy'),
            store('g4', 'Jollibee', { categoryName: 'Fast Food', categoryId: 1 }),
          ],
        },
      });
    (apiClient.get as jest.Mock).mockImplementation((url: string) =>
      url === '/places/establishments' ? reply() : Promise.resolve({ data: [] })
    );
  });

  it('lists the stores near the customer, with where the list comes from', async () => {
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={route} />);
    expect(res.getByText('Merchant Categories')).toBeTruthy();
    await fireEvent.press(res.getByTestId('store-mode-location'));
    await res.findByTestId('establishment-g1');
    expect(res.getByText('Stores')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith(
      '/places/establishments',
      // Photo cards since 2026-10-10: the list asks for photo addresses.
      // Find stores before typing (2026-10-14): featured brands first, ten at a time.
      expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1, featured: 1, limit: 10 } })
    );
    expect(res.getByTestId('google-attribution')).toBeTruthy();
    expect(res.getAllByText('Pharmacy · 350 m').length).toBeGreaterThan(0);
    // The distance is the part in green.
    const distance = res.getByTestId('establishment-distance-g1');
    expect(distance.props.children).toBe('350 m');
    expect(StyleSheet.flatten(distance.props.style).color).toBe('#065F46');
    // Why a store can rank above a closer one: the customer's own habit.
    expect(res.getByTestId('establishment-ordered-before-g1')).toBeTruthy();
    expect(res.queryByTestId('establishment-ordered-before-g3')).toBeNull();
  });

  it("opens on the Location list when Home's See all sends it there", async () => {
    const fromHome: any = { params: { ...route.params, initialMode: 'location' } };
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={fromHome} />);
    expect(await res.findByTestId('establishment-g1')).toBeTruthy();
    expect(res.queryByText('Merchant Categories')).toBeNull();
  });

  it('continues with the picked stores, two branches of one name kept apart', async () => {
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={route} />);
    await fireEvent.press(res.getByTestId('store-mode-location'));
    await fireEvent.press(await res.findByTestId('establishment-g1'));
    await fireEvent.press(res.getByTestId('establishment-g2'));
    await fireEvent.press(res.getByTestId('submit-errand-form-button'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ErrandItems', {
      user: route.params.user,
      selectedCats: ['Mercury Drug', 'Mercury Drug (2)'],
      stores: [
        expect.objectContaining({ key: 'Mercury Drug', name: 'Mercury Drug', categoryName: 'Pharmacy', placeId: null }),
        expect.objectContaining({ key: 'Mercury Drug (2)', latitude: 6.7 }),
      ],
    });
  });

  it('allows 3 stores, as it allows 3 categories', async () => {
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={route} />);
    await fireEvent.press(res.getByTestId('store-mode-location'));
    for (const key of ['g1', 'g2', 'g3']) await fireEvent.press(await res.findByTestId(`establishment-${key}`));
    await fireEvent.press(res.getByTestId('establishment-g4'));
    expect(res.getByTestId('category-limit-error')).toBeTruthy();
    expect(res.getByTestId('picked-stores')).toBeTruthy();
  });

  it('keeps the picks of each list when switching back to merchant categories', async () => {
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={route} />);
    await fireEvent.press(res.getByTestId('store-mode-location'));
    await fireEvent.press(await res.findByTestId('establishment-g1'));
    await fireEvent.press(res.getByTestId('store-mode-merchant'));
    expect(res.getByText('Choose a store to continue')).toBeTruthy();
    await fireEvent.press(res.getByTestId('store-mode-location'));
    expect(await res.findByText('Continue with 1 store')).toBeTruthy();
  });

  it('offers Try again when the list cannot load, and recovers', async () => {
    reply = () => Promise.reject(new Error('offline'));
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={route} />);
    await fireEvent.press(res.getByTestId('store-mode-location'));
    await res.findByTestId('establishment-error');
    reply = () => Promise.resolve({ data: { google: 'ok', items: [store('g1', 'Mercury Drug')] } });
    await fireEvent.press(res.getByTestId('establishment-retry'));
    expect(await res.findByTestId('establishment-g1')).toBeTruthy();
  });

  it('says when nothing matches, and when Google is not answering', async () => {
    reply = () => Promise.resolve({ data: { google: 'unavailable', items: [] } });
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={route} />);
    await fireEvent.press(res.getByTestId('store-mode-location'));
    await res.findByTestId('establishment-empty');
    expect(res.getByTestId('establishment-google-unavailable')).toBeTruthy();
    expect(res.queryByTestId('google-attribution')).toBeNull();
  });

  it('searches by name after a pause in typing', async () => {
    const res: any = await render(<ErrandFormScreen navigation={mockNavigation} route={route} />);
    await fireEvent.press(res.getByTestId('store-mode-location'));
    await res.findByTestId('establishment-g1');
    await fireEvent.changeText(res.getByTestId('establishment-search-input'), 'rose');
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        '/places/establishments',
        expect.objectContaining({ params: { q: 'rose', lat: 6.69, lng: 124.68, photos: 1 } })
      )
    );
    expect(res.getByText('Stores matching "rose"')).toBeTruthy();
  });
});
