import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { apiClient } from '../services/apiClient';
import { getSocket } from '../services/socketClient';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

const mockUser = {
  id: 42,
  username: 'testcustomer',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
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

let socketListeners: Record<string, ((data: any) => void)> = {};
const mockSocket = {
  on: jest.fn((event: string, cb: (data: any) => void) => {
    socketListeners[event] = cb;
  }),
  off: jest.fn((event: string) => {
    delete socketListeners[event];
  }),
};

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() => Promise.resolve(mockSocket)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

function ConsumerComponent() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refreshNotifications } =
    useNotifications();

  return (
    <View testID="container">
      <Text testID="unread-count">{unreadCount}</Text>
      <Text testID="loading-state">{loading ? 'loading' : 'idle'}</Text>
      <Text testID="items-count">{notifications.length}</Text>
      {notifications.map((n) => (
        <View key={n.id} testID={`notification-item-${n.id}`}>
          <Text testID={`title-${n.id}`}>{n.title}</Text>
          <Text testID={`status-${n.id}`}>{n.isRead ? 'read' : 'unread'}</Text>
          <TouchableOpacity testID={`mark-read-btn-${n.id}`} onPress={() => markAsRead(n.id)}>
            <Text>Read</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity testID="mark-all-read-btn" onPress={markAllAsRead}>
        <Text>Read All</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="refresh-btn" onPress={() => refreshNotifications(true)}>
        <Text>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
}

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketListeners = {};
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 1,
          type: 'DISPATCH_ASSIGNED',
          title: 'Rider Assigned',
          body: 'Rider Mike is picking up your order',
          isRead: false,
          createdAt: new Date().toISOString(),
          errandId: 'SGO-001',
        },
        {
          id: 2,
          type: 'CHAT_MESSAGE',
          title: 'Dispatcher Maria',
          body: 'Hello, your items are ready!',
          isRead: true,
          createdAt: new Date().toISOString(),
          errandId: 'SGO-001',
        },
        {
          id: 3,
          type: 'FEE_PROPOSAL',
          title: 'Delivery Fee Finalized',
          body: 'Delivery fee is ₱70.00',
          isRead: false,
          createdAt: new Date().toISOString(),
          errandId: 'SGO-002',
        },
      ],
    });
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { success: true } });
  });

  it('fetches notifications on mount and calculates unread count accurately', async () => {
    const res: any = await render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(res.getByTestId('items-count').props.children).toBe(3);
    });

    // 2 notifications are unread (id 1 and id 3)
    expect(res.getByTestId('unread-count').props.children).toBe(2);
    expect(apiClient.get).toHaveBeenCalledWith('/notifications');
  });

  it('markAsRead updates item optimistically and calls PATCH /notifications/:id/read', async () => {
    const res: any = await render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(res.getByTestId('unread-count').props.children).toBe(2);
    });

    await act(async () => {
      fireEvent.press(res.getByTestId('mark-read-btn-1'));
    });

    // Optimistically decremented
    expect(res.getByTestId('unread-count').props.children).toBe(1);
    expect(res.getByTestId('status-1').props.children).toBe('read');
    expect(apiClient.patch).toHaveBeenCalledWith('/notifications/1/read');
  });

  it('markAllAsRead zeroes unread count immediately and calls atomic PATCH /notifications/read-all', async () => {
    const res: any = await render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(res.getByTestId('unread-count').props.children).toBe(2);
    });

    await act(async () => {
      fireEvent.press(res.getByTestId('mark-all-read-btn'));
    });

    // Instant zero count
    expect(res.getByTestId('unread-count').props.children).toBe(0);
    expect(res.getByTestId('status-1').props.children).toBe('read');
    expect(res.getByTestId('status-3').props.children).toBe('read');

    // Called atomic server endpoint
    expect(apiClient.patch).toHaveBeenCalledWith('/notifications/read-all');
  });

  it('increments unread count and schedules notification on socket notification:new event', async () => {
    const res: any = await render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(res.getByTestId('unread-count').props.children).toBe(2);
    });

    expect(socketListeners['notification:new']).toBeDefined();

    await act(async () => {
      socketListeners['notification:new']({
        id: 4,
        type: 'CHAT_MESSAGE',
        title: 'New Dispatcher Message',
        body: 'Can we substitute the bread?',
        errandId: 'SGO-003',
      });
    });

    expect(res.getByTestId('unread-count').props.children).toBe(3);
    expect(res.getByTestId('items-count').props.children).toBe(4);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'New Dispatcher Message',
          body: 'Can we substitute the bread?',
        }),
      })
    );
  });

  it('schedules proximity alert on socket errand:rider_nearby event and deduplicates repeated alerts', async () => {
    await render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(socketListeners['errand:rider_nearby']).toBeDefined();
    });

    await act(async () => {
      socketListeners['errand:rider_nearby']({
        errandId: 'SGO-PROX-99',
        body: 'Your rider is within 500m of your delivery address. Please prepare COD!',
      });
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Rider is Arriving Soon! 🛵',
          data: { errandId: 'SGO-PROX-99', type: 'RIDER_NEARBY' },
        }),
      })
    );

    // Repeated event for same errand should be deduplicated
    await act(async () => {
      socketListeners['errand:rider_nearby']({
        errandId: 'SGO-PROX-99',
        body: 'Your rider is within 500m of your delivery address. Please prepare COD!',
      });
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
