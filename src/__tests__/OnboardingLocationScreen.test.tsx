import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import * as SplashScreen from 'expo-splash-screen';
import OnboardingLocationScreen from '../screens/onboarding/OnboardingLocationScreen';

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('../hooks/useReverseGeocodedAddress', () => ({
  resolveCoordinateToAddress: jest.fn(() => Promise.resolve('San Roque, Tacurong City')),
}));

describe('OnboardingLocationScreen', () => {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides native system splash screen immediately on mount', async () => {
    await render(<OnboardingLocationScreen navigation={navigation} />);
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('renders required copy and explanation points', async () => {
    const res: any = await render(<OnboardingLocationScreen navigation={navigation} />);

    expect(res.getByText('Set your delivery location')).toBeTruthy();
    expect(res.getByText('Allow location access for:')).toBeTruthy();
    expect(res.getByText('Searching the best shops near you.')).toBeTruthy();
    expect(res.getByText('Receiving more accurate and faster delivery.')).toBeTruthy();
    expect(res.getByTestId('onboarding-location-continue-btn')).toBeTruthy();
  });

  it('detects GPS and navigates to OnboardingAuthChoice when permission is granted', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
      coords: { latitude: 6.69, longitude: 124.68 },
    });

    const res: any = await render(<OnboardingLocationScreen navigation={navigation} />);

    await fireEvent.press(res.getByTestId('onboarding-location-continue-btn'));

    await waitFor(() => {
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(navigation.navigate).toHaveBeenCalledWith('OnboardingAuthChoice', {
        detectedLocation: {
          latitude: 6.69,
          longitude: 124.68,
          address: 'San Roque, Tacurong City',
        },
      });
    });
  });

  it('gracefully navigates with undefined location when permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    const res: any = await render(<OnboardingLocationScreen navigation={navigation} />);

    await fireEvent.press(res.getByTestId('onboarding-location-continue-btn'));

    await waitFor(() => {
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(navigation.navigate).toHaveBeenCalledWith('OnboardingAuthChoice', {
        detectedLocation: undefined,
      });
    });
  });
});
