import React from 'react';
import { Text, TouchableOpacity, View, Platform } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { setActiveChatErrandId } from '../utils/activeChatTracker';
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
    get: jest.fn(() => Promise.resolve({ data: [] })),
    patch: jest.fn(() => Promise.resolve({ data: { success: true } })),
    post: jest.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

jest.mock('../firebase/config', () => ({
  database: {},
  auth: {},
  app: {},
}));

// Mock Firebase Realtime Database
const mockFirebaseListeners: Record<string, ((snap: any) => void)> = {};
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn((_db: any, path: string) => ({ path })),
  query: jest.fn((refObj: any) => refObj),
  limitToLast: jest.fn(() => ({})),
  onValue: jest.fn((refObj: any, cb: (snap: any) => void) => {
    mockFirebaseListeners[refObj.path] = cb;
    return jest.fn();
  }),
}));

function ConsumerComponent() {
  const { syncActiveErrands } = useNotifications();
  return (
    <View>
      <TouchableOpacity
        testID="sync-errand-btn"
        onPress={() => syncActiveErrands(['ERRAND-999'])}
      >
        <Text>Sync Errand</Text>
      </TouchableOpacity>
    </View>
  );
}

describe('Messenger-Style Push & Banner Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    socketListeners = {};
    for (const key in mockFirebaseListeners) {
      delete mockFirebaseListeners[key];
    }
    setActiveChatErrandId(null);
  });

  it('triggers a heads-up banner with sound and vibration when dispatcher sends a message and customer is on another screen', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@sugo_customer_sounds_enabled') return Promise.resolve('true');
      if (key === '@sugo_customer_chat_alerts_enabled') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const res: any = await render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    // Sync active errand ERRAND-999
    fireEvent.press(res.getByTestId('sync-errand-btn'));

    await waitFor(() => {
      expect(socketListeners['notification:new']).toBeDefined();
    });

    // Simulate dispatcher sending a message via Socket.io relay
    await act(async () => {
      socketListeners['notification:new']({
        type: 'CHAT_MESSAGE',
        title: 'Message from Dispatcher Sarah',
        body: 'We arrived at Jollibee and are ordering your items!',
        errandId: 'ERRAND-999',
      });
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Message from Dispatcher Sarah',
          body: 'We arrived at Jollibee and are ordering your items!',
          channelId: 'chats',
          sound: 'default',
          data: { errandId: 'ERRAND-999', type: 'CHAT_MESSAGE' },
        }),
        trigger: null,
      })
    );
  });

  it('suppresses the floating heads-up banner when the customer is actively viewing that exact chat', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@sugo_customer_sounds_enabled') return Promise.resolve('true');
      if (key === '@sugo_customer_chat_alerts_enabled') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(socketListeners['notification:new']).toBeDefined();
    });

    // Customer opens chat for ERRAND-999
    setActiveChatErrandId('ERRAND-999');

    // Dispatcher sends message for ERRAND-999 while user is actively looking at it
    await act(async () => {
      socketListeners['notification:new']({
        type: 'CHAT_MESSAGE',
        title: 'Message from Dispatcher Sarah',
        body: 'Is 2 pieces of Chickenjoy okay?',
        errandId: 'ERRAND-999',
      });
    });

    // The floating banner MUST be suppressed so it does not block the customer's chat screen
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('honors the "Audible In-App Chimes" setting toggle by silencing sound when disabled', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@sugo_customer_sounds_enabled') return Promise.resolve('false'); // Sounds OFF
      if (key === '@sugo_customer_chat_alerts_enabled') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(socketListeners['notification:new']).toBeDefined();
    });

    await act(async () => {
      socketListeners['notification:new']({
        type: 'CHAT_MESSAGE',
        title: 'Message from Dispatcher Sarah',
        body: 'Receipt uploaded',
        errandId: 'ERRAND-999',
      });
    });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          sound: undefined, // Muted sound
          channelId: 'chats',
        }),
      })
    );
  });

  it('honors the "Dispatcher & Rider Messages" setting toggle by suppressing chat banners when disabled', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@sugo_customer_chat_alerts_enabled') return Promise.resolve('false'); // Chat alerts OFF
      return Promise.resolve(null);
    });

    render(
      <NotificationProvider>
        <ConsumerComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(socketListeners['notification:new']).toBeDefined();
    });

    await act(async () => {
      socketListeners['notification:new']({
        type: 'CHAT_MESSAGE',
        title: 'Message from Dispatcher Sarah',
        body: 'Checking stock',
        errandId: 'ERRAND-999',
      });
    });

    // Suppressed because user toggled chat alerts off in settings
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
