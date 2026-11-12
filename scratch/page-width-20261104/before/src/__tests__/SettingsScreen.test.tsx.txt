import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockSetThemeMode = jest.fn();
const mockLogout = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve(null);
    }),
    removeItem: jest.fn((k: string) => {
      store.delete(k);
      return Promise.resolve(null);
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve(null);
    }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Modal = ({ children, visible }: any) => (visible ? children : null);
  return RN;
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
    logout: mockLogout,
  }),
}));

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    themeMode: 'light',
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
    setThemeMode: mockSetThemeMode,
  }),
}));

import SettingsScreen from '../screens/SettingsScreen';

describe('SettingsScreen Component', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const mockRoute: any = {
    params: {
      user: {
        id: 1,
        username: 'johndoe',
        email: 'john@example.com',
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('renders top navigation header and navigates back when pressed', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('App Settings')).toBeTruthy();
    const backBtn = res.getByTestId('back-button');
    await fireEvent.press(backBtn);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('uses accessible appearance rows and switches all three themes', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByRole('radio', { name: 'Light theme' }).props.accessibilityState.checked).toBe(true);
    for (const mode of ['light', 'dark', 'system']) {
      await fireEvent.press(res.getByTestId('theme-option-' + mode));
      expect(mockSetThemeMode).toHaveBeenLastCalledWith(mode);
    }
  });

  it('renders notification toggles', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Live Delivery Updates')).toBeTruthy();
    expect(res.getByText('Dispatcher & Rider Messages')).toBeTruthy();
    expect(res.getByText('Audible In-App Chimes')).toBeTruthy();
    expect(res.getByTestId('switch-errand-alerts')).toBeTruthy();
    expect(res.getByTestId('switch-chat-alerts')).toBeTruthy();
    expect(res.getByTestId('switch-sound-effects')).toBeTruthy();
  });

  it('renders security section and opens change password modal', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.queryByText('Location Access')).toBeNull();
    expect(res.queryByText('While In Use')).toBeNull();
    expect(res.queryByText('Active Device Session')).toBeNull();
    expect(res.queryByText('Biometric App Lock')).toBeNull();
    expect(res.queryByText('Deactivate Account')).toBeNull();

    const changePasswordRow = res.getByTestId('row-change-password');
    await fireEvent.press(changePasswordRow);

    await waitFor(() => {
      expect(res.getByText('Reset Password')).toBeTruthy();
    });

    await fireEvent.press(res.getByText('Cancel'));
    await waitFor(() => {
      expect(res.queryByText('Reset Password')).toBeNull();
    });
  });

  it('omits placeholder storage and operations controls', async () => {
    const res = await render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(res.queryByText('Local Storage Footprint')).toBeNull();
    expect(res.queryByTestId('clear-cache-button')).toBeNull();
    expect(res.queryByText('Tacurong Operations Hub')).toBeNull();
    expect(res.queryByText('Operational')).toBeNull();
  });

  it('opens the full Terms of Service and Privacy Policy screens', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    // waitFor, not a bare expect: the screen's mount effects are still
    // settling, and a test that ends inside them overlaps the next test's act().
    await fireEvent.press(res.getByTestId('row-terms'));
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('LegalDocument', { doc: 'terms' });
    });

    await fireEvent.press(res.getByTestId('row-privacy'));
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('LegalDocument', { doc: 'privacy' });
    });

    // The short in-place modals are gone; their text contradicted the policy.
    expect(res.queryByText('I Understand')).toBeNull();
    expect(res.queryByText('1. Location Telemetry Protection')).toBeNull();
  });

  it('keeps sign out in Account and opens real support and update actions', async () => {
    const res = await render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    expect(res.queryByTestId('row-sign-out')).toBeNull();
    expect(res.queryByText('Sign Out')).toBeNull();
    await fireEvent.press(res.getByTestId('row-app-version'));
    expect(await res.findByText('Application Updates')).toBeTruthy();
    await fireEvent.press(res.getByLabelText('Close Updates'));
    await fireEvent.press(res.getByTestId('row-feedback'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Feedback', { user: mockRoute.params.user });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('restores saved notification choices and persists changes', async () => {
    await AsyncStorage.setItem('@sugo_customer_errand_alerts_enabled', 'false');
    await AsyncStorage.setItem('@sugo_customer_chat_alerts_enabled', 'false');
    await AsyncStorage.setItem('@sugo_customer_sounds_enabled', 'false');
    const res = await render(<SettingsScreen navigation={mockNavigation} route={mockRoute} />);
    for (const [id, key] of [
      ['errand-alerts', '@sugo_customer_errand_alerts_enabled'],
      ['chat-alerts', '@sugo_customer_chat_alerts_enabled'],
      ['sound-effects', '@sugo_customer_sounds_enabled'],
    ]) {
      const toggle = res.getByTestId('switch-' + id);
      await waitFor(() => expect(toggle.props.value).toBe(false));
      await fireEvent(toggle, 'valueChange', true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, 'true');
      await waitFor(() => expect(res.getByTestId('switch-' + id).props.value).toBe(true));
    }
  });
});
