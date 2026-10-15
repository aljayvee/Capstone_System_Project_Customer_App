import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

let mockIsDark = false;

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

jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    user: {
      id: 1,
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '09123456789',
    },
    updateUser: jest.fn(),
  }),
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
    get: jest.fn((url?: string) => {
      if (url?.includes('/transactions')) {
        return Promise.resolve({
          data: {
            orders: [
              { id: 'err-1', orderId: 'err-1', status: 'PENDING', grandTotal: 50 },
              { id: 'err-2', orderId: 'err-2', status: 'IN_TRANSIT', grandTotal: 100 },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    }),
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

jest.mock('../firebase/config', () => ({
  database: {},
  auth: {},
  app: {},
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(() => ({})),
  push: jest.fn(() => Promise.resolve()),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  onDisconnect: jest.fn(() => ({ set: jest.fn(() => Promise.resolve()) })),
  onValue: jest.fn(() => jest.fn()),
  serverTimestamp: jest.fn(),
}));

jest.mock('../firebase/realtimeSession', () => ({
  ensureRealtimeSession: jest.fn(() => Promise.resolve()),
  renewRealtimeSession: jest.fn(() => Promise.resolve(true)),
  settleRealtimeSession: jest.fn(() => Promise.resolve(true)),
  endRealtimeSession: jest.fn(() => Promise.resolve()),
}));

jest.mock('../context/NetworkContext', () => ({
  NetworkProvider: ({ children }: any) => children,
  useNetworkStatus: () => ({
    isConnected: true,
    isSlow: false,
    justReconnected: false,
    retry: async () => {},
    reconnectCount: 0,
  }),
}));

jest.mock('../context/NotificationContext', () => ({
  NotificationProvider: ({ children }: any) => children,
  useNotifications: () => ({
    unreadCount: 0,
    notifications: [],
    refreshNotifications: jest.fn(),
  }),
}));

import HomeTab from '../screens/portal/HomeTab';
import EstablishmentPicker from '../components/pabili/EstablishmentPicker';
import ChatTab from '../screens/portal/ChatTab';
import ErrandsTab from '../screens/portal/ErrandsTab';
import ErrandItemsScreen from '../screens/ErrandItemsScreen';
import EditAccountScreen from '../screens/EditAccountScreen';
import ActiveErrandsScreen from '../screens/ActiveErrandsScreen';
import CustomerChatScreen from '../screens/CustomerChatScreen';

describe('Light Mode Crisp White Backgrounds & Neutral Slate Borders', () => {
  const mockUser = { id: 'cust-1', username: 'juan', firstName: 'Juan', lastName: 'Cruz' };
  const mockNavigation: any = { navigate: jest.fn(), goBack: jest.fn() };

  beforeEach(() => {
    mockIsDark = false;
    jest.clearAllMocks();
  });

  it('renders HomeTab sticky search bar and action button with crisp white background and neutral borders in Light Mode', async () => {
    mockIsDark = false;
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
    // The page is a soft grey since 2026-10-11 (theme bgAppTranslucent), as foodpanda and Grab use.
    expect(flattenedWrapperStyle.backgroundColor).toBe('rgba(246, 247, 248, 0.95)');

    const searchBar = res.getByTestId('home-store-search');
    const flattenedBarStyle = StyleSheet.flatten(searchBar.props.style);
    expect(flattenedBarStyle.backgroundColor).toBe('#FFFFFF');
    expect(flattenedBarStyle.borderColor).toBe('#E2E8F0');
    expect(flattenedBarStyle.borderTopColor).toBe('#FFFFFF');

    const searchAction = res.getByTestId('home-store-search-action');
    const flattenedActionStyle = StyleSheet.flatten(searchAction.props.style);
    expect(flattenedActionStyle.backgroundColor).toBe('#F1F5F9');
    expect(flattenedActionStyle.borderColor).toBe('#E2E8F0');
  });

  it('renders EstablishmentPicker search bar with crisp white and neutral border in Light Mode', async () => {
    mockIsDark = false;
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
    expect(flattened.backgroundColor).toBe('#FFFFFF');
    expect(flattened.borderColor).toBe('#E2E8F0');
    expect(flattened.borderTopColor).toBe('#FFFFFF');
  });

  it('renders ChatTab search bar with crisp white and neutral border in Light Mode', async () => {
    mockIsDark = false;
    const res: any = await render(<ChatTab user={mockUser} navigation={mockNavigation} />);

    const searchBar = res.getByTestId('chat-search-bar');
    const flattened = StyleSheet.flatten(searchBar.props.style);
    expect(flattened.backgroundColor).toBe('#FFFFFF');
    expect(flattened.borderColor).toBe('#E2E8F0');
    expect(flattened.borderTopColor).toBe('#FFFFFF');
  });

  it('renders ErrandsTab search bar with crisp white and neutral border in Light Mode', async () => {
    mockIsDark = false;
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
    expect(flattened.backgroundColor).toBe('#FFFFFF');
    expect(flattened.borderColor).toBe('#E2E8F0');
    expect(flattened.borderTopColor).toBe('#FFFFFF');
  });

  it('renders ErrandItems composeInput and stepper with crisp white and neutral border in Light Mode', async () => {
    mockIsDark = false;
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
    expect(flattenedInput.backgroundColor).toBe('#FFFFFF');
    expect(flattenedInput.borderColor).toBe('#E2E8F0');
    expect(flattenedInput.borderTopColor).toBe('#FFFFFF');

    const stepper = res.getByTestId('draft-stepper-Supermarket & Grocery');
    const flattenedStepper = StyleSheet.flatten(stepper.props.style);
    expect(flattenedStepper.backgroundColor).toBe('#FFFFFF');
    expect(flattenedStepper.borderColor).toBe('#E2E8F0');
    expect(flattenedStepper.borderTopColor).toBe('#FFFFFF');
  });

  it('renders EditAccount inputWrapper, phonePrefixBox, and phoneFieldWrapper with crisp white and neutral border in Light Mode', async () => {
    mockIsDark = false;
    const res: any = await render(
      <NavigationContainer>
        <EditAccountScreen
          navigation={mockNavigation}
          route={{ key: 'edit-account', name: 'EditAccount', params: { user: mockUser } } as any}
        />
      </NavigationContainer>
    );

    const firstNameWrapper = res.getByTestId('edit-first-name-wrapper');
    const flattenedFirstName = StyleSheet.flatten(firstNameWrapper.props.style);
    expect(flattenedFirstName.backgroundColor).toBe('#FFFFFF');
    expect(flattenedFirstName.borderColor).toBe('#E2E8F0');
    expect(flattenedFirstName.borderTopColor).toBe('#FFFFFF');

    const prefixBox = res.getByTestId('phone-prefix-box');
    const flattenedPrefix = StyleSheet.flatten(prefixBox.props.style);
    expect(flattenedPrefix.backgroundColor).toBe('#FFFFFF');
    expect(flattenedPrefix.borderColor).toBe('#E2E8F0');
    expect(flattenedPrefix.borderTopColor).toBe('#FFFFFF');

    const phoneWrapper = res.getByTestId('phone-field-wrapper');
    const flattenedPhone = StyleSheet.flatten(phoneWrapper.props.style);
    expect(flattenedPhone.backgroundColor).toBe('#FFFFFF');
    expect(flattenedPhone.borderColor).toBe('#E2E8F0');
    expect(flattenedPhone.borderTopColor).toBe('#FFFFFF');
  });

  it('renders ActiveErrands openBtn with crisp slate button and neutral border in Light Mode', async () => {
    mockIsDark = false;
    const res: any = await render(
      <ActiveErrandsScreen
        navigation={mockNavigation}
        route={{
          key: 'a',
          name: 'ActiveErrands',
          params: {
            user: mockUser,
            errands: [
              { id: 'err-1', orderId: 'err-1', status: 'PENDING', grandTotal: 50 },
              { id: 'err-2', orderId: 'err-2', status: 'IN_TRANSIT', grandTotal: 100 },
            ],
          },
        } as any}
      />
    );

    const openBtn = await res.findByTestId('active-errand-open-err-1');
    const flattenedOpenBtn = StyleSheet.flatten(openBtn.props.style);
    expect(flattenedOpenBtn.backgroundColor).toBe('#F1F5F9');
    expect(flattenedOpenBtn.borderColor).toBe('#E2E8F0');
  });

  it('renders CustomerChat inputWrapperPill with crisp white and neutral border in Light Mode', async () => {
    mockIsDark = false;
    const res: any = await render(
      <NavigationContainer>
        <CustomerChatScreen
          navigation={mockNavigation}
          route={{
            key: 'chat',
            name: 'CustomerChat',
            params: { user: mockUser, errandId: 'PABILI-123456', initialStatus: 'PENDING' },
          } as any}
        />
      </NavigationContainer>
    );

    const inputPill = res.getByTestId('chat-input-wrapper-pill');
    const flattenedPill = StyleSheet.flatten(inputPill.props.style);
    expect(flattenedPill.backgroundColor).toBe('#FFFFFF');
    expect(flattenedPill.borderColor).toBe('#E2E8F0');
    expect(flattenedPill.borderTopColor).toBe('#FFFFFF');
  });
});
