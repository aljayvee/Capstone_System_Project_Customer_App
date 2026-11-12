import type { AxiosRequestConfig } from 'axios';

// SecureStore and AsyncStorage are native; deviceInfo reads both. Stubbed here
// so the interceptor under test is the only thing doing any work.
const secureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => secureStore[k] ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    secureStore[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete secureStore[k];
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('../utils/deviceInfo', () => ({
  getDeviceHeaders: jest.fn(async () => ({})),
}));

import {
  apiClient,
  setOnSessionExpired,
  setCustomerToken,
  setCustomerRefreshToken,
  hasSlowRequestInFlight,
  __resetRequestTracking,
  SLOW_REQUEST_MS,
} from '../services/apiClient';
import { ApiError } from '../services/ApiError';

/**
 * An axios adapter owns settle(), so a custom one has to reject by hand. This
 * builds exactly the object the built-in adapters hand to a response
 * interceptor on a non-2xx: isAxiosError, config, and a populated response.
 */
function stubResponse(status: number, data: unknown = { error: 'Invalid username or password' }) {
  const adapter = jest.fn(async (config: AxiosRequestConfig) => {
    const error: any = new Error('Request failed with status code ' + status);
    error.isAxiosError = true;
    error.code = status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST';
    error.config = config;
    error.request = {};
    error.response = { data, status, statusText: String(status), headers: {}, config };
    throw error;
  });
  (apiClient.defaults as any).adapter = adapter;
  return adapter;
}

/** Lets the request interceptor's storage awaits actually settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  Object.keys(secureStore).forEach((k) => delete secureStore[k]);
  setCustomerToken(null);
  await setCustomerRefreshToken(null);
  __resetRequestTracking();
  setOnSessionExpired(null);
  jest.clearAllMocks();
});

describe('a 401 from a credential-presenting endpoint', () => {
  // The regression this whole change exists for. /customers/login is not under
  // /auth/, so the old `url.includes('/auth/')` guard never fired: a wrong
  // password entered the silent-refresh branch, failed for want of a refresh
  // token, cleared the session and came back as "Your session has expired."
  it('is reported as a failed login, not as an expired session', async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    const adapter = stubResponse(401);

    await expect(apiClient.post('/customers/login', { username: 'x', password: 'y' })).rejects.toMatchObject(
      { status: 401 }
    );

    // One attempt. No refresh, no replay.
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('rejects with an ApiError the mapper can read', async () => {
    stubResponse(401);
    const error = await apiClient.post('/customers/login', {}).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.isOffline).toBe(false);
    expect(error.isTimeout).toBe(false);
  });

  it('covers registration, OTP and password reset too', async () => {
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);

    for (const url of [
      '/customers/register',
      '/customers/send-registration-otp',
      '/customers/verify-registration-phone-otp',
      '/customers/forgot-password',
      '/customers/verify-reset-code',
      '/customers/reset-password',
      '/customers/verify-email',
    ]) {
      const adapter = stubResponse(401);
      await expect(apiClient.post(url, {})).rejects.toMatchObject({ status: 401 });
      expect(adapter).toHaveBeenCalledTimes(1);
    }

    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe('a 401 from an ordinary endpoint', () => {
  it('does not clear the session when there is nothing to refresh', async () => {
    // Signed out, so a 401 is just a 401. Refreshing would clear state and
    // bounce a customer who was never signed in to begin with.
    const onExpired = jest.fn();
    setOnSessionExpired(onExpired);
    const adapter = stubResponse(401, { error: 'Unauthorized' });

    await expect(apiClient.get('/errands/user/7')).rejects.toMatchObject({ status: 401 });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('persists refresh token to AsyncStorage fallback alongside SecureStore', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await setCustomerRefreshToken('my-secret-refresh-token');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@sugo_customer_refresh_token',
      'my-secret-refresh-token'
    );
  });

  it('re-executes with freshly updated access token if a sibling request already refreshed it', async () => {
    // Current in-memory access token was already rotated by sibling call to 'fresh-token'
    setCustomerToken('fresh-token');
    await setCustomerRefreshToken('live-refresh-token');

    let requestHeaderUsed: string | null = null;
    (apiClient.defaults as any).adapter = jest.fn(async (config: AxiosRequestConfig) => {
      requestHeaderUsed = config.headers?.Authorization as string;
      if (requestHeaderUsed === 'Bearer old-stale-token') {
        const error: any = new Error('Request failed with status code 401');
        error.isAxiosError = true;
        error.code = 'ERR_BAD_REQUEST';
        error.config = config;
        error.response = { status: 401, data: { error: 'Token expired' }, config };
        throw error;
      }
      return { data: { success: true }, status: 200, statusText: 'OK', headers: {}, config, request: {} };
    });

    const res = await apiClient.get('/customers/profile', {
      headers: { Authorization: 'Bearer old-stale-token' },
    });
    expect(res.data).toEqual({ success: true });
    expect(requestHeaderUsed).toBe('Bearer fresh-token');
  });
});

describe('other statuses', () => {
  it('keeps the status and the server text intact', async () => {
    stubResponse(409, { error: 'Errand already claimed' });
    const error = await apiClient.patch('/errands/9', {}).catch((e) => e);

    expect(error.status).toBe(409);
    expect(error.serverMessage).toBe('Errand already claimed');
  });

  it('does not mistake a 500 for a network failure', async () => {
    // The old interceptor flattened everything to `new Error(message)`, which
    // is why useActiveErrands read every failure as an offline one.
    stubResponse(500, { error: 'Internal server error' });
    const error = await apiClient.get('/errands/user/7').catch((e) => e);

    expect(error.status).toBe(500);
    expect(error.isOffline).toBe(false);
  });
});

describe('slow-request tracking', () => {
  it('reports nothing slow when nothing is in flight', () => {
    expect(hasSlowRequestInFlight()).toBe(false);
  });

  it('reports slow only once a request has outlived the threshold', async () => {
    let release: (value: any) => void = () => {};
    (apiClient.defaults as any).adapter = jest.fn(
      (config: AxiosRequestConfig) =>
        new Promise((resolve) => {
          release = () => resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config, request: {} });
        })
    );

    const pending = apiClient.get('/errands/user/7');
    // Give the request interceptor's storage awaits a turn so the clock starts.
    await flush();

    expect(hasSlowRequestInFlight()).toBe(false);
    expect(hasSlowRequestInFlight(Date.now() + SLOW_REQUEST_MS + 1)).toBe(true);

    release(null);
    await pending;

    // Cleared once it completes, however long it took.
    expect(hasSlowRequestInFlight(Date.now() + SLOW_REQUEST_MS + 1)).toBe(false);
  });
});
