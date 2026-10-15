import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GoogleSignInButton from '../components/GoogleSignInButton';

describe('GoogleSignInButton', () => {
  it('renders default button with Continue with Google text', async () => {
    const onPress = jest.fn();
    const res: any = await render(
      <GoogleSignInButton onPress={onPress} testID="test-google-button" />
    );

    expect(res.getByText('Continue with Google')).toBeTruthy();
    expect(res.getByTestId('test-google-button')).toBeTruthy();
  });

  it('renders custom text when provided', async () => {
    const onPress = jest.fn();
    const res: any = await render(
      <GoogleSignInButton onPress={onPress} text="Sign Up with Google" />
    );

    expect(res.getByText('Sign Up with Google')).toBeTruthy();
  });

  it('renders spinner with "Signing In..." text when loading and loadingText="Signing In..."', async () => {
    const onPress = jest.fn();
    const res: any = await render(
      <GoogleSignInButton
        onPress={onPress}
        loading={true}
        loadingText="Signing In..."
      />
    );

    // Default text is replaced
    expect(res.queryByText('Continue with Google')).toBeNull();
    // Signing In... text is present
    expect(res.getByText('Signing In...')).toBeTruthy();
  });

  it('renders ActivityIndicator when loading without loadingText', async () => {
    const onPress = jest.fn();
    const res: any = await render(
      <GoogleSignInButton
        onPress={onPress}
        loading={true}
        testID="google-loading-btn"
      />
    );

    expect(res.queryByText('Continue with Google')).toBeNull();
    expect(res.queryByText('Signing In...')).toBeNull();
    expect(res.getByTestId('google-loading-btn')).toBeTruthy();
  });

  it('triggers onPress callback when clicked in normal state', async () => {
    const onPress = jest.fn();
    const res: any = await render(
      <GoogleSignInButton onPress={onPress} testID="google-btn" />
    );

    fireEvent.press(res.getByTestId('google-btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('prevents onPress when button is loading or disabled', async () => {
    const onPress = jest.fn();
    const res: any = await render(
      <GoogleSignInButton onPress={onPress} loading={true} testID="google-btn" />
    );

    fireEvent.press(res.getByTestId('google-btn'));
    expect(onPress).not.toHaveBeenCalled();

    res.rerender(
      <GoogleSignInButton onPress={onPress} disabled={true} testID="google-btn" />
    );
    fireEvent.press(res.getByTestId('google-btn'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
