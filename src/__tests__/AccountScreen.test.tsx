import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '09123456789',
    },
    logout: jest.fn(),
    updateUser: jest.fn(),
  }),
}));

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    colors: {
      primary: '#F62459',
      bgApp: '#F8F9FA',
      card: '#FFFFFF',
      textDark: '#1E293B',
      textGray: '#64748B',
      textMedium: '#475569',
      textLight: '#94A3B8',
      border: '#E2E8F0',
      danger: '#EF4444',
      bgGray: '#F1F5F9',
    },
    isDark: false,
  }),
}));

jest.mock('../components/MapPreviewField', () => () => null);
jest.mock('../components/ConfirmModal', () => () => null);

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

import AccountScreen from '../screens/AccountScreen';

describe('AccountScreen Component', () => {
  const focusListeners: Array<() => void> = [];
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn((event: string, listener: () => void) => {
      if (event === 'focus') focusListeners.push(listener);
      return jest.fn();
    }),
  };

  const mockRoute: any = {
    params: {
      user: {
        id: 1,
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '09123456789',
      },
    },
  };

  it('renders dedicated navigation header with back button and settings gear', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Account & Profile')).toBeTruthy();
    expect(res.getByTestId('back-button')).toBeTruthy();
    expect(res.getByTestId('account-settings-gear-button')).toBeTruthy();
  });

  it('calls goBack when header back button is pressed', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const backBtn = res.getByTestId('back-button');
    fireEvent.press(backBtn);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('navigates to Settings when gear button is pressed', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const settingsBtn = res.getByTestId('account-settings-gear-button');
    fireEvent.press(settingsBtn);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Settings', expect.anything());
  });

  // Saved locations come from the shared cache since 2026-10-14. Coming back
  // from Saved Locations (the screen never unmounted) needs no new request: a
  // default changed there is in the same cache, and shows here at once.
  describe('the default pin, from the shared saved-locations cache', () => {
    const { act, waitFor } = require('@testing-library/react-native');
    const { __resetCacheForTests, readCache, writeCache } = require('../services/swrCache');
    const { savedLocationsKey } = require('../hooks/useSavedLocations');
    const HOME = { id: 1, userId: 1, label: 'Home', address: 'Purok 5, Tacurong', latitude: 6.69, longitude: 124.68, isDefault: true, createdAt: '' };
    const WORK = { id: 2, userId: 1, label: 'Work', address: 'Poblacion, Tacurong', latitude: 6.7, longitude: 124.69, isDefault: false, createdAt: '' };

    beforeEach(() => {
      __resetCacheForTests();
      const { apiClient } = require('../services/apiClient');
      apiClient.get.mockImplementation((url: string) =>
        Promise.resolve({ data: url === '/customer-locations/1' ? [HOME, WORK] : [] })
      );
    });

    const locationCalls = () => {
      const { apiClient } = require('../services/apiClient');
      return apiClient.get.mock.calls.filter(([url]: [string]) => url === '/customer-locations/1').length;
    };

    it('shows a default changed in Saved Locations on return, without asking again', async () => {
      focusListeners.length = 0;
      const res: any = await render(<AccountScreen navigation={mockNavigation} route={mockRoute} />);
      await waitFor(() => expect(res.getAllByText('Home').length).toBeGreaterThan(0));
      expect(res.queryByText('Work')).toBeNull();
      const before = locationCalls();

      // Saved Locations makes Work the default (an optimistic write to the cache).
      await act(async () => {
        writeCache(savedLocationsKey(1), [{ ...HOME, isDefault: false }, { ...WORK, isDefault: true }]);
      });
      focusListeners.forEach((listener) => listener());

      await waitFor(() => expect(res.getAllByText('Work').length).toBeGreaterThan(0));
      expect(locationCalls()).toBe(before);
    });

    it('asks again on return once the list is over a minute old', async () => {
      focusListeners.length = 0;
      const res: any = await render(<AccountScreen navigation={mockNavigation} route={mockRoute} />);
      await waitFor(() => expect(res.getAllByText('Home').length).toBeGreaterThan(0));
      const before = locationCalls();

      readCache(savedLocationsKey(1)).at = 0;
      await act(async () => {
        focusListeners.forEach((listener) => listener());
      });

      expect(locationCalls()).toBe(before + 1);
    });
  });

  it('navigates to EditAccount when Edit Profile Details is pressed', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const editBtn = res.getByTestId('edit-profile-button');
    fireEvent.press(editBtn);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('EditAccount', expect.anything());
  });

  // 2026-10-14: the photo and the name lead the screen. The name was 16 pt, the
  // same as the screen title, the stats and every section heading.
  it('makes the full name the largest text on the screen, under a large photo', async () => {
    const { StyleSheet } = require('react-native');
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const name = res.getByTestId('profile-full-name');
    expect(name.props.children.join('')).toBe('John Doe');
    const nameSize = StyleSheet.flatten(name.props.style).fontSize;

    const sizes: number[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Text' && node !== name) {
        const size = StyleSheet.flatten(node.props.style)?.fontSize;
        // The initials sit inside the photo, which is larger still.
        if (typeof size === 'number' && node.props.children !== 'JD') sizes.push(size);
      }
      (node.children ?? []).forEach(walk);
    };
    walk(res.container);

    expect(sizes.length).toBeGreaterThan(5);
    expect(nameSize).toBeGreaterThan(Math.max(...sizes));
    expect(StyleSheet.flatten(res.getByText('Account & Profile').props.style).fontSize).toBeLessThan(nameSize);
    expect(StyleSheet.flatten(res.getByTestId('profile-photo-button').props.style).width).toBeGreaterThanOrEqual(96);
  });
});
