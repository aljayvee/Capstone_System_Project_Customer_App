import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { StoreCard } from '../components/stores/StoreCard';
import type { Establishment } from '../services/establishments';
import { PortalFontSizeMultipliers } from '../config/portalTypography';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../services/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const store: Establishment = {
  key: 'verified-store',
  source: 'catalogue',
  name: '7-Eleven Tacurong City National Highway Branch',
  address: 'National Highway, Tacurong City',
  latitude: 6.69,
  longitude: 124.68,
  isVerified: true,
  placeId: null,
  googlePlaceId: null,
  categoryId: 1,
  categoryName: 'Convenience Store',
  distanceMeters: 230,
};

describe('Store identity on narrow cards and full-width lists', () => {
  it.each([134, 150, 328, 548])('allows the complete name to wrap at %i dp', async (width) => {
    const onPress = jest.fn();
    const screen = await render(
      <StoreCard store={store} onPress={onPress} categoryImages={{}} width={width}
        imageHeight={75} selectable testIDPrefix="store" />
    );
    const name = screen.getByText(store.name);
    expect(name.props.numberOfLines).toBeUndefined();
    expect(name.props.maxFontSizeMultiplier).toBe(PortalFontSizeMultipliers.card);
    expect(StyleSheet.flatten(name.props.style).alignSelf).toBe('stretch');
    // The verification badge sits below the name instead of using its width.
    expect(StyleSheet.flatten(name.parent!.props.style).flexDirection).not.toBe('row');
    expect(screen.getByText('VERIFIED').props.maxFontSizeMultiplier).toBe(PortalFontSizeMultipliers.label);
    expect(screen.getByText(store.address).props.numberOfLines).toBe(2);
    await fireEvent.press(screen.getByTestId('store-verified-store'));
    expect(onPress).toHaveBeenCalledWith(store);
  });
});
