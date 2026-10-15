import React from 'react';
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders top navigation header and navigates back when pressed', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('App Settings')).toBeTruthy();
    const backBtn = res.getByTestId('back-button');
    fireEvent.press(backBtn);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('renders 3-card appearance selector and handles theme switching', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    const darkCard = res.getByTestId('theme-card-dark');
    fireEvent.press(darkCard);
    expect(mockSetThemeMode).toHaveBeenCalledWith('dark');
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

    expect(res.getByText('Location Access')).toBeTruthy();
    expect(res.getByText('While In Use')).toBeTruthy();
    expect(res.getByText('Active Device Session')).toBeTruthy();
    expect(res.queryByText('Biometric App Lock')).toBeNull();
    expect(res.queryByText('Deactivate Account')).toBeNull();

    const changePasswordRow = res.getByTestId('row-change-password');
    fireEvent.press(changePasswordRow);

    await waitFor(() => {
      expect(res.getByText('Reset Password')).toBeTruthy();
    });

    fireEvent.press(res.getByText('Cancel'));
    await waitFor(() => {
      expect(res.queryByText('Reset Password')).toBeNull();
    });
  });

  it('renders storage footprint card and allows clearing cache', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Local Storage Footprint')).toBeTruthy();
    const clearBtn = res.getByTestId('clear-cache-button');
    expect(clearBtn).toBeTruthy();

    fireEvent.press(clearBtn);

    await waitFor(() => {
      expect(res.getByText('Cache is Clean (0.0 MB)')).toBeTruthy();
    });
  });

  it('opens the full Terms of Service and Privacy Policy screens', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    // waitFor, not a bare expect: the screen's mount effects are still
    // settling, and a test that ends inside them overlaps the next test's act().
    fireEvent.press(res.getByTestId('row-terms'));
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('LegalDocument', { doc: 'terms' });
    });

    fireEvent.press(res.getByTestId('row-privacy'));
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('LegalDocument', { doc: 'privacy' });
    });

    // The short in-place modals are gone; their text contradicted the policy.
    expect(res.queryByText('I Understand')).toBeNull();
    expect(res.queryByText('1. Location Telemetry Protection')).toBeNull();
  });

  it('opens sign out modal with inverted hierarchy and handles logout', async () => {
    const res: any = await render(
      <SettingsScreen navigation={mockNavigation} route={mockRoute} />
    );

    const signOutRow = await res.findByTestId('row-sign-out');
    fireEvent.press(signOutRow);

    await waitFor(() => {
      expect(res.getByText('Stay Signed In')).toBeTruthy();
      expect(res.getByText('Yes, Sign Out')).toBeTruthy();
    });

    const confirmSignOut = res.getByTestId('confirm-modal-submit');
    fireEvent.press(confirmSignOut);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
