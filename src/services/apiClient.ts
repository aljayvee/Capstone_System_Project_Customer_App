import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { getDeviceHeaders } from '../utils/deviceInfo';

export const SECURE_TOKEN_KEY = 'sugo_customer_jwt_token';
export const STORAGE_KEY_TOKEN_FALLBACK = '@sugo_customer_jwt_token';

// The refresh token is the long-lived half of the session (30 days) and never
// leaves the device except to be spent at /auth/refresh. SecureStore is the
// Keychain/Keystore-backed store; the AsyncStorage key is the same fallback the
// access token already uses for simulators and devices where SecureStore is
// unavailable, and is written only when SecureStore refuses.
export const SECURE_REFRESH_KEY = 'sugo_customer_refresh_token';
export const STORAGE_KEY_REFRESH_FALLBACK = '@sugo_customer_refresh_token';

// In-Memory Token Storage for Customer App
let userAccessToken: string | null = null;
let userRefreshToken: string | null = null;

export const setCustomerToken = (token: string | null) => {
  userAccessToken = token;
};

export const getCustomerToken = (): string | null => {
  return userAccessToken;
};

/**
 * Persist (or clear) the refresh token. Called on login and on every rotation.
 *
 * Writes to SecureStore first and only falls back to AsyncStorage if that
 * throws, so the token sits in the OS keystore wherever one exists.
 */
export const setCustomerRefreshToken = async (token: string | null): Promise<void> => {
  userRefreshToken = token;

  if (!token) {
    try {
      await SecureStore.deleteItemAsync(SECURE_REFRESH_KEY);
    } catch {
      // Nothing stored there; the AsyncStorage removal below still runs.
    }
    await AsyncStorage.removeItem(STORAGE_KEY_REFRESH_FALLBACK).catch(() => {});
    return;
  }

  try {
    await SecureStore.setItemAsync(SECURE_REFRESH_KEY, token);
    // Never leave a stale copy in the weaker store shadowing the good one.
    await AsyncStorage.removeItem(STORAGE_KEY_REFRESH_FALLBACK).catch(() => {});
  } catch {
    await AsyncStorage.setItem(STORAGE_KEY_REFRESH_FALLBACK, token).catch(() => {});
  }
};

/** In-memory first, then disk. Hydrates the in-memory copy as a side effect. */
export const getCustomerRefreshToken = async (): Promise<string | null> => {
  if (userRefreshToken) return userRefreshToken;

  try {
    const secure = await SecureStore.getItemAsync(SECURE_REFRESH_KEY);
    if (secure) {
      userRefreshToken = secure;
      return secure;
    }
  } catch {
    // Fall through to the AsyncStorage fallback.
  }

  const fallback = await AsyncStorage.getItem(STORAGE_KEY_REFRESH_FALLBACK).catch(() => null);
  if (fallback) userRefreshToken = fallback;
  return fallback;
};

/**
 * Invoked when the session cannot be recovered — the refresh token is missing,
 * expired, or was revoked (including by the server's replay detection). The
 * AuthProvider registers a callback that clears state and returns to Login.
 */
let onSessionExpired: (() => void) | null = null;

export const setOnSessionExpired = (cb: (() => void) | null) => {
  onSessionExpired = cb;
};

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Self-healing token hydration + device telemetry
apiClient.interceptors.request.use(
  async (config) => {
    let token = userAccessToken;

    // Self-healing fallback: If in-memory token is empty (e.g. initial mount race condition),
    // immediately hydrate from persistent storage so the request is never sent without authorization.
    if (!token) {
      try {
        token =
          (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) ||
          (await AsyncStorage.getItem(STORAGE_KEY_TOKEN_FALLBACK));
        if (token) {
          userAccessToken = token;
        }
      } catch {
        // Fall through
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const deviceHeaders = await getDeviceHeaders();
      Object.assign(config.headers, deviceHeaders);
    } catch {
      // Non-fatal if device headers cannot be read
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Silent refresh.
 *
 * This is what was missing. The access token lives 15 minutes; before this, a
 * 401 was simply reformatted into "Invalid or Expired Token" and the only way
 * out was to sign out and back in. Now the first 401 spends the refresh token,
 * stores the rotated one, and replays the original request — the user sees a
 * slightly slower call, not a dead session.
 *
 * Single-flight matters as much as the refresh itself. A screen that fires four
 * requests on mount produces four simultaneous 401s; four parallel refreshes
 * would rotate the token four times, and three of those would present a token
 * the server had already retired — which its replay detection reads as theft
 * and answers by killing the session. So the first 401 starts the refresh and
 * every other waits on that same promise.
 *
 * A dedicated axios instance issues the refresh call: going through `apiClient`
 * would re-enter this interceptor and, on a failing refresh, recurse.
 */
const refreshClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const storedRefreshToken = await getCustomerRefreshToken();
  if (!storedRefreshToken) {
    throw new Error('NO_REFRESH_TOKEN');
  }

  // Device headers are sent here too: the server binds a session to the device
  // that opened it and rejects a refresh arriving from anywhere else.
  let deviceHeaders: Record<string, string> = {};
  try {
    deviceHeaders = (await getDeviceHeaders()) as Record<string, string>;
  } catch {
    // Non-fatal — the server only compares when both sides supply an id.
  }

  const response = await refreshClient.post(
    '/auth/refresh',
    { refreshToken: storedRefreshToken },
    { headers: deviceHeaders }
  );

  const newAccessToken: string | undefined = response.data?.token;
  if (!newAccessToken) {
    throw new Error('REFRESH_RESPONSE_MISSING_TOKEN');
  }

  setCustomerToken(newAccessToken);
  try {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, newAccessToken);
  } catch {
    await AsyncStorage.setItem(STORAGE_KEY_TOKEN_FALLBACK, newAccessToken).catch(() => {});
  }

  // Absent when the server's grace window absorbed a concurrent refresh — the
  // token already on disk is still the live one, so leave it alone.
  if (response.data?.refreshToken) {
    await setCustomerRefreshToken(response.data.refreshToken);
  }

  return newAccessToken;
}

/**
 * Single-flight refresh, shared by the 401 interceptor below and by the socket
 * client's handshake.
 *
 * Both must go through this same promise. A socket reconnect and an HTTP 401
 * landing together would otherwise spend the refresh token twice, and the
 * second attempt presents a token the server has already rotated away — which
 * its replay detection reads as theft and answers by revoking the session.
 */
export function refreshCustomerSession(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Response Interceptor: silent refresh on 401, then clean error messages
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // `_retried` stops an endlessly re-401ing endpoint from looping. /auth/* is
    // excluded because a failed login must surface as a failed login, and the
    // refresh call itself must never trigger a refresh.
    const isAuthCall = typeof original?.url === 'string' && original.url.includes('/auth/');

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        const newToken = await refreshCustomerSession();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        return apiClient(original);
      } catch {
        // Unrecoverable: no stored token, it expired, or the server revoked the
        // session. Clear the dead credential and let the app return to Login
        // once, rather than every screen discovering it separately.
        await setCustomerRefreshToken(null);
        setCustomerToken(null);
        onSessionExpired?.();
        return Promise.reject(new Error('Your session has expired. Please sign in again.'));
      }
    }

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Network request failed';
    return Promise.reject(new Error(message));
  }
);
