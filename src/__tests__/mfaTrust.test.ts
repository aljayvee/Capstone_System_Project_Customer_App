const mockStore: Record<string, string> = {};
let mockKeystoreBroken = false;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => {
    if (mockKeystoreBroken) throw new Error('keystore unavailable');
    return mockStore[key] ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (mockKeystoreBroken) throw new Error('keystore unavailable');
    mockStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
}));

const mockOpenAuthSession = jest.fn();
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: any[]) => mockOpenAuthSession(...args),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `customerapp://${path}`,
  parse: (url: string) => {
    const query = url.split('?')[1] || '';
    return { queryParams: Object.fromEntries(new URLSearchParams(query)) };
  },
}));

jest.mock('../services/apiClient', () => ({ apiClient: { post: jest.fn() } }));

import {
  clearMfaTrustToken,
  getMfaTrustToken,
  mfaTrustField,
  readLoginChallenge,
  saveMfaTrustToken,
} from '../services/mfaTrust';
import { verifyLoginBySms } from '../services/phoneVerification';

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  mockKeystoreBroken = false;
  mockOpenAuthSession.mockReset();
});

describe('mfaTrust', () => {
  it('stores the trust token under the device key and reads it back', async () => {
    expect(await getMfaTrustToken()).toBeNull();
    expect(await mfaTrustField()).toEqual({});

    await saveMfaTrustToken('trust-1');

    expect(mockStore.sugo_customer_mfa_trust).toBe('trust-1');
    expect(await mfaTrustField()).toEqual({ mfaTrustToken: 'trust-1' });

    await clearMfaTrustToken();
    expect(await getMfaTrustToken()).toBeNull();
  });

  it('ignores a reply with no token instead of erasing the stored one', async () => {
    await saveMfaTrustToken('trust-1');
    await saveMfaTrustToken(undefined);

    expect(await getMfaTrustToken()).toBe('trust-1');
  });

  it('treats a broken keystore as no token', async () => {
    mockKeystoreBroken = true;

    await expect(saveMfaTrustToken('trust-1')).resolves.toBeUndefined();
    expect(await mfaTrustField()).toEqual({});
  });
});

describe('readLoginChallenge', () => {
  it('reads a password challenge and a Google challenge alike', () => {
    const fields = {
      factors: ['SMS', 'EMAIL', 'PUSH'],
      challengeToken: 'c1',
      maskedEmail: 'al****@gmail.com',
      maskedPhone: '+63 9** *** 1234',
      phoneHint: '1234',
      role: 'Customer',
      expiresInSeconds: 600,
    };
    const expected = {
      challengeToken: 'c1',
      factors: ['SMS', 'EMAIL'],
      maskedEmail: 'al****@gmail.com',
      maskedPhone: '+63 9** *** 1234',
      phoneHint: '1234',
      expiresInSeconds: 600,
    };

    expect(readLoginChallenge({ otpRequired: true, mfaRequired: true, ...fields })).toEqual(expected);
    expect(readLoginChallenge({ status: 'MFA_REQUIRED', ...fields })).toEqual(expected);
  });

  it('passes a finished sign-in through', () => {
    expect(readLoginChallenge({ user: { id: 1 }, token: 't' })).toBeNull();
    expect(readLoginChallenge({ status: 'PHONE_SETUP_REQUIRED' })).toBeNull();
  });

  it('falls back to email when the reply names no factor', () => {
    expect(readLoginChallenge({ mfaRequired: true, challengeToken: 'c1' })?.factors).toEqual(['EMAIL']);
    expect(readLoginChallenge({ mfaRequired: true, challengeToken: 'c1', factors: [] })?.factors).toEqual(['EMAIL']);
  });

  it('refuses a challenge with no token', () => {
    expect(() => readLoginChallenge({ mfaRequired: true, factors: ['EMAIL'] })).toThrow();
  });
});

describe('verifyLoginBySms', () => {
  it('opens the portal for the MFA purpose with only the last four digits', async () => {
    mockOpenAuthSession.mockResolvedValue({ type: 'success', url: 'customerapp://mfa-verified?token=fb-1&phone=%2B639171231234' });

    const result = await verifyLoginBySms('1234');

    expect(result).toEqual({ status: 'verified', idToken: 'fb-1' });
    const [url, redirect] = mockOpenAuthSession.mock.calls[0];
    expect(redirect).toBe('customerapp://mfa-verified');
    expect(url).toBe(
      'https://portal.sugo-express.org/verify-phone?purpose=mfa&hint=1234&redirect=customerapp%3A%2F%2Fmfa-verified'
    );
    expect(url).not.toContain('phone=');
  });

  it('reports a closed page as cancelled', async () => {
    mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });

    expect(await verifyLoginBySms('1234')).toEqual({ status: 'cancelled' });
  });

  it('never throws when the browser cannot open', async () => {
    mockOpenAuthSession.mockRejectedValue(new Error('no browser'));

    expect(await verifyLoginBySms(null)).toEqual({ status: 'failed', error: expect.any(Error) });
  });
});
