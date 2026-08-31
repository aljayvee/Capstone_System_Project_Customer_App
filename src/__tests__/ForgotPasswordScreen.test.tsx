import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPost = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: any[]) => mockPost(...args) },
}));

import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  mockPost.mockReset();
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
});

// Walks steps 1 and 2 so a test can start from the new-password step.
async function advanceToPasswordStep(res: any) {
  mockPost.mockResolvedValueOnce({ data: { message: 'sent', maskedEmail: 'ju**@gmail.com' } });
  await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
  await fireEvent.press(res.getByTestId('forgot-submit'));
  await waitFor(() => expect(res.getByTestId('forgot-code-input')).toBeTruthy());

  mockPost.mockResolvedValueOnce({ data: { resetToken: 'reset-token-abc' } });
  await fireEvent.changeText(res.getByTestId('forgot-code-input'), '123456');
  await fireEvent.press(res.getByTestId('forgot-submit'));
  await waitFor(() => expect(res.getByTestId('forgot-password-input')).toBeTruthy());
}

describe('ForgotPasswordScreen', () => {
  it('opens asking for the username or email, with no step indicator', async () => {
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    expect(res.getByText('Forgot your password?')).toBeTruthy();
    expect(res.getByTestId('forgot-identifier-input')).toBeTruthy();
    // The counter was deliberately removed — the hero headline is the only
    // signal of where in the flow the customer is.
    expect(res.queryByText(/STEP \d OF \d/)).toBeNull();
  });

  it('sends the honeypot field with the request, empty when a human filled the form', async () => {
    mockPost.mockResolvedValue({ data: { message: 'sent', maskedEmail: null } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), '  juandelacruz  ');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/customers/forgot-password', {
      identifier: 'juandelacruz',
      website: '',
    });
  });

  it('forwards whatever a bot typed into the honeypot so the server can log it', async () => {
    mockPost.mockResolvedValue({ data: { message: 'sent', maskedEmail: null } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    // includeHiddenElements is required precisely BECAUSE the trap works: the
    // field is hidden from the accessibility tree, so the default query cannot
    // see it either. Only a scraper walking the raw view tree reaches it.
    const trap = res.getByTestId('forgot-honeypot', { includeHiddenElements: true });
    await fireEvent.changeText(trap, 'http://spam.example');
    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/customers/forgot-password', {
      identifier: 'juandelacruz',
      website: 'http://spam.example',
    });
  });

  it('keeps the honeypot out of the accessibility tree, where no human can reach it', async () => {
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    // Default queries respect accessibility visibility — a screen reader or a
    // tabbing user has exactly this view of the form.
    expect(res.queryByTestId('forgot-honeypot')).toBeNull();
    expect(res.getByTestId('forgot-honeypot', { includeHiddenElements: true })).toBeTruthy();
  });

  it('advances to the code step even when no account matched, revealing nothing', async () => {
    // maskedEmail null is the server's "no such account" shape — the screen must
    // not treat it as an error, or it would rebuild the enumeration oracle the
    // API deliberately closed.
    mockPost.mockResolvedValue({ data: { message: 'If that account exists...', maskedEmail: null } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'ghost-account');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    await waitFor(() => expect(res.getByText('Check your email')).toBeTruthy());
    expect(res.queryByText(/no account/i)).toBeNull();
  });

  it('shows the masked address when the account is real', async () => {
    mockPost.mockResolvedValue({ data: { message: 'sent', maskedEmail: 'ju**@gmail.com' } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    await waitFor(() => expect(res.getByText('ju**@gmail.com')).toBeTruthy());
  });

  // Regression: going back from the code screen and pressing Send again used to
  // fire a second /forgot-password, which retires the previous code server-side
  // — so the code already open in the customer's inbox silently stopped working.
  it('does not issue a second code when going back and pressing send again', async () => {
    mockPost.mockResolvedValue({ data: { message: 'sent', maskedEmail: 'ju**@gmail.com' } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
    await fireEvent.press(res.getByTestId('forgot-submit'));
    await waitFor(() => expect(res.getByTestId('forgot-code-input')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledTimes(1);

    await fireEvent.press(res.getByTestId('forgot-back'));
    await waitFor(() => expect(res.getByTestId('forgot-identifier-input')).toBeTruthy());
    await fireEvent.press(res.getByTestId('forgot-submit'));

    // No second request, and the customer lands back on the code screen.
    expect(mockPost).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(res.getByTestId('forgot-code-input')).toBeTruthy());
  });

  it('tells the customer why no new code was sent instead of doing nothing', async () => {
    mockPost.mockResolvedValue({ data: { message: 'sent', maskedEmail: 'ju**@gmail.com' } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
    await fireEvent.press(res.getByTestId('forgot-submit'));
    await waitFor(() => expect(res.getByTestId('forgot-code-input')).toBeTruthy());

    await fireEvent.press(res.getByTestId('forgot-back'));
    // The button itself changes to say where it goes.
    await waitFor(() => expect(res.getByText('Back to Code')).toBeTruthy());

    await fireEvent.press(res.getByTestId('forgot-submit'));
    expect(res.getByText(/already sent a code/i)).toBeTruthy();
  });

  it('does send a fresh code when the identifier is changed to another account', async () => {
    mockPost.mockResolvedValue({ data: { message: 'sent', maskedEmail: null } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
    await fireEvent.press(res.getByTestId('forgot-submit'));
    await waitFor(() => expect(res.getByTestId('forgot-code-input')).toBeTruthy());

    await fireEvent.press(res.getByTestId('forgot-back'));
    await waitFor(() => expect(res.getByTestId('forgot-identifier-input')).toBeTruthy());
    // A different account is a different mailbox — the cooldown must not apply.
    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'someone.else');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenLastCalledWith('/customers/forgot-password', {
      identifier: 'someone.else',
      website: '',
    });
  });

  it('blocks a short code and never calls the API', async () => {
    mockPost.mockResolvedValueOnce({ data: { message: 'sent', maskedEmail: null } });
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);
    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
    await fireEvent.press(res.getByTestId('forgot-submit'));
    await waitFor(() => expect(res.getByTestId('forgot-code-input')).toBeTruthy());

    mockPost.mockClear();
    await fireEvent.changeText(res.getByTestId('forgot-code-input'), '123');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    expect(mockPost).not.toHaveBeenCalled();
    expect(res.getByText('Enter the 6 digits!')).toBeTruthy();
  });

  it('exchanges the code for a reset token and asks for the new password', async () => {
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);
    await advanceToPasswordStep(res);

    expect(mockPost).toHaveBeenNthCalledWith(2, '/customers/verify-reset-code', {
      identifier: 'juandelacruz',
      code: '123456',
    });
    expect(res.getByText('Set a new password')).toBeTruthy();
  });

  it('submits the new password edge-trimmed, carrying the reset token', async () => {
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);
    await advanceToPasswordStep(res);

    mockPost.mockResolvedValueOnce({ data: { message: 'ok' } });
    await fireEvent.changeText(res.getByTestId('forgot-password-input'), '  new pass word  ');
    await fireEvent.changeText(res.getByTestId('forgot-confirm-input'), '  new pass word  ');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    await waitFor(() => expect(res.getByTestId('forgot-done')).toBeTruthy());
    expect(mockPost).toHaveBeenLastCalledWith('/customers/reset-password', {
      resetToken: 'reset-token-abc',
      password: 'new pass word',
    });
  });

  it('rejects a mismatched confirmation before calling the API', async () => {
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);
    await advanceToPasswordStep(res);

    mockPost.mockClear();
    await fireEvent.changeText(res.getByTestId('forgot-password-input'), 'newpassword');
    await fireEvent.changeText(res.getByTestId('forgot-confirm-input'), 'different');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    expect(mockPost).not.toHaveBeenCalled();
    expect(res.getByText('Passwords do not match!')).toBeTruthy();
  });

  it('surfaces a throttle response from the server', async () => {
    mockPost.mockRejectedValue(
      new Error('Too many password reset attempts from this device. Please try again later.')
    );
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('forgot-identifier-input'), 'juandelacruz');
    await fireEvent.press(res.getByTestId('forgot-submit'));

    await waitFor(() =>
      expect(
        res.getByText('Too many password reset attempts from this device. Please try again later.')
      ).toBeTruthy()
    );
    // Still on the first screen — a throttled caller must not reach the code step.
    expect(res.getByText('Forgot your password?')).toBeTruthy();
  });

  it('returns to the login screen from the footer link', async () => {
    const res: any = await render(<ForgotPasswordScreen navigation={navigation} />);

    await fireEvent.press(res.getByTestId('forgot-login-link'));

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
