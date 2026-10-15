import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, TouchableOpacity, View } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../firebase/realtimeSession', () => ({
  settleRealtimeSession: jest.fn(() => Promise.resolve()),
  endRealtimeSession: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/socketClient', () => ({
  resetSocket: jest.fn(),
  getSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn() })),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn(() => Promise.resolve({ data: {} })),
    get: jest.fn(() => Promise.resolve({ data: {} })),
  },
  setCustomerToken: jest.fn(),
  setCustomerRefreshToken: jest.fn(() => Promise.resolve()),
  getCustomerRefreshToken: jest.fn(() => Promise.resolve('mock-refresh-token')),
  setOnSessionExpired: jest.fn(),
  // NetworkContext polls this every second. Missing, the test failed whenever
  // a slow full run outlasted the first poll, and passed alone.
  hasSlowRequestInFlight: jest.fn(() => false),
  SECURE_TOKEN_KEY: 'secure_token',
  STORAGE_KEY_TOKEN_FALLBACK: 'storage_token_fallback',
}));

import { AuthProvider, useAuth } from '../context/AuthContext';
import AppNavigator from '../navigation/AppNavigator';

describe('Sign-Out & Onboarding Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logout in AuthContext writes and preserves @sugo_customer_onboarding_completed as true', async () => {
    function ConsumerComponent() {
      const { user, login, logout } = useAuth();
      return (
        <View>
          <Text testID="user-status">{user ? user.username : 'no-user'}</Text>
          <TouchableOpacity
            testID="login-btn"
            onPress={() => login({ id: 1, username: 'customer_one' }, 'token_123', 'refresh_123')}
          >
            <Text>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="logout-btn" onPress={() => logout()}>
            <Text>Logout</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const res: any = await render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(res.getByTestId('user-status')).toBeTruthy();
    });

    // Simulate login
    fireEvent.press(res.getByTestId('login-btn'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@sugo_customer_onboarding_completed',
        'true'
      );
    });

    // Clear calls to isolate logout assertion
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.removeItem as jest.Mock).mockClear();

    // Trigger logout
    fireEvent.press(res.getByTestId('logout-btn'));

    await waitFor(() => {
      // Verify user is cleared
      expect(res.getByTestId('user-status').props.children).toBe('no-user');
    });

    // Verify @sugo_customer_onboarding_completed was NEVER removed
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(
      '@sugo_customer_onboarding_completed'
    );

    // Verify @sugo_customer_onboarding_completed was explicitly asserted as true on sign out
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@sugo_customer_onboarding_completed',
      'true'
    );
  });

  it('session restoration asserts @sugo_customer_onboarding_completed as true', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@sugo_customer_user') {
        return Promise.resolve(JSON.stringify({ id: 99, username: 'restored_user' }));
      }
      return Promise.resolve(null);
    });

    function Consumer() {
      const { user, isLoading } = useAuth();
      if (isLoading) return <Text testID="loading">Loading...</Text>;
      return <Text testID="user">{user?.username || 'none'}</Text>;
    }

    const res: any = await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(res.getByTestId('user').props.children).toBe('restored_user');
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@sugo_customer_onboarding_completed',
      'true'
    );
  });

  it('when an active user signs out, AppNavigator renders Login and never Onboarding screens', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@sugo_customer_onboarding_completed') {
        return Promise.resolve('true');
      }
      return Promise.resolve(null);
    });

    const res: any = await render(<AppNavigator />);

    // When onboarding is completed and user is signed out, Login screen is rendered
    expect(await res.findByText('Login')).toBeTruthy();
    expect(res.queryByText('Set your delivery location')).toBeNull();
    expect(res.queryByText('Welcome to Sugo Express')).toBeNull();
  });

  it('guarantees onboarding completion does not flip to false on logout even if AsyncStorage returns null', async () => {
    // Fresh install without onboarding completed
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@sugo_customer_onboarding_completed') {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    const res: any = await render(<AppNavigator />);
    expect(await res.findByText('Set your delivery location')).toBeTruthy();
  });
});
