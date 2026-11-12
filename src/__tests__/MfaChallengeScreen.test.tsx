import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';

const mockPost = jest.fn();
const mockLogin = jest.fn();
const mockVerifyLoginBySms = jest.fn();
const mockSecureSet = jest.fn((_key: string, _value: string) => Promise.resolve());

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: any[]) => mockPost(...args) },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../services/phoneVerification', () => ({
  verifyLoginBySms: (...args: any[]) => mockVerifyLoginBySms(...args),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: (key: string, value: string) => mockSecureSet(key, value),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve(null)),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

// The real countdown reads ThemeContext, which these renders do not provide.
jest.mock('../components/RateLimitCountdown', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ seconds }: { seconds: number }) =>
      React.createElement(Text, { testID: 'mfa-countdown' }, `wait ${seconds}`),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../services/ApiError';
import MfaChallengeScreen from '../screens/MfaChallengeScreen';

const navigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
};

const challenge = {
  challengeToken: 'c1',
  factors: ['SMS', 'EMAIL'] as ('SMS' | 'EMAIL')[],
  maskedEmail: 'al****@gmail.com',
  maskedPhone: '+63 9** *** 1234',
  phoneHint: '1234',
  expiresInSeconds: 600,
};

const signedIn = {
  data: {
    user: { id: 7, username: 'juan' },
    token: 'access-1',
    refreshToken: 'refresh-1',
    sessionId: 'sess-1',
    mfaTrustToken: 'trust-1',
  },
};

function renderScreen(params: Record<string, unknown> = {}) {
  return render(
    <MfaChallengeScreen
      navigation={navigation as any}
      route={{ key: 'mfa', name: 'MfaChallenge', params: { challenge, ...params } } as any}
    />
  );
}

beforeEach(() => {
  mockPost.mockReset();
  mockLogin.mockReset();
  mockLogin.mockResolvedValue(undefined);
  mockVerifyLoginBySms.mockReset();
  mockSecureSet.mockClear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
  navigation.replace.mockReset();
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
  navigation.canGoBack.mockReset();
  navigation.canGoBack.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
});

describe('MfaChallengeScreen', () => {
  it('offers the factors the server named, by their masked destinations', async () => {
    const res: any = await renderScreen();

    expect(res.getByText('Text message to number ending 1234')).toBeTruthy();
    expect(res.getByText('Email to al****@gmail.com')).toBeTruthy();
    // Neither choice sends anything until it is picked.
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockVerifyLoginBySms).not.toHaveBeenCalled();
  });

  it('leaves out a factor the server did not offer', async () => {
    const res: any = await renderScreen({ challenge: { ...challenge, factors: ['EMAIL'] } });

    expect(res.getByTestId('mfa-method-email')).toBeTruthy();
    expect(res.queryByTestId('mfa-method-sms')).toBeNull();
  });

  it('signs in by text message: last four digits only, then the Firebase token', async () => {
    mockVerifyLoginBySms.mockResolvedValue({ status: 'verified', idToken: 'firebase-1' });
    mockPost.mockResolvedValue(signedIn);
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-sms'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('CustomerPortal', { user: signedIn.data.user }));
    expect(mockVerifyLoginBySms).toHaveBeenCalledWith('1234');
    expect(mockPost).toHaveBeenCalledWith('/auth/verify-login-otp', {
      challengeToken: 'c1',
      firebaseIdToken: 'firebase-1',
    });
    expect(mockLogin).toHaveBeenCalledWith(signedIn.data.user, 'access-1', 'refresh-1');
    expect(mockSecureSet).toHaveBeenCalledWith('sugo_customer_mfa_trust', 'trust-1');
  });

  it('keeps the choices when the text message page is closed', async () => {
    mockVerifyLoginBySms.mockResolvedValue({ status: 'cancelled' });
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-sms'));

    await waitFor(() => expect(res.getByTestId('mfa-notice')).toBeTruthy());
    expect(mockPost).not.toHaveBeenCalled();
    expect(res.getByTestId('mfa-method-email')).toBeTruthy();
  });

  it('says which number to use when the verified one is not on the account', async () => {
    mockVerifyLoginBySms.mockResolvedValue({ status: 'verified', idToken: 'firebase-other' });
    mockPost.mockRejectedValue(new ApiError('mismatch', { status: 400, serverMessage: 'staff wording' }));
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-sms'));

    await waitFor(() =>
      expect(
        res.getByText("That number isn't the one on your account. Use the number ending 1234, or choose email.")
      ).toBeTruthy()
    );
    expect(res.queryByText('staff wording')).toBeNull();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('sends the email code on request, then verifies with the fresh challenge token', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { challengeToken: 'c2', expiresInSeconds: 600 } })
      .mockResolvedValueOnce(signedIn);
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-email'));
    await waitFor(() => expect(res.getByTestId('mfa-code-input')).toBeTruthy());
    expect(mockPost).toHaveBeenNthCalledWith(1, '/auth/resend-login-otp', { challengeToken: 'c1' });
    expect(res.getByText('We sent a 6-digit code to al****@gmail.com. It can take a minute to arrive.')).toBeTruthy();

    await fireEvent.changeText(res.getByTestId('mfa-code-input'), '12 34-56');
    await fireEvent.press(res.getByTestId('mfa-verify-button'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith(signedIn.data.user, 'access-1', 'refresh-1'));
    expect(mockPost).toHaveBeenNthCalledWith(2, '/auth/verify-login-otp', { challengeToken: 'c2', code: '123456' });
    expect(mockSecureSet).toHaveBeenCalledWith('sugo_customer_mfa_trust', 'trust-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sugo_customer_onboarding_completed', 'true');
  });

  it('resends with the newest challenge token', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { challengeToken: 'c2', expiresInSeconds: 600 } })
      .mockResolvedValueOnce({ data: { challengeToken: 'c3', expiresInSeconds: 600 } });
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-email'));
    await waitFor(() => expect(res.getByTestId('mfa-resend')).toBeTruthy());
    await fireEvent.press(res.getByTestId('mfa-resend'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenNthCalledWith(2, '/auth/resend-login-otp', { challengeToken: 'c2' });
    expect(res.getByText('We sent a new code to al****@gmail.com. Use the newest one.')).toBeTruthy();
  });

  it('asks for all six digits before sending a code', async () => {
    mockPost.mockResolvedValueOnce({ data: { challengeToken: 'c2' } });
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-email'));
    await waitFor(() => expect(res.getByTestId('mfa-code-input')).toBeTruthy());
    await fireEvent.changeText(res.getByTestId('mfa-code-input'), '123');
    await fireEvent.press(res.getByTestId('mfa-verify-button'));

    expect(res.getByText('Enter the 6-digit code from the email.')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('keeps the code step open after a wrong code', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { challengeToken: 'c2' } })
      .mockRejectedValueOnce(new ApiError('Incorrect', { status: 400 }));
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-email'));
    await waitFor(() => expect(res.getByTestId('mfa-code-input')).toBeTruthy());
    await fireEvent.changeText(res.getByTestId('mfa-code-input'), '000000');
    await fireEvent.press(res.getByTestId('mfa-verify-button'));

    await waitFor(() => expect(res.getByText("That code didn't work. Check the digits and try again.")).toBeTruthy());
    expect(res.getByTestId('mfa-code-input')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows the wait after too many tries', async () => {
    mockPost.mockRejectedValueOnce(new ApiError('slow down', { status: 429, retryAfterSeconds: 45 }));
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-email'));

    await waitFor(() => expect(res.getByText('Too many tries. Wait 50 seconds and try again.')).toBeTruthy());
    expect(res.getByText('wait 45')).toBeTruthy();
  });

  it('switches from email back to a text message', async () => {
    mockPost.mockResolvedValueOnce({ data: { challengeToken: 'c2' } });
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-email'));
    await waitFor(() => expect(res.getByTestId('mfa-switch-method')).toBeTruthy());
    await fireEvent.press(res.getByTestId('mfa-switch-method'));

    expect(res.getByTestId('mfa-method-sms')).toBeTruthy();
    expect(res.queryByTestId('mfa-code-input')).toBeNull();
  });

  it('sends a spent or expired challenge back to sign in', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { challengeToken: 'c2' } })
      .mockRejectedValueOnce(new ApiError('expired', { status: 401 }));
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-method-email'));
    await waitFor(() => expect(res.getByTestId('mfa-code-input')).toBeTruthy());
    await fireEvent.changeText(res.getByTestId('mfa-code-input'), '123456');
    await fireEvent.press(res.getByTestId('mfa-verify-button'));

    await waitFor(() => expect(res.getByTestId('mfa-expired')).toBeTruthy());
    expect(res.queryByTestId('mfa-code-input')).toBeNull();
    await fireEvent.press(res.getByTestId('mfa-sign-in-again'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('times out on its own when the challenge clock runs out', async () => {
    const res: any = await renderScreen({ challenge: { ...challenge, expiresInSeconds: 0.05 } });

    await waitFor(() => expect(res.getByTestId('mfa-expired')).toBeTruthy());
    expect(res.queryByTestId('mfa-method-sms')).toBeNull();
  });

  it('starts over at Login when there is nothing to go back to', async () => {
    navigation.canGoBack.mockReturnValue(false);
    const res: any = await renderScreen();

    await fireEvent.press(res.getByTestId('mfa-start-over'));

    expect(navigation.replace).toHaveBeenCalledWith('Login');
  });

  it('runs the first-run location setup when the sign-in began on onboarding', async () => {
    const detectedLocation = { latitude: 6.69, longitude: 124.68, address: 'Tacurong City' };
    mockVerifyLoginBySms.mockResolvedValue({ status: 'verified', idToken: 'firebase-1' });
    mockPost.mockResolvedValue(signedIn);
    const res: any = await renderScreen({ onboarding: { detectedLocation } });

    await fireEvent.press(res.getByTestId('mfa-method-sms'));

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('CustomerPortal', {
        user: signedIn.data.user,
        triggerOnboardingLocationSetup: true,
        detectedLocation,
      })
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sugo_pending_onboarding_location_setup', 'true');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sugo_onboarding_location_draft', JSON.stringify(detectedLocation));
  });
});
