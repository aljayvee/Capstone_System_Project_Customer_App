import { ApiError } from '../services/ApiError';

// `/auth/firebase-token` matches the credential arm of the apiClient
// interceptor, so a 401 from it is never refreshed there. These pin the
// refresh-and-retry that realtimeSession does for itself instead: without it a
// relaunch on an aged-out access token left the app with no Firebase session,
// and every chat showed "We lost the connection to this chat".

const mockPost = jest.fn();
const mockRefresh = jest.fn();
const mockSignIn = jest.fn();
const mockAuth: { currentUser: unknown } = { currentUser: null };

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args) },
  refreshCustomerSession: () => mockRefresh(),
}));

jest.mock('../firebase/config', () => ({
  get auth() {
    return mockAuth;
  },
  isFirebaseAuthConfigured: true,
}));

jest.mock('firebase/auth', () => ({
  signInWithCustomToken: (...args: unknown[]) => mockSignIn(...args),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));

/** Fresh module state per test: the single-flight promise and last state are module-level. */
function loadSession(): typeof import('../firebase/realtimeSession') {
  let mod!: typeof import('../firebase/realtimeSession');
  jest.isolateModules(() => {
    mod = require('../firebase/realtimeSession');
  });
  return mod;
}

describe('ensureRealtimeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUser = null;
    mockSignIn.mockResolvedValue(undefined);
  });

  it('refreshes once and retries when the token call is refused as expired', async () => {
    mockPost
      .mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce({ data: { token: 'firebase-custom-token' } });
    mockRefresh.mockResolvedValue('fresh-access-token');

    const { ensureRealtimeSession, realtimeAuthState } = loadSession();

    await expect(ensureRealtimeSession()).resolves.toBe(true);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockSignIn).toHaveBeenCalledWith(mockAuth, 'firebase-custom-token');
    expect(realtimeAuthState()).toBe('signed-in');
  });

  it('does not refresh for a failure that is not an expired session', async () => {
    mockPost.mockRejectedValue(new ApiError('Service unavailable', { status: 503 }));

    const { ensureRealtimeSession, realtimeAuthState } = loadSession();

    await expect(ensureRealtimeSession()).resolves.toBe(false);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(realtimeAuthState()).toBe('unavailable');
  });

  it('gives up without looping when the refresh itself fails', async () => {
    mockPost.mockRejectedValue(new ApiError('Unauthorized', { status: 401 }));
    mockRefresh.mockRejectedValue(new Error('NO_REFRESH_TOKEN'));

    const { ensureRealtimeSession, realtimeAuthState } = loadSession();

    await expect(ensureRealtimeSession()).resolves.toBe(false);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(realtimeAuthState()).toBe('unavailable');
  });

  it('keeps the customer identity it already has without asking again', async () => {
    mockAuth.currentUser = { uid: 'customer_4' };

    const { ensureRealtimeSession, realtimeAuthState } = loadSession();

    await expect(ensureRealtimeSession()).resolves.toBe(true);
    expect(mockPost).not.toHaveBeenCalled();
    expect(realtimeAuthState()).toBe('signed-in');
  });

  it('replaces the Google account a Google sign-in leaves signed in', async () => {
    // googleAuth.ts signs Firebase in as the Google account to get an ID token
    // for /customers/google-login. The rules only know customer_<id>, so taking
    // that user as "signed in" refused every chat until the app restarted.
    mockAuth.currentUser = { uid: 'kQ3pGoogleFirebaseUid' };
    mockPost.mockResolvedValueOnce({ data: { token: 'firebase-custom-token' } });

    const { ensureRealtimeSession, realtimeAuthState } = loadSession();

    await expect(ensureRealtimeSession()).resolves.toBe(true);
    expect(mockPost).toHaveBeenCalledWith('/auth/firebase-token');
    expect(mockSignIn).toHaveBeenCalledWith(mockAuth, 'firebase-custom-token');
    expect(realtimeAuthState()).toBe('signed-in');
  });

  // The chat's "We lost the connection" (2026-10-11): the database refused a
  // customer_<id> session whose ID token had expired while the phone slept.
  // ensure() trusts any customer_ uid, so only renew() can replace it.
  it('renews a customer identity that ensure would have kept', async () => {
    mockAuth.currentUser = { uid: 'customer_8' };
    mockPost.mockResolvedValueOnce({ data: { token: 'fresh-custom-token' } });

    const { ensureRealtimeSession, renewRealtimeSession, realtimeAuthState } = loadSession();

    await expect(ensureRealtimeSession()).resolves.toBe(true);
    expect(mockPost).not.toHaveBeenCalled();

    await expect(renewRealtimeSession()).resolves.toBe(true);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledWith(mockAuth, 'fresh-custom-token');
    expect(realtimeAuthState()).toBe('signed-in');
  });

  it('shares one exchange between a renewal and a first sign-in', async () => {
    let answer: (value: unknown) => void = () => {};
    mockPost.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));

    const { ensureRealtimeSession, renewRealtimeSession } = loadSession();

    const first = ensureRealtimeSession();
    const renewal = renewRealtimeSession();
    answer({ data: { token: 'firebase-custom-token' } });

    await expect(Promise.all([first, renewal])).resolves.toEqual([true, true]);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('mints again on a later call after an earlier one came back unavailable', async () => {
    mockPost
      .mockRejectedValueOnce(new ApiError('Service unavailable', { status: 503 }))
      .mockResolvedValueOnce({ data: { token: 'firebase-custom-token' } });

    const { ensureRealtimeSession } = loadSession();

    await expect(ensureRealtimeSession()).resolves.toBe(false);
    // What the chat screen's "Try again" relies on: a failed mint is not sticky.
    await expect(ensureRealtimeSession()).resolves.toBe(true);
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });
});
