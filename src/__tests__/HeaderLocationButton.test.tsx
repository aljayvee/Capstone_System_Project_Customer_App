import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { HeaderLocationButton, headerLocationText } from '../components/home/HeaderLocationButton';

// Light by default, as the hook falls back to outside a ThemeProvider.
let mockDark = false;
jest.mock('../hooks/useThemeColor', () => {
  const { LightColors, DarkColors } = jest.requireActual('../config/theme');
  return {
    useThemeColor: () => ({
      colors: mockDark ? DarkColors : LightColors,
      isDark: mockDark,
      themeMode: mockDark ? 'dark' : 'light',
      colorScheme: mockDark ? 'dark' : 'light',
      setThemeMode: async () => {},
    }),
  };
});
afterEach(() => {
  mockDark = false;
});

/**
 * The Home header's location button (2026-10-11): it took the Help "?"'s place
 * and the "Delivering to" card's job, and with it the new customer's "set your
 * delivery location first" spotlight.
 */

describe('the header location button', () => {
  it("shows where errands go: the saved location's name, else its address, else a prompt", () => {
    expect(headerLocationText('Home', 'Barangay San Emmanuel, Tacurong City')).toBe('Home');
    expect(headerLocationText(null, 'Barangay San Emmanuel, Tacurong City')).toBe('Barangay San Emmanuel, Tacurong City');
    expect(headerLocationText('  ', '')).toBe('Set address');
  });

  it('reads "Delivering to" and the place, and opens Saved Locations', async () => {
    const onPress = jest.fn();
    const res: any = await render(<HeaderLocationButton label="Home" address="Barangay San Emmanuel" onPress={onPress} />);

    expect(res.getByText('Delivering to')).toBeTruthy();
    expect(res.getByTestId('header-location-text').props.children).toBe('Home');
    expect(res.getByTestId('header-location-btn').props.accessibilityLabel).toBe(
      'Delivering to Home. Change your delivery address'
    );
    await fireEvent.press(res.getByTestId('header-location-btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('asks a customer with no address to set one', async () => {
    const res: any = await render(<HeaderLocationButton label={null} address={null} onPress={jest.fn()} />);
    expect(res.getByText('Set address')).toBeTruthy();
    expect(res.getByTestId('header-location-btn').props.accessibilityLabel).toBe('Set your delivery address');
  });

  it('spotlights itself for a customer with no saved location, and only then', async () => {
    const onPress = jest.fn();
    const required: any = await render(
      <HeaderLocationButton label={null} address={null} onPress={onPress} requireLocation />
    );
    await waitFor(() => expect(required.getByText('Set your delivery location first')).toBeTruthy(), { timeout: 3000 });
    await fireEvent.press(required.getByTestId('location-required-set'));
    expect(onPress).toHaveBeenCalledTimes(1);

    const saved: any = await render(<HeaderLocationButton label="Home" address="Purok 5" onPress={jest.fn()} />);
    expect(saved.queryByText('Set your delivery location first')).toBeNull();
  });
});

describe('light mode looks (2026-10-11)', () => {
  // The pin turned brand pink again on 2026-10-14, when the button moved to
  // lead the header as foodpanda's address does; the chip itself stays unfilled.
  it('has no pink chip fill, and a pink pin now that it leads the header', async () => {
    const { StyleSheet } = require('react-native');
    const res: any = await render(<HeaderLocationButton label="Home" address="Purok 5" onPress={jest.fn()} />);
    const chip = StyleSheet.flatten(res.getByTestId('header-location-btn').props.style);
    expect(chip.backgroundColor).toBe('transparent');
    expect(chip.borderColor).toBe('transparent');
    const tree = JSON.stringify(res.toJSON());
    expect(tree).not.toContain('#FFF5F7');
    expect(tree).toContain('#F62459');
  });

  // 2026-10-14: dark mode drew a grey box behind the address; light did not.
  it('has no box in dark mode either', async () => {
    const { StyleSheet } = require('react-native');
    mockDark = true;
    const res: any = await render(<HeaderLocationButton label="Home" address="Purok 5" onPress={jest.fn()} />);
    const chip = StyleSheet.flatten(res.getByTestId('header-location-btn').props.style);
    expect(chip.backgroundColor).toBe('transparent');
    expect(chip.borderColor).toBe('transparent');
  });

  it('is not capped narrow, so a long address uses the header and truncates', async () => {
    const { StyleSheet } = require('react-native');
    const res: any = await render(
      <HeaderLocationButton label="Purok 5, Barangay San Pablo, Tacurong City" onPress={jest.fn()} />
    );
    expect(StyleSheet.flatten(res.getByTestId('header-location-btn').props.style).maxWidth).toBeUndefined();
    expect(res.getByTestId('header-location-text').props.numberOfLines).toBe(1);
  });
});
