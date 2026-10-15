import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

let mockIsDark = true;

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => {
    const { LightColors, DarkColors } = require('../config/theme');
    return {
      colors: mockIsDark ? DarkColors : LightColors,
      isDark: mockIsDark,
    };
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn() })),
  subscribeToErrand: jest.fn(),
  unsubscribeFromErrand: jest.fn(),
  resetSocket: jest.fn(),
}));

jest.mock('../services/apiClient', () => ({
  getCustomerToken: jest.fn(() => null),
  refreshCustomerSession: jest.fn(() => Promise.resolve('token')),
  SECURE_TOKEN_KEY: 'sugo_customer_jwt_token',
  STORAGE_KEY_TOKEN_FALLBACK: '@sugo_customer_jwt_token',
  apiClient: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

jest.mock('../hooks/useDefaultDeliveryLocation', () => ({
  useDefaultDeliveryLocation: () => ({
    location: { address: 'Purok 5', latitude: 6.69, longitude: 124.68 },
    loading: false,
    failed: false,
    retry: jest.fn(),
  }),
}));

jest.mock('../hooks/useRateConfig', () => ({
  useRateConfig: () => ({
    baseFee: 50,
    rateConfig: { baseFee: 50, perKmRate: 10 },
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: () => null,
}));

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style }: any) => <View style={style}>{children}</View>,
    BlurTargetView: ({ children, style }: any) => <View style={style}>{children}</View>,
  };
});

import HomeTab from '../screens/portal/HomeTab';
import BottomNav from '../components/BottomNav';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import EstablishmentPicker from '../components/pabili/EstablishmentPicker';
import ChatTab from '../screens/portal/ChatTab';
import ErrandsTab from '../screens/portal/ErrandsTab';
import ErrandItemsScreen from '../screens/ErrandItemsScreen';

describe('Dark Mode Neutral Frosted Substrates & Pure Black Backdrop', () => {
  const mockUser = { id: 'cust-1', username: 'juan', firstName: 'Juan', lastName: 'Cruz' };
  const mockNavigation: any = { navigate: jest.fn(), goBack: jest.fn() };

  beforeEach(() => {
    mockIsDark = true;
    jest.clearAllMocks();
  });

  it('renders HomeTab sticky search bar with pure black backdrop and neutral frosted substrate in Dark Mode', async () => {
    mockIsDark = true;
    const res: any = await render(
      <HomeTab
        user={mockUser}
        navigation={mockNavigation}
        activeErrand={null}
        recentErrands={[]}
        onViewTrack={jest.fn()}
      />
    );

    const stickyWrapper = res.getByTestId('home-sticky-search');
    const flattenedWrapperStyle = StyleSheet.flatten(stickyWrapper.props.style);
    // A soft charcoal since 2026-10-11 (theme bgAppTranslucent), not pure black.
    expect(flattenedWrapperStyle.backgroundColor).toBe('rgba(18, 18, 18, 0.95)');

    const searchBar = res.getByTestId('home-store-search');
    const flattenedBarStyle = StyleSheet.flatten(searchBar.props.style);
    expect(flattenedBarStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
    expect(flattenedBarStyle.shadowColor).toBe('#000000');

    const searchAction = res.getByTestId('home-store-search-action');
    const flattenedActionStyle = StyleSheet.flatten(searchAction.props.style);
    expect(flattenedActionStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.10)');
    expect(flattenedActionStyle.borderColor).toBe('rgba(255, 255, 255, 0.14)');
  });

  it('renders EstablishmentPicker search bar with neutral frosted glass and black shadow in Dark Mode', async () => {
    mockIsDark = true;
    const res: any = await render(
      <EstablishmentPicker
        userId="cust-1"
        category={null}
        selected={[]}
        onToggle={jest.fn()}
      />
    );

    const searchBar = res.getByTestId('establishment-search-bar');
    const flattened = StyleSheet.flatten(searchBar.props.style);
    expect(flattened.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
    expect(flattened.shadowColor).toBe('#000000');
  });

  it('renders ChatTab search bar with neutral frosted glass and black shadow in Dark Mode', async () => {
    mockIsDark = true;
    const res: any = await render(<ChatTab user={mockUser} navigation={mockNavigation} />);

    const searchBar = res.getByTestId('chat-search-bar');
    const flattened = StyleSheet.flatten(searchBar.props.style);
    expect(flattened.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
    expect(flattened.shadowColor).toBe('#000000');
  });

  it('renders ErrandsTab search bar with neutral frosted glass and black shadow in Dark Mode', async () => {
    mockIsDark = true;
    const res: any = await render(
      <ErrandsTab
        user={mockUser}
        navigation={mockNavigation}
        errands={[]}
        loading={false}
        onRefresh={jest.fn()}
        onViewTrack={jest.fn()}
      />
    );

    const searchBar = res.getByTestId('errands-search-bar');
    const flattened = StyleSheet.flatten(searchBar.props.style);
    expect(flattened.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
    expect(flattened.shadowColor).toBe('#000000');
  });

  it('renders BottomNav floating capsule with neutral dark charcoal in Dark Mode and optical white in Light Mode', async () => {
    mockIsDark = true;
    const darkRes: any = await render(
      <BottomNav active="home" onChange={jest.fn()} onPabiliPress={jest.fn()} />
    );

    const darkCapsule = darkRes.getByTestId('bottom-nav-capsule');
    const darkFlattened = StyleSheet.flatten(darkCapsule.props.style);
    expect(darkFlattened.backgroundColor).toBe('rgba(20, 20, 22, 0.90)');
    expect(darkFlattened.shadowColor).toBe('#000000');

    mockIsDark = false;
    const lightRes: any = await render(
      <BottomNav active="home" onChange={jest.fn()} onPabiliPress={jest.fn()} />
    );

    const lightCapsule = lightRes.getByTestId('bottom-nav-capsule');
    const lightFlattened = StyleSheet.flatten(lightCapsule.props.style);
    // Liquid, not frosted, glass in light mode (2026-10-11): the capsule is
    // clear and the thin glass inside it lets the page show through.
    expect(lightFlattened.backgroundColor).toBe('transparent');
    expect(lightFlattened.shadowColor).toBe('#0F172A');
    const liquidTint = StyleSheet.flatten(lightRes.getByTestId('bottom-nav-glass-tint').props.style);
    expect(liquidTint.backgroundColor).toBe('rgba(255, 255, 255, 0.42)');
    // Dark mode keeps its own solid charcoal glass.
    expect(darkRes.queryByTestId('bottom-nav-glass')).toBeNull();
  });

  it('renders LiquidGlass with neutral dark charcoal tint in Dark Mode', async () => {
    mockIsDark = true;
    const res: any = await render(
      <LiquidGlass radius={20} elevated testID="test-glass" />
    );

    const tintView = res.getByTestId('test-glass-tint');
    const flattenedTint = StyleSheet.flatten(tintView.props.style);
    // On test environment, blurs is active (android with mock)
    expect(flattenedTint.backgroundColor).toMatch(/rgba\(20, 20, 22,/);

    const containerView = res.getByTestId('test-glass');
    const flattenedContainer = StyleSheet.flatten(containerView.props.style);
    expect(flattenedContainer.shadowColor).toBe('#000000');
  });

  it('renders ErrandItems composeInput and stepper with neutral frosted substrate and black shadow in Dark Mode', async () => {
    mockIsDark = true;
    const res: any = await render(
      <NavigationContainer>
        <ErrandItemsScreen
          navigation={mockNavigation}
          route={{ key: 'errand-items', name: 'ErrandItems', params: { user: mockUser, selectedCats: ['Supermarket & Grocery'] } } as any}
        />
      </NavigationContainer>
    );

    const input = res.getByTestId('item-name-input-Supermarket & Grocery');
    const flattenedInput = StyleSheet.flatten(input.props.style);
    expect(flattenedInput.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
    expect(flattenedInput.shadowColor).toBe('#000000');

    const stepper = res.getByTestId('draft-stepper-Supermarket & Grocery');
    const flattenedStepper = StyleSheet.flatten(stepper.props.style);
    expect(flattenedStepper.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
    expect(flattenedStepper.shadowColor).toBe('#000000');
  });
});
