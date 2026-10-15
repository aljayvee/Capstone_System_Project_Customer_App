import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingAuthChoiceScreen from '../screens/onboarding/OnboardingAuthChoiceScreen';
import { signInWithGoogleNative } from '../services/googleAuth';
import { apiClient } from '../services/apiClient';

jest.mock('../services/googleAuth', () => ({
  signInWithGoogleNative: jest.fn(),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(() => Promise.resolve()),
  }),
}));

describe('OnboardingAuthChoiceScreen', () => {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  };

  const detectedLocation = {
    latitude: 6.69,
    longitude: 124.68,
    address: 'Tacurong City, Sultan Kudarat',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all required authentication options', async () => {
    const res: any = await render(
      <OnboardingAuthChoiceScreen
        navigation={navigation}
        route={{ params: { detectedLocation } }}
      />
    );

    expect(res.getByText('Welcome to Sugo Express')).toBeTruthy();
    expect(res.getByTestId('onboarding-google-signup-btn')).toBeTruthy();
    expect(res.getByTestId('onboarding-create-account-btn')).toBeTruthy();
    expect(res.getByTestId('onboarding-login-btn')).toBeTruthy();
    expect(res.getByText('Already have an account?')).toBeTruthy();
    expect(res.getByText('Log in with your email or username')).toBeTruthy();
  });

  it('navigates to Register screen with detected location when Create an Account is pressed', async () => {
    const res: any = await render(
      <OnboardingAuthChoiceScreen
        navigation={navigation}
        route={{ params: { detectedLocation } }}
      />
    );

    fireEvent.press(res.getByTestId('onboarding-create-account-btn'));
    expect(navigation.navigate).toHaveBeenCalledWith('Register', { detectedLocation });
  });

  it('navigates to Login screen when Email or Username is pressed', async () => {
    const res: any = await render(
      <OnboardingAuthChoiceScreen
        navigation={navigation}
        route={{ params: { detectedLocation } }}
      />
    );

    fireEvent.press(res.getByTestId('onboarding-login-btn'));
    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });

  it('handles Google sign up and navigates to GooglePhoneSetup when phone setup is required', async () => {
    (signInWithGoogleNative as jest.Mock).mockResolvedValueOnce({
      firebaseIdToken: 'fake-google-token',
      email: 'test@gmail.com',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      googleUid: 'google-uid-123',
      photoUrl: null,
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: {
        status: 'PHONE_SETUP_REQUIRED',
        email: 'test@gmail.com',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        googleUid: 'google-uid-123',
      },
    });

    const res: any = await render(
      <OnboardingAuthChoiceScreen
        navigation={navigation}
        route={{ params: { detectedLocation } }}
      />
    );

    fireEvent.press(res.getByTestId('onboarding-google-signup-btn'));

    await waitFor(() => {
      expect(signInWithGoogleNative).toHaveBeenCalled();
      expect(apiClient.post).toHaveBeenCalledWith('/customers/google-login', {
        idToken: 'fake-google-token',
      });
      expect(navigation.navigate).toHaveBeenCalledWith('GooglePhoneSetup', expect.objectContaining({
        googleIdToken: 'fake-google-token',
        email: 'test@gmail.com',
        detectedLocation,
      }));
    });
  });

  it('states the terms of continuing, covering every way forward', async () => {
    const res: any = await render(
      <OnboardingAuthChoiceScreen
        navigation={navigation}
        route={{ params: { detectedLocation } }}
      />
    );

    const consent = res.getByTestId('onboarding-legal-consent');
    // Flattened text of the line and its two links.
    const words = [consent.props.children].flat(Infinity)
      .map((c: any) => (typeof c === 'string' ? c : c?.props?.children ?? ''))
      .join('');
    expect(words).toBe(
      'By continuing, you agree to our Terms of Service and confirm that you have read our Privacy Policy.'
    );
  });

  it('opens the Terms of Service and the Privacy Policy from the consent line', async () => {
    const res: any = await render(
      <OnboardingAuthChoiceScreen
        navigation={navigation}
        route={{ params: { detectedLocation } }}
      />
    );

    fireEvent.press(res.getByTestId('onboarding-terms-link'));
    expect(navigation.navigate).toHaveBeenCalledWith('LegalDocument', { doc: 'terms' });

    fireEvent.press(res.getByTestId('onboarding-privacy-link'));
    expect(navigation.navigate).toHaveBeenCalledWith('LegalDocument', { doc: 'privacy' });
  });

  it('does not render top back arrow button on screen', async () => {
    const res: any = await render(
      <OnboardingAuthChoiceScreen
        navigation={navigation}
        route={{ params: { detectedLocation } }}
      />
    );

    expect(res.queryByTestId('onboarding-auth-back-btn')).toBeNull();
  });
});
