import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { NotificationBell } from '../components/NotificationBell';
import { apiClient } from '../services/apiClient';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 42, username: 'testuser', firstName: 'Juan', lastName: 'Dela Cruz' },
    accessToken: 'test-token',
  }),
}));

jest.mock('../context/NetworkContext', () => ({
  useNetworkStatus: () => ({
    isConnected: true,
    isSlow: false,
    reconnectCount: 0,
  }),
}));

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn() })),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

function MockNotificationScreenSimulator() {
  const { markAllAsRead, unreadCount } = useNotifications();
  return (
    <View testID="notification-screen-sim">
      <Text testID="screen-unread-count">{unreadCount}</Text>
      <TouchableOpacity testID="sim-mark-all-read-btn" onPress={markAllAsRead}>
        <Text>Read All</Text>
      </TouchableOpacity>
    </View>
  );
}

function DualScreenContainer({ onBellPress }: { onBellPress: () => void }) {
  return (
    <View testID="dual-screen-root">
      {/* Home screen top bar with NotificationBell */}
      <NotificationBell onPress={onBellPress} />
      {/* Notifications view */}
      <MockNotificationScreenSimulator />
    </View>
  );
}

describe('Notification Bell Real-Time Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 101,
          type: 'DISPATCH_ASSIGNED',
          title: 'Order Assigned',
          body: 'Rider assigned to order',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 102,
          type: 'CHAT_MESSAGE',
          title: 'Dispatcher Message',
          body: 'Store is out of stock of item A',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { success: true } });
  });

  it('renders unread badge on NotificationBell matching unread count', async () => {
    const onBellPress = jest.fn();
    const res: any = await render(
      <NotificationProvider>
        <DualScreenContainer onBellPress={onBellPress} />
      </NotificationProvider>
    );

    // Initial load: 2 unread notifications
    await waitFor(() => {
      expect(res.getByTestId('notification-bell-badge')).toBeTruthy();
      expect(res.getByTestId('notification-bell-count').props.children).toBe(2);
    });
  });

  it('disappears bell badge immediately when markAllAsRead is executed without requiring navigation/remount', async () => {
    const onBellPress = jest.fn();
    const res: any = await render(
      <NotificationProvider>
        <DualScreenContainer onBellPress={onBellPress} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(res.getByTestId('notification-bell-badge')).toBeTruthy();
    });

    // Customer taps "Read All" in Notification view
    await act(async () => {
      fireEvent.press(res.getByTestId('sim-mark-all-read-btn'));
    });

    // In-memory zeroing: badge MUST be null immediately in the NotificationBell component
    expect(res.queryByTestId('notification-bell-badge')).toBeNull();
    expect(res.getByTestId('screen-unread-count').props.children).toBe(0);

    // Server patch endpoint called atomically
    expect(apiClient.patch).toHaveBeenCalledWith('/notifications/read-all');
  });
});
