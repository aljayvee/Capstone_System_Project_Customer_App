import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPost = jest.fn();
const mockLogin = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: any[]) => mockPost(...args) },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

// The real picker is a month grid; the wizard only cares that a date comes back.
jest.mock('../components/CalendarPickerModal', () => {
  const ReactLib = require('react');
  const { Text } = require('react-native');
  return ({ visible, onSelectDate, onClose }: any) =>
    visible
      ? ReactLib.createElement(
          Text,
          {
            testID: 'pick-birthdate',
            onPress: () => {
              onSelectDate('2000-01-15');
              onClose();
            },
          },
          'pick a date'
        )
      : null;
});

import RegisterScreen from '../screens/RegisterScreen';

const navigation = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  mockPost.mockReset();
  mockLogin.mockReset();
  navigation.replace.mockReset();
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
});

// Walks the wizard from the name step to the OTP step, which is where the
// resend behaviour lives.
async function advanceToOtpStep(res: any) {
  await fireEvent.changeText(res.getByPlaceholderText('Enter first name'), 'Juan');
  await fireEvent.changeText(res.getByPlaceholderText('Enter last name'), 'Dela Cruz');
  await fireEvent.press(res.getByText('Continue'));

  await fireEvent.press(res.getByText('Tap to choose birthdate from calendar'));
  await fireEvent.press(res.getByTestId('pick-birthdate'));
  await fireEvent.press(res.getByText('Continue'));

  await fireEvent.changeText(res.getByPlaceholderText('name@example.com'), 'juan@gmail.com');
  await fireEvent.changeText(res.getByPlaceholderText('09123456789'), '09123456789');
  await fireEvent.press(res.getByText('Send Code via Email'));
  await waitFor(() => expect(res.getByText('Enter 6-Digit Code')).toBeTruthy());
}

describe('RegisterScreen', () => {
  it('opens on step 1 with the question in the hero and no social sign-up', async () => {
    const res: any = await render(<RegisterScreen navigation={navigation} />);

    expect(res.getByText('STEP 1 OF 5')).toBeTruthy();
    expect(res.getByText("What's your name?")).toBeTruthy();
    expect(res.getByPlaceholderText('Enter first name')).toBeTruthy();

    expect(res.queryByText('Or Continue With')).toBeNull();
    expect(res.queryByText('Apple')).toBeNull();
    expect(res.queryByText('Google')).toBeNull();
  });

  it('advances to step 2 once the name is filled in, swapping the hero question', async () => {
    const res: any = await render(<RegisterScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByPlaceholderText('Enter first name'), 'Juan');
    await fireEvent.changeText(res.getByPlaceholderText('Enter last name'), 'Dela Cruz');
    await fireEvent.press(res.getByText('Continue'));

    expect(res.getByText('STEP 2 OF 5')).toBeTruthy();
    expect(res.getByText('When were you born?')).toBeTruthy();
  });

  // Regression: stepping back from the code screen and pressing Send again used
  // to fire a second /send-registration-otp. verifyRegistrationOtp only ever
  // accepts the NEWEST code for an address, so the code already open in the
  // inbox silently stopped working.
  it('does not issue a second code when stepping back and pressing send again', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const res: any = await render(<RegisterScreen navigation={navigation} />);
    await advanceToOtpStep(res);
    expect(mockPost).toHaveBeenCalledTimes(1);

    await fireEvent.press(res.getByTestId('register-back'));
    await waitFor(() => expect(res.getByText('Account Verification')).toBeTruthy());
    await fireEvent.press(res.getByText('Back to Code'));

    // No second request, and the customer lands back on the code screen.
    expect(mockPost).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(res.getByText('Enter 6-Digit Code')).toBeTruthy());
  });

  it('does send a fresh code when the email is changed to another address', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const res: any = await render(<RegisterScreen navigation={navigation} />);
    await advanceToOtpStep(res);

    await fireEvent.press(res.getByTestId('register-back'));
    await waitFor(() => expect(res.getByText('Account Verification')).toBeTruthy());
    // A different address is a different mailbox — the cooldown must not apply.
    await fireEvent.changeText(res.getByPlaceholderText('name@example.com'), 'someone.else@gmail.com');
    await fireEvent.press(res.getByText('Send Code via Email'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenLastCalledWith('/customers/send-registration-otp', {
      email: 'someone.else@gmail.com',
    });
  });

  it('flags the missing fields instead of advancing when step 1 is blank', async () => {
    const res: any = await render(<RegisterScreen navigation={navigation} />);

    await fireEvent.press(res.getByText('Continue'));

    expect(res.getByText('First name required!')).toBeTruthy();
    expect(res.getByText('Last name required!')).toBeTruthy();
    expect(res.getByText('STEP 1 OF 5')).toBeTruthy();
  });

  it('leaves the screen from step 1 via the hero back button', async () => {
    const res: any = await render(<RegisterScreen navigation={navigation} />);

    await fireEvent.press(res.getByTestId('register-back'));

    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('offers the way back to sign in', async () => {
    const res: any = await render(<RegisterScreen navigation={navigation} />);

    await fireEvent.press(res.getByText('Log In'));

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
