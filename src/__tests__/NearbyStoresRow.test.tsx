import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import { clearNearbyEstablishmentCache, isPabiliEstablishment, isPabiliSearchQuery, searchEstablishments } from '../services/establishments';
import NearbyStoresRow from '../components/NearbyStoresRow';

/**
 * Home's "Stores near you": the server's ranked nearby list as a sideways row
 * of cards (2026-10-08). A card starts an order from that store; "See all"
 * opens step 1, the store search. Three cards since 2026-10-10.
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

const user = { id: 4, username: 'maria' };
const navigation = { navigate: jest.fn() };

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
  distanceMeters: 213,
  orderedBefore: false,
  ...extra,
});

const answer = (items: object[]) => Promise.resolve({ data: { google: 'ok', items } });

const draw = async (categoryImages: Record<number, string> = {}) =>
  render(<NearbyStoresRow user={user} navigation={navigation} categoryImages={categoryImages} contentWidth={360} />);

beforeEach(() => {
  jest.clearAllMocks();
  clearNearbyEstablishmentCache();
});

describe('Stores near you', () => {
  it('lists the ranked stores as cards, distance in green, with a See all card at the end', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(
      answer([
        store('g1', 'Mercury Drug Bonifacio', { orderedBefore: true }),
        store('g2', 'Rose Pharmacy', { distanceMeters: 1450, categoryName: null, categoryId: null }),
      ])
    );
    const res: any = await draw();

    expect(await res.findByTestId('nearby-store-g1')).toBeTruthy();
    // The Home row asks for photo addresses; step 1's list does not.
    expect(apiClient.get).toHaveBeenCalledWith(
      '/places/establishments',
      expect.objectContaining({ params: { lat: 6.69, lng: 124.68, photos: 1 } })
    );
    const distance = res.getByTestId('nearby-store-distance-g1');
    expect(distance.props.children).toBe('210 m');
    expect(StyleSheet.flatten(distance.props.style).color).toBe('#065F46');
    expect(res.getByTestId('nearby-store-distance-g2').props.children).toBe('1.4 km');
    // Why a store may sit ahead of a closer one: this customer's own habit.
    expect(res.getAllByText('Ordered before')).toHaveLength(1);
    expect(res.getByTestId('nearby-stores-see-all-card')).toBeTruthy();
  });

  it('opens Stores near you with the tapped store already picked, as Popular Stores does (2026-10-11)', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer([store('g1', 'Mercury Drug Bonifacio')]));
    const res: any = await draw();

    await fireEvent.press(await res.findByTestId('nearby-store-g1'));
    expect(navigation.navigate).toHaveBeenCalledWith('NearbyStores', {
      user,
      selected: expect.objectContaining({ key: 'g1', name: 'Mercury Drug Bonifacio' }),
    });
    expect(navigation.navigate).not.toHaveBeenCalledWith('ErrandItems', expect.anything());
  });

  it('shows three of the four stores the server sends', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(
      answer([store('g1', 'A'), store('g2', 'B'), store('g3', 'C'), store('g4', 'D')])
    );
    const res: any = await draw();

    expect(await res.findByTestId('nearby-store-g3')).toBeTruthy();
    expect(res.queryByTestId('nearby-store-g4')).toBeNull();
    expect(res.getByTestId('nearby-stores-see-all-card')).toBeTruthy();
  });

  it('opens Stores near you from the arrow and the See all card, as Popular Stores does', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer([store('g1', 'Mercury Drug')]));
    const res: any = await draw();
    await res.findByTestId('nearby-store-g1');

    await fireEvent.press(res.getByTestId('nearby-stores-see-all'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('NearbyStores', { user });
    await fireEvent.press(res.getByTestId('nearby-stores-see-all-card'));
    expect(navigation.navigate).toHaveBeenCalledTimes(2);
  });

  // 2026-10-13: the header's bare arrow became a "See all >" link, and a card
  // keeps one width on every phone, so a bigger screen shows more stores.
  it('labels the header link See all and keeps the card width on a wider phone', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer([store('g1', 'Mercury Drug')]));
    const widthAt = async (contentWidth: number) => {
      const res: any = await render(
        <NearbyStoresRow user={user} navigation={navigation} categoryImages={{}} contentWidth={contentWidth} />
      );
      const card = await res.findByTestId('nearby-store-g1');
      const width = StyleSheet.flatten(card.props.style).width;
      expect(res.getByText('See all')).toBeTruthy();
      await res.unmount();
      return width;
    };

    const onA04 = await widthAt(328); // 360 dp phone, 16 dp gutters
    const onBigPhone = await widthAt(380); // 412 dp phone
    expect(onA04).toBe(150);
    expect(onBigPhone).toBe(onA04);
  });

  it('says so and offers Try again when the stores cannot load', async () => {
    (apiClient.get as jest.Mock)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockReturnValueOnce(answer([store('g1', 'Mercury Drug')]));
    const res: any = await draw();

    await res.findByTestId('nearby-stores-error');
    await fireEvent.press(res.getByTestId('nearby-stores-error-action'));
    expect(await res.findByTestId('nearby-store-g1')).toBeTruthy();
  });

  it('explains an empty list and still offers a search', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer([]));
    const res: any = await draw();

    await res.findByTestId('nearby-stores-empty');
    await fireEvent.press(res.getByTestId('nearby-stores-empty-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('StoreSearch', { user });
  });

  it('does not ask Google again when the Home tab comes back within two minutes', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(answer([store('g1', 'Mercury Drug')]));
    const first: any = await draw();
    await first.findByTestId('nearby-store-g1');
    await first.unmount();

    const second: any = await draw();
    expect(await second.findByTestId('nearby-store-g1')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it("shows the shop's own photo, not its category's, with who took it", async () => {
    (apiClient.get as jest.Mock).mockReturnValue(
      answer([
        store('g1', 'Mercury Drug', {
          photoName: 'places/ChIJabc/photos/AWU5xyz',
          photoUrl: 'https://lh3.googleusercontent.com/places/AWU5xyz=w480',
          photoAttribution: 'Juan Dela Cruz',
        }),
      ])
    );
    const res: any = await draw({ 3: 'https://api.example.test/category/3.jpg' });

    await res.findByTestId('nearby-store-g1');
    // The address the server looked up, loaded as is: no header the image
    // loader might drop, and no Places key in the app.
    expect(res.getByTestId('nearby-store-photo-g1').props.source).toEqual({
      uri: 'https://lh3.googleusercontent.com/places/AWU5xyz=w480',
    });
    expect(res.queryByTestId('nearby-store-category-photo-g1')).toBeNull();
    expect(res.getByText('Photo: Juan Dela Cruz')).toBeTruthy();
    expect(res.queryByText('Places and photos from Google Maps')).toBeNull();
  });

  it('falls back directly to the category icon (without repeating the category photo) when a store photo will not load', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(
      answer([store('g1', 'Mercury Drug', { photoUrl: 'https://lh3.googleusercontent.com/places/expired' })])
    );
    const res: any = await draw({ 3: 'https://api.example.test/category/3.jpg' });

    await res.findByTestId('nearby-store-g1');
    await fireEvent(res.getByTestId('nearby-store-photo-g1'), 'error');
    expect(res.queryByTestId('nearby-store-category-photo-g1')).toBeNull();
    expect(res.getByTestId('nearby-store-icon-g1')).toBeTruthy();
  });

  it("uses the category icon (not a repeated category photo) when a store has no Google photo", async () => {
    (apiClient.get as jest.Mock).mockReturnValue(
      answer([store('c1', 'Rose Pharmacy', { source: 'catalogue', googlePlaceId: null, photoName: null })])
    );
    const res: any = await draw({ 3: 'https://api.example.test/category/3.jpg' });

    await res.findByTestId('nearby-store-c1');
    expect(res.queryByTestId('nearby-store-category-photo-c1')).toBeNull();
    expect(res.getByTestId('nearby-store-icon-c1')).toBeTruthy();
  });

  it('renders a grey user-friendly notice overlay and makes a closed store non-clickable', async () => {
    (apiClient.get as jest.Mock).mockReturnValue(
      answer([
        store('g-open', 'Mercury Drug', { isOpen: true }),
        store('g-opens-at', 'Night Bakery', { isOpen: false, closedReason: 'Opens at 5:30 AM' }),
        store('g-temp-closed', 'Holiday Cafe', { isOpen: false }),
      ])
    );
    const res: any = await draw();

    await res.findByTestId('nearby-store-g-opens-at');
    expect(res.queryByTestId('nearby-store-closed-overlay-g-open')).toBeNull();
    expect(res.getByTestId('nearby-store-closed-overlay-g-opens-at')).toBeTruthy();
    expect(res.getByText('Opens at 5:30 AM')).toBeTruthy();
    expect(res.getByTestId('nearby-store-closed-overlay-g-temp-closed')).toBeTruthy();
    expect(res.getByText('Temporarily Unavailable')).toBeTruthy();

    await fireEvent.press(res.getByTestId('nearby-store-g-opens-at'));
    expect(navigation.navigate).not.toHaveBeenCalled();

    await fireEvent.press(res.getByTestId('nearby-store-g-open'));
    expect(navigation.navigate).toHaveBeenCalledWith('NearbyStores', {
      user,
      selected: expect.objectContaining({ key: 'g-open' }),
    });
  });

  it("hides stores and shows 'Sugo Express isn't in your area yet.' when customer location is outside Tacurong", async () => {
    (apiClient.get as jest.Mock).mockReturnValue(
      Promise.resolve({ data: { google: 'ok', items: [], outsideServiceArea: true, hasMore: false } })
    );
    const res: any = await draw();

    await res.findByTestId('nearby-stores-empty');
    expect(res.getByText("Sugo Express isn't in your area yet.")).toBeTruthy();
    await fireEvent.press(res.getByTestId('nearby-stores-empty-action'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerLocation', { user });
  });

  it('filters out non-Pabili queries and establishments (Police outpost/Stations, Government offices, Network, Internet Cafe, Nightclub, Logistics, Express)', async () => {
    (apiClient.get as jest.Mock).mockClear();
    for (const q of [
      'Police outpost',
      'Stations',
      'Government offices',
      'Network',
      'Internet Cafe',
      'Nightclub',
      'Logistics',
      'Express',
    ]) {
      expect(isPabiliSearchQuery(q)).toBe(false);
      const res = await searchEstablishments({ q });
      expect(res.items).toEqual([]);
    }
    expect(apiClient.get).not.toHaveBeenCalled();

    expect(isPabiliEstablishment(store('s1', 'Tacurong City Police Station'))).toBe(false);
    expect(isPabiliEstablishment(store('s2', 'PNP Outpost'))).toBe(false);
    expect(isPabiliEstablishment(store('s3', 'Tacurong City Hall'))).toBe(false);
    expect(isPabiliEstablishment(store('s4', 'BIR Tacurong Office'))).toBe(false);
    expect(isPabiliEstablishment(store('s5', 'Sultan Kudarat Cable Network'))).toBe(false);
    expect(isPabiliEstablishment(store('s6', 'TNC Internet Cafe'))).toBe(false);
    expect(isPabiliEstablishment(store('s7', 'Neon Nightclub & Bar'))).toBe(false);
    expect(isPabiliEstablishment(store('s8', 'Fast Cargo Logistics'))).toBe(false);
    expect(isPabiliEstablishment(store('s9', 'J&T Express Tacurong'))).toBe(false);
    expect(isPabiliEstablishment(store('s10', 'Aquabest Water Station'))).toBe(true);
    expect(isPabiliEstablishment(store('s11', 'Mercury Drug'))).toBe(true);
  });
});
