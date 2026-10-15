import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { getDeviceHeaders } from '../utils/deviceInfo';
import { isTokenExpired } from '../utils/jwt';
import { ApiError, toApiError } from './ApiError';

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
  } catch {
    // SecureStore may fail or be unsupported on certain Android device states
  }
  // Resilient persistence: Always ensure the fallback copy is maintained in AsyncStorage,
  // preventing accidental session revocation if SecureStore transiently fails on mobile wake-up.
  await AsyncStorage.setItem(STORAGE_KEY_REFRESH_FALLBACK, token).catch(() => {});
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

/**
 * Slow-connection detection.
 *
 * Deliberately not a radio-quality reading: a full-bars Wi-Fi with a dead
 * uplink looks perfect to NetInfo, and a healthy 3G looks alarming. What the
 * customer actually experiences is how long a request takes, so that is what
 * gets measured. 3s is the threshold ErrandChannelList already uses before it
 * swaps a skeleton for a spinner, reused here so the app has one idea of "slow"
 * rather than two.
 */
export const SLOW_REQUEST_MS = 3000;

let nextRequestId = 1;
const pendingRequests = new Map<number, number>();

function trackRequestStart(config: any): void {
  // A request replayed after a silent refresh arrives with the same config
  // object. Drop its previous entry first, or the original id is orphaned in
  // the map forever and the app reads as permanently slow.
  trackRequestEnd(config);
  const id = nextRequestId++;
  config.__sugoReqId = id;
  pendingRequests.set(id, Date.now());
}

function trackRequestEnd(config: any): void {
  const id = config?.__sugoReqId;
  if (typeof id === 'number') pendingRequests.delete(id);
}

/** True while any in-flight request has been waiting longer than SLOW_REQUEST_MS. */
export function hasSlowRequestInFlight(now: number = Date.now()): boolean {
  return Array.from(pendingRequests.values()).some((startedAt) => now - startedAt >= SLOW_REQUEST_MS);
}

/** Test seam. Nothing in the app calls this. */
export function __resetRequestTracking(): void {
  pendingRequests.clear();
}

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

    // Started here rather than before the awaits above, so the storage reads
    // this interceptor performs are not counted against the network.
    trackRequestStart(config);

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
    // Keystore error or unsupported
  }
  await AsyncStorage.setItem(STORAGE_KEY_TOKEN_FALLBACK, newAccessToken).catch(() => {});

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

/**
 * Endpoints where the caller is presenting credentials rather than spending an
 * access token. A 401 from any of these is an answer ("that password is wrong",
 * "that code has expired"), not a signal that the session needs refreshing.
 *
 * Every CustomerApp auth call lives under /customers/, not /auth/ - see
 * LoginScreen, RegisterScreen, ForgotPasswordScreen and SessionExpiredSheet.
 * /auth/ is kept in the pattern because refreshCustomerSession posts to
 * /auth/refresh, and a refresh must never trigger a refresh.
 */
const CREDENTIAL_ENDPOINTS = new RegExp(
  '/(auth/|customers/(login|register|forgot-password|reset-password|verify-reset-code|verify-email|resend-verification-email|(send|verify)-registration-(otp|phone-otp)))'
);

// Response Interceptor: silent refresh on 401, then clean error messages
apiClient.interceptors.response.use(
  (response) => {
    trackRequestEnd(response.config);
    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    trackRequestEnd(original);

    // `_retried` stops an endlessly re-401ing endpoint from looping.
    // Credential-presenting calls are excluded because a 401 from one of them
    // means the credentials were wrong, not that an access token aged out.
    // This used to test for '/auth/', which no CustomerApp endpoint contains -
    // every one of them lives under /customers/ - so the exclusion never fired
    // and a wrong password was reported to the customer as an expired session.
    const isCredentialCall =
      typeof original?.url === 'string' && CREDENTIAL_ENDPOINTS.test(original.url);

    // Second line of defence: a customer who is not signed in has no session to
    // recover, so a 401 on an anonymous call must not clear state or fire
    // onSessionExpired. Reads memory first, then the keystore.
    const hasRecoverableSession =
      status === 401 && !isCredentialCall ? Boolean(await getCustomerRefreshToken()) : false;

    if (status === 401 && original && !original._retried && !isCredentialCall && hasRecoverableSession) {
      original._retried = true;

      // Sibling request check: If another concurrent request already refreshed the access
      // token while this request was in flight, reuse the fresh token directly without
      // rotating the refresh token again (which would advance the rotation chain and trip replay detection).
      const requestAuthHeader = original.headers?.Authorization || original.headers?.authorization;
      const requestToken =
        typeof requestAuthHeader === 'string'
          ? requestAuthHeader.replace(/^Bearer\s+/i, '').trim()
          : null;
      const currentToken = getCustomerToken();

      if (currentToken && requestToken && currentToken !== requestToken && !isTokenExpired(currentToken)) {
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${currentToken}` };
        return apiClient(original);
      }

      try {
        const newToken = await refreshCustomerSession();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        return apiClient(original);
      } catch (refreshErr: any) {
        // Only trigger session revocation if the server explicitly rejected the refresh
        // token as unauthorized/forbidden (401/403) or if the refresh token is missing.
        // Transient network drops, timeouts, 429 rate limits, and 5xx errors must NOT
        // destroy the user's stored session!
        const refreshStatus = refreshErr?.response?.status ?? refreshErr?.status;
        const isAuthRejection =
          refreshStatus === 401 ||
          refreshStatus === 403 ||
          refreshErr?.message === 'NO_REFRESH_TOKEN';

        if (isAuthRejection) {
          await setCustomerRefreshToken(null);
          setCustomerToken(null);
          onSessionExpired?.();
          return Promise.reject(new ApiError('Session expired', { status: 401, endpoint: original?.url }));
        }

        // Network error, timeout, or server 5xx: preserve credentials and forward the failure.
        return Promise.reject(toApiError(refreshErr));
      }
    }

    // Classified, not flattened. Screens must not render `message` - it still
    // carries the server's own text, and the app talks to a deployed backend
    // whose wording (or a CDN's, in front of it) is not ours to show. Run it
    // through toUserMessage() in errorMessages.ts instead.
    return Promise.reject(toApiError(error));
  }
);
