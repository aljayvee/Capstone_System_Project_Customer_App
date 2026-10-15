import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useRegisterPushToken, PushTapPayload } from '../hooks/useRegisterPushToken';
import { apiClient } from '../services/apiClient';
import { setActiveChatErrandId } from '../utils/activeChatTracker';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

describe('useRegisterPushToken hook & Notification Handler', () => {
  let capturedHandler: any = null;

  beforeAll(() => {
    const calls = (Notifications.setNotificationHandler as jest.Mock).mock.calls;
    for (let i = calls.length - 1; i >= 0; i--) {
      if (calls[i]?.[0]?.handleNotification) {
        capturedHandler = calls[i][0].handleNotification;
        break;
      }
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    setActiveChatErrandId(null);
  });

  describe('Android Notification Channels Setup', () => {
    it('sets up Android channels with MAX importance for heads-up floating banners', async () => {
      renderHook(() => useRegisterPushToken(123));

      await waitFor(() => {
        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.objectContaining({
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
        }));
        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('chats', expect.objectContaining({
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
        }));
        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('delivery-alerts', expect.objectContaining({
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
        }));
      });
    });
  });

  describe('Push Token Registration & Fallback ProjectId', () => {
    it('registers the device FCM token on Android, which the server sends to directly', async () => {
      // Expo's push service could not deliver to this app at all (no FCM key in
      // the Expo project), so Android registers the token Firebase itself uses.
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Notifications.getDevicePushTokenAsync as jest.Mock).mockResolvedValue({
        type: 'android',
        data: 'fcm-device-token-abc',
      });

      renderHook(() => useRegisterPushToken(789));

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/customers/789/push-token', {
          token: 'fcm-device-token-abc',
        });
      });
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('requests permissions and registers the Expo token elsewhere, using the fallback project ID in bare builds', async () => {
      Platform.OS = 'ios';
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[mock-customer-token]' });

      // Simulate bare release build where Constants.expoConfig?.extra?.eas?.projectId is undefined
      if (Constants.expoConfig?.extra?.eas) {
        Constants.expoConfig.extra.eas.projectId = undefined;
      }

      renderHook(() => useRegisterPushToken(456));

      await waitFor(() => {
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
        expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
          projectId: 'b3e551d1-d422-4e09-8f27-d1d76237a1c4',
        });
        expect(apiClient.post).toHaveBeenCalledWith('/customers/456/push-token', {
          token: 'ExponentPushToken[mock-customer-token]',
        });
      });
    });

    it('does nothing when customerId is undefined', () => {
      renderHook(() => useRegisterPushToken(undefined));
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('Notification Tap Listeners', () => {
    it('notifies onNotificationTapped when notification is tapped in foreground/background', async () => {
      let responseCallback: any = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb: any) => {
        responseCallback = cb;
        return { remove: jest.fn() };
      });

      const onTapped = jest.fn();
      renderHook(() => useRegisterPushToken(123, onTapped));

      await waitFor(() => {
        expect(typeof responseCallback).toBe('function');
      });

      // Simulate tap on a chat notification
      responseCallback({
        notification: {
          request: {
            content: {
              data: { errandId: 'ERRAND-100', type: 'CHAT_MESSAGE' },
            },
          },
        },
      });

      expect(onTapped).toHaveBeenCalledWith({ errandId: 'ERRAND-100', type: 'CHAT_MESSAGE' });
    });

    it('processes cold-start notification response when opened from killed state', async () => {
      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue({
        notification: {
          request: {
            content: {
              data: { errandId: 'ERRAND-200', type: 'DISPATCH_ASSIGNED' },
            },
          },
        },
      });

      const onTapped = jest.fn();
      renderHook(() => useRegisterPushToken(123, onTapped));

      await waitFor(() => {
        expect(onTapped).toHaveBeenCalledWith({ errandId: 'ERRAND-200', type: 'DISPATCH_ASSIGNED' });
      });
    });
  });

  describe('Notifications.setNotificationHandler Behavior', () => {
    it('shows floating heads-up banner with sound when outside chat and alerts are enabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((k: string) => {
        if (k === '@sugo_customer_sounds_enabled') return Promise.resolve('true');
        if (k === '@sugo_customer_chat_alerts_enabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const mockNotification = {
        request: {
          content: {
            data: { errandId: 'ERRAND-555', type: 'CHAT_MESSAGE' },
          },
        },
      };

      const handler = capturedHandler;
      expect(handler).toBeTruthy();
      const result = await handler(mockNotification);

      expect(result).toEqual({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      });
    });

    it('suppresses floating banner when user is actively viewing that specific chat', async () => {
      setActiveChatErrandId('ERRAND-555');

      const mockNotification = {
        request: {
          content: {
            data: { errandId: 'ERRAND-555', type: 'CHAT_MESSAGE' },
          },
        },
      };

      const handler = capturedHandler;
      expect(handler).toBeTruthy();
      const result = await handler(mockNotification);

      expect(result).toEqual({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
      });
    });

    it('suppresses banner and sound when chat alerts toggle is turned OFF in settings', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((k: string) => {
        if (k === '@sugo_customer_chat_alerts_enabled') return Promise.resolve('false');
        return Promise.resolve('true');
      });

      const mockNotification = {
        request: {
          content: {
            data: { errandId: 'ERRAND-555', type: 'CHAT_MESSAGE' },
          },
        },
      };

      const handler = capturedHandler;
      expect(handler).toBeTruthy();
      const result = await handler(mockNotification);

      expect(result).toEqual({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      });
    });

    it('suppresses sound when sound effects toggle is turned OFF in settings', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((k: string) => {
        if (k === '@sugo_customer_sounds_enabled') return Promise.resolve('false');
        if (k === '@sugo_customer_chat_alerts_enabled') return Promise.resolve('true');
        return Promise.resolve('true');
      });

      const mockNotification = {
        request: {
          content: {
            data: { errandId: 'ERRAND-555', type: 'CHAT_MESSAGE' },
          },
        },
      };

      const handler = capturedHandler;
      expect(handler).toBeTruthy();
      const result = await handler(mockNotification);

      expect(result.shouldPlaySound).toBe(false);
      expect(result.shouldShowBanner).toBe(true);
    });
  });
});
