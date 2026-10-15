import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

import AppNavigator from '../navigation/AppNavigator';

describe('AppNavigator Component', () => {
  it('renders initial route OnboardingLocation screen on fresh install', async () => {
    const res: any = await render(<AppNavigator />);

    expect(await res.findByText('Set your delivery location')).toBeTruthy();
    expect(res.getByText('Allow location access for:')).toBeTruthy();
    expect(res.getByText('Searching the best shops near you.')).toBeTruthy();
    expect(res.getByText('Receiving more accurate and faster delivery.')).toBeTruthy();
    expect(res.getByTestId('onboarding-location-continue-btn')).toBeTruthy();
    // Verify AnimatedSplashScreen is never rendered on fresh install
    expect(res.queryByText('SUGO EXPRESS')).toBeNull();
  });

  it('renders initial route Login screen for returning users', async () => {
    const asyncStorage = require('@react-native-async-storage/async-storage');
    asyncStorage.getItem.mockImplementation((key: string) => {
      if (key === '@sugo_customer_onboarding_completed') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    try {
      const res: any = await render(<AppNavigator />);

      expect(await res.findByText('Login')).toBeTruthy();
      expect(res.getByPlaceholderText('Enter your username or email')).toBeTruthy();
      expect(res.getByPlaceholderText('Enter your password')).toBeTruthy();
      expect(res.getByTestId('login-button')).toBeTruthy();
      expect(res.queryByText('Or Continue With')).toBeNull();
    } finally {
      asyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
    }
  });

  it('renders Login screen and does not show onboarding when user signs out with completed onboarding', async () => {
    const asyncStorage = require('@react-native-async-storage/async-storage');
    asyncStorage.getItem.mockImplementation((key: string) => {
      if (key === '@sugo_customer_onboarding_completed') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    try {
      const res: any = await render(<AppNavigator />);

      expect(await res.findByText('Login')).toBeTruthy();
      expect(res.queryByText('Set your delivery location')).toBeNull();
      expect(res.queryByText('Welcome to Sugo Express')).toBeNull();
    } finally {
      asyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
    }
  });

  it('renders system-nav-blur-dock on Android when 3-button navigation is active (insets.bottom >= 24)', async () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    const safeArea = require('react-native-safe-area-context');
    const originalUseInsets = safeArea.useSafeAreaInsets;
    safeArea.useSafeAreaInsets = () => ({ top: 24, left: 0, right: 0, bottom: 48 });

    try {
      const res: any = await render(<AppNavigator />);
      expect(res.getByTestId('system-nav-blur-dock')).toBeTruthy();
      const overlay = res.getByTestId('system-nav-blur-dock-overlay');
      const flattened = require('react-native').StyleSheet.flatten(overlay.props.style);
      expect(flattened.backgroundColor).toBe('rgba(255, 255, 255, 0.25)');
    } finally {
      require('react-native').Platform.OS = originalPlatform;
      safeArea.useSafeAreaInsets = originalUseInsets;
    }
  });

  it('renders system-nav-blur-dock overlay with 35% pure black in Dark Mode', async () => {
    const originalPlatform = require('react-native').Platform.OS;
    require('react-native').Platform.OS = 'android';

    const safeArea = require('react-native-safe-area-context');
    const originalUseInsets = safeArea.useSafeAreaInsets;
    safeArea.useSafeAreaInsets = () => ({ top: 24, left: 0, right: 0, bottom: 48 });

    const asyncStorage = require('@react-native-async-storage/async-storage');
    asyncStorage.getItem.mockImplementation((key: string) => {
      if (key === '@sugo_theme_mode') return Promise.resolve('dark');
      return Promise.resolve(null);
    });

    try {
      const res: any = await render(<AppNavigator />);
      const overlay = await res.findByTestId('system-nav-blur-dock-overlay');
      const flattened = require('react-native').StyleSheet.flatten(overlay.props.style);
      expect(flattened.backgroundColor).toBe('rgba(0, 0, 0, 0.35)');
    } finally {
      require('react-native').Platform.OS = originalPlatform;
      safeArea.useSafeAreaInsets = originalUseInsets;
      asyncStorage.getItem.mockImplementation(() => Promise.resolve(null));
    }
  });
});
