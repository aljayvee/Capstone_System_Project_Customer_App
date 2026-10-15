import React from 'react';
import { render, act } from '@testing-library/react-native';

const mockGetItem = jest.fn((key: string): Promise<string | null> => Promise.resolve(null));
const mockSetItem = jest.fn((key: string, val: string): Promise<null> => Promise.resolve(null));
const mockRemoveItem = jest.fn((key: string): Promise<null> => Promise.resolve(null));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, val: string) => mockSetItem(key, val),
  removeItem: (key: string) => mockRemoveItem(key),
}));

jest.useFakeTimers();

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(() => Promise.resolve({ data: { orders: [] } })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() =>
    Promise.resolve({
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    })
  ),
}));

jest.mock('../firebase/location', () => ({
  saveCustomerLocation: jest.fn(() => Promise.resolve()),
}));

jest.mock('../hooks/useRegisterPushToken', () => ({
  useRegisterPushToken: jest.fn(),
}));

jest.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ unreadCount: 0, syncActiveErrands: jest.fn() }),
}));

const mockUser = { id: 42, firstName: 'Maria', lastName: 'Clara', username: 'mariaclara' };

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'fake-token',
  }),
}));

// Mock child tabs to isolate transition behavior
jest.mock('../screens/portal/HomeTab', () => {
  const { View, Text } = require('react-native');
  return () => (
    <View testID="mock-home-tab">
      <Text>Home Tab</Text>
    </View>
  );
});

jest.mock('../screens/portal/ErrandsTab', () => () => null);
jest.mock('../screens/portal/TrackTab', () => () => null);
jest.mock('../screens/portal/ChatTab', () => () => null);

import CustomerPortalScreen from '../screens/CustomerPortalScreen';

describe('CustomerPortalScreen - Onboarding Location Transition', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => () => {}),
    isFocused: jest.fn(() => true),
  };

  const detectedLocation = {
    latitude: 6.6981,
    longitude: 124.6823,
    address: 'Gaisano Mall, Tacurong City',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockImplementation(() => Promise.resolve(null));
  });

  it('waits 2000ms then auto-navigates to CustomerLocation Step 2 when route parameter is set', async () => {
    await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{
          params: {
            user: { id: 42, firstName: 'Maria' },
            triggerOnboardingLocationSetup: true,
            detectedLocation,
          },
        } as any}
      />
    );

    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('CustomerLocation', expect.anything());

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomerLocation', {
      user: expect.objectContaining({ id: 42 }),
      initialMode: 'wizard',
      initialStep: 2,
      detectedLocation,
    });
  });

  it('recovers pending onboarding flag and draft from AsyncStorage across auth stack remount', async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === '@sugo_pending_onboarding_location_setup') return Promise.resolve('true');
      if (key === '@sugo_onboarding_location_draft') return Promise.resolve(JSON.stringify(detectedLocation));
      return Promise.resolve(null);
    });

    await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{
          params: {
            user: { id: 42, firstName: 'Maria' },
          },
        } as any}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRemoveItem).toHaveBeenCalledWith('@sugo_pending_onboarding_location_setup');

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomerLocation', {
      user: expect.objectContaining({ id: 42 }),
      initialMode: 'wizard',
      initialStep: 2,
      detectedLocation,
    });
  });

  it('gracefully navigates to Step 1 (Pin Picker) when GPS was not detected during onboarding', async () => {
    await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{
          params: {
            user: { id: 42, firstName: 'Maria' },
            triggerOnboardingLocationSetup: true,
            detectedLocation: undefined,
          },
        } as any}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomerLocation', {
      user: expect.objectContaining({ id: 42 }),
      initialMode: 'wizard',
      initialStep: 1,
      detectedLocation: undefined,
    });
  });

  it('does NOT trigger onboarding location navigation for standard existing customer session', async () => {
    await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{
          params: {
            user: { id: 42, firstName: 'Maria' },
          },
        } as any}
      />
    );

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('CustomerLocation', expect.anything());
  });
});
