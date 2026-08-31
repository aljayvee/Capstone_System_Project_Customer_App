import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiClient } from '../services/apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowBanner/shouldShowList replaced the single shouldShowAlert flag
    // in newer expo-notifications; both are required here or the handler does
    // not typecheck and foreground notifications render nowhere.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Logged once per app session, not once per mount — see the catch below. */
let warnedAboutFcm = false;

/** What a tapped notification hands back, so the app can open the right thing. */
export interface PushTapPayload {
  errandId?: string;
  type?: string;
}

/**
 * Registers this device's Expo push token so the server can reach the customer
 * when the app is closed, and reports taps back to the caller.
 *
 * The customer app shipped with `expo-notifications` installed and never used:
 * `CustomerAccount` had no token column, so nothing could be delivered. That is
 * why a dispatcher accepting an errand was silent — the socket event reaches
 * only a customer whose app is open and connected, which while waiting is
 * exactly who they are least likely to be.
 *
 * Registration runs on every launch rather than once at signup, because Expo
 * tokens are not stable: they change on reinstall, on some OS updates, and when
 * notification permission is revoked and re-granted. A token written once
 * silently rots, and the failure is invisible — a push to a dead token succeeds
 * at the API level and simply never arrives.
 *
 * Fails soft throughout. A customer who declines the OS prompt, or runs on a
 * simulator, or uses a build with no EAS project id, keeps a fully working app;
 * they just do not get pushes, and the in-app notification row still persists
 * server-side either way.
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

    // getExpoPushTokenAsync() needs a real EAS project id to know which Expo
    // project to register against. Without one the call is guaranteed to throw,
    // so skip the whole permission dance rather than printing a stack trace on
    // every mount — including every Fast Refresh in development.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId || (Constants as any).easConfig?.projectId;

    if (projectId) {
      (async () => {
        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'default',
              importance: Notifications.AndroidImportance.HIGH,
            });
          }

          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== 'granted' || cancelled) return;

          const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
          if (cancelled) return;

          await apiClient.post(`/customers/${customerId}/push-token`, {
            token: tokenResponse.data,
          });
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
    }

    // The tap listener is registered regardless of whether a token could be
    // obtained — a notification delivered through any other route should still
    // open the right errand.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response?.notification?.request?.content?.data || {}) as PushTapPayload;
      tappedRef.current?.(data);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [customerId]);
}
