import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

import AppNavigator from '../navigation/AppNavigator';

describe('AppNavigator Component', () => {
  it('renders initial route Login screen', async () => {
    const res: any = await render(<AppNavigator />);

    expect(res.getByText('Login')).toBeTruthy();
    // The single sign-in box takes a username OR an email address.
    expect(res.getByPlaceholderText('Enter your username or email')).toBeTruthy();
    expect(res.getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(res.getByTestId('login-button')).toBeTruthy();
    // The remodelled screen deliberately ships no social sign-in.
    expect(res.queryByText('Or Continue With')).toBeNull();
  });
});
