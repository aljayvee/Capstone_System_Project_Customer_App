import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

/**
 * Screens pushed on the portal that send the customer back to one of its tabs
 * (2026-11-06). In React Navigation 7 a plain navigate('CustomerPortal')
 * reuses the portal only when it is the focused screen; from a screen on top
 * of it, it pushed a second portal. Each copy kept its sockets, polling and
 * back handler, and replayed the last tapped push (PushTapBackNavigation).
 * These run the real screens in a real native stack and look at the stack.
 */

jest.setTimeout(60000);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

const mockMarkAsRead = jest.fn(async () => undefined);
jest.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: 3,
        type: 'RIDER_NEARBY',
        title: 'Your rider is almost there',
        body: 'Within 500m.',
        category: 'DELIVERY',
        needsYou: true,
        errandId: 'e-2',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ],
    unreadCount: 1,
    loading: false,
    error: false,
    markAsRead: mockMarkAsRead,
    markAllAsRead: jest.fn(async () => undefined),
    refreshNotifications: jest.fn(async () => undefined),
    syncActiveErrands: jest.fn(),
  }),
}));

const mockUser = { id: 1, username: 'johndoe', firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '09123456789' };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: jest.fn(), updateUser: jest.fn() }),
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
import NotificationScreen from '../screens/Notification';

// The portal itself is covered by its own suites; here it only shows the
// params it was sent back with.
function PortalStandIn({ route }: any) {
  return <Text testID="portal-params">{JSON.stringify({ tab: route.params?.initialTab, errand: route.params?.focusedErrandId })}</Text>;
}

const Stack = createNativeStackNavigator<any>();

const renderOn = async (screen: 'Account' | 'Notification') => {
  const navRef = createNavigationContainerRef<any>();
  const res: any = await render(
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerPortal" component={PortalStandIn} initialParams={{ user: mockUser }} />
        <Stack.Screen name="Account" component={AccountScreen as any} />
        <Stack.Screen name="Notification" component={NotificationScreen as any} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  await waitFor(() => expect(navRef.isReady()).toBe(true));
  await act(async () => {
    navRef.navigate(screen, { user: mockUser });
  });
  await waitFor(() => expect(navRef.getCurrentRoute()?.name).toBe(screen));
  const stack = () => navRef.getRootState()?.routes.map((r: any) => r.name) ?? [];
  const portalParams = () => {
    const portal = navRef.getRootState()?.routes.find((r: any) => r.name === 'CustomerPortal');
    return { tab: (portal?.params as any)?.initialTab, errand: (portal?.params as any)?.focusedErrandId };
  };
  return { res, navRef, stack, portalParams };
};

describe('back to a portal tab from a screen on top of it', () => {
  it('Account: "View errand receipts" returns to the portal on Errands, without a second portal', async () => {
    const { res, stack, portalParams, navRef } = await renderOn('Account');
    expect(stack()).toEqual(['CustomerPortal', 'Account']);

    await fireEvent.press(res.getByLabelText('View errand receipts'));

    await waitFor(() => expect(navRef.getCurrentRoute()?.name).toBe('CustomerPortal'));
    expect(stack()).toEqual(['CustomerPortal']);
    expect(portalParams()).toEqual({ tab: 'errands', errand: undefined });
  });

  it('Notifications: a delivery row returns to the portal on Track, on that errand, without a second portal', async () => {
    const { res, stack, portalParams, navRef } = await renderOn('Notification');
    expect(stack()).toEqual(['CustomerPortal', 'Notification']);

    await fireEvent.press(res.getByTestId('notification-card-3'));

    await waitFor(() => expect(navRef.getCurrentRoute()?.name).toBe('CustomerPortal'));
    expect(mockMarkAsRead).toHaveBeenCalledWith(3);
    expect(stack()).toEqual(['CustomerPortal']);
    expect(portalParams()).toEqual({ tab: 'track', errand: 'e-2' });
  });
});
