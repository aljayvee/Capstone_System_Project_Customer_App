import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiClient } from '../services/apiClient';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveChatErrandId } from '../utils/activeChatTracker';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data || {}) as PushTapPayload;
    const notifType = String(data.type || '').toUpperCase();
    const errandId = data.errandId ? String(data.errandId) : null;
    const activeChatId = getActiveChatErrandId();

    const isChat = notifType.includes('CHAT') || notifType.includes('MESSAGE');
    const isDelivery =
      notifType.includes('ERRAND') ||
      notifType.includes('RIDER') ||
      notifType.includes('DELIVERY') ||
      notifType.includes('PROXIMITY');

    // Read user preferences from AsyncStorage
    let soundsEnabled = true;
    let chatAlertsEnabled = true;
    let errandAlertsEnabled = true;

    try {
      const [storedSounds, storedChats, storedErrands] = await Promise.all([
        AsyncStorage.getItem('@sugo_customer_sounds_enabled'),
        AsyncStorage.getItem('@sugo_customer_chat_alerts_enabled'),
        AsyncStorage.getItem('@sugo_customer_errand_alerts_enabled'),
      ]);
      if (storedSounds !== null) soundsEnabled = storedSounds === 'true';
      if (storedChats !== null) chatAlertsEnabled = storedChats === 'true';
      if (storedErrands !== null) errandAlertsEnabled = storedErrands === 'true';
    } catch {
      // Keep defaults
    }

    // If customer is currently active in this exact errand's chat screen, suppress heads-up banner
    const isViewingThisChat = isChat && errandId && activeChatId && errandId === activeChatId;

    if (isViewingThisChat) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: soundsEnabled,
        shouldSetBadge: false,
      };
    }

    // If alert category is disabled in Settings, suppress banner and sound
    if (isChat && !chatAlertsEnabled) {
      return {
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    if (isDelivery && !errandAlertsEnabled) {
      return {
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: soundsEnabled,
      shouldSetBadge: false,
    };
  },
});

/** Logged once per app session, not once per mount — see the catch below. */
let warnedAboutFcm = false;

/** What a tapped notification hands back, so the app can open the right thing. */
export interface PushTapPayload {
  errandId?: string;
  type?: string;
}

/**
 * Ensures the device is registered with the backend for push notifications
 * targeting this customer.
 *
 * Safe to mount in every root screen: idempotent, no-ops if customerId is unset
 * or unchanged, and silent in Expo Go (where FCM cannot run).
 *
 * Sets up Android notification channels immediately, so in-app delivery and
 * status alerts work even if push-token registration is skipped or fails.
 *
 * ## Failure semantics
 *
 * If permissions are denied or registration fails, the hook resolves silently:
 * notifications are a convenience, and blocking the app would be worse than
 * missing a push. The error is logged to console for debugging.
 *
 * ## Lifecycle
 *
 * Fires once per customerId change. The server gives a token to the last
 * account that registered it and takes it off every other account, and clears
 * it when that account signs out (services/pushTokenOwnership.ts, 2026-10-07).
 * Before that, a phone shared by two customers received both one's alerts.
 */
export function useRegisterPushToken(
  customerId: number | string | undefined,
  onNotificationTapped?: (payload: PushTapPayload) => void
): void {
  const tappedRef = useRef(onNotificationTapped);
  tappedRef.current = onNotificationTapped;

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;

    // Set up Android notification channels unconditionally (for both remote push and local notifications)
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        sound: 'default',
      }).catch(() => {});
      void Notifications.setNotificationChannelAsync('chats', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250],
        enableVibrate: true,
        sound: 'default',
      }).catch(() => {});
      void Notifications.setNotificationChannelAsync('delivery-alerts', {
        name: 'Delivery Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        enableVibrate: true,
        sound: 'default',
      }).catch(() => {});
    }

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted' || cancelled) return;

        // Android: the device's own FCM token, which the server sends to
        // directly with its Firebase service account (lib/pushNotifications.ts
        // tells the two kinds apart). The Expo token went through Expo's push
        // service, and every send failed there with InvalidCredentials: the
        // Expo project holds no FCM key for this app. With the FCM token, a
        // delivery alert reaches the phone with the app closed or swiped away.
        //
        // Elsewhere the Expo token, as before. getExpoPushTokenAsync() needs an
        // EAS project id; the configured one from app.json is the fallback for
        // bare builds made without EAS CLI.
        let token: string;
        if (Platform.OS === 'android') {
          const device = await Notifications.getDevicePushTokenAsync();
          token = String(device.data);
        } else {
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ||
            (Constants as any).easConfig?.projectId ||
            'b3e551d1-d422-4e09-8f27-d1d76237a1c4';
          token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        }
        if (cancelled) return;

        await apiClient.post(`/customers/${customerId}/push-token`, { token });
      } catch (err) {
          // Distinguish "this build cannot do push" from "something went
          // wrong". The first is a configuration state, not a fault: it is the
          // expected result in Expo Go and in any build without FCM
          // credentials, and printing a native stack trace on every launch
          // trains people to ignore the console. The second is worth seeing in
          // full.
          const message = String((err as Error)?.message || err);
          const isMissingFcm =
            message.includes('Firebase') ||
            message.includes('googleServicesFile') ||
            message.includes('FirebaseApp');

          if (isMissingFcm) {
            if (!warnedAboutFcm) {
              warnedAboutFcm = true;
              console.warn(
                '[push] Notifications are off for this build: Android FCM is not configured. ' +
                  'Add google-services.json and set android.googleServicesFile in app.json, then ' +
                  'rebuild a dev client (Expo Go cannot deliver FCM push). ' +
                  'Everything else works — in-app alerts and the accepted dialog are unaffected.'
              );
            }
          } else {
            console.warn('[useRegisterPushToken] Could not register push token:', err);
          }
        }
      })();

    // The tap listener is registered regardless of whether a token could be
    // obtained — a notification delivered through any other route should still
    // open the right errand.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response?.notification?.request?.content?.data || {}) as PushTapPayload;
      tappedRef.current?.(data);
    });

    // Check cold-start notification response if opened from killed state
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response && !cancelled) {
          const data = (response?.notification?.request?.content?.data || {}) as PushTapPayload;
          tappedRef.current?.(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [customerId]);
}
