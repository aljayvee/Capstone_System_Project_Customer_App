// One device signs in as ONE account at a time.
//
// Reported 2026-10-28: on the login screen the customer could press "Log In"
// (username + password) and "Continue with Google" together, and both requests
// went out. Each answered with its own account's tokens, and both were handed
// to AuthContext.login, whose writes interleave across its awaits - so the app
// could show one account while its API calls ran as the other, and the losing
// account's refresh session stayed live on the server.
import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';

const mockPost = jest.fn();
const mockLogin = jest.fn();
const mockGoogleSignIn = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: any[]) => mockPost(...args) },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../services/googleAuth', () => ({
  signInWithGoogleNative: (...args: any[]) => mockGoogleSignIn(...args),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve(null)),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

import LoginScreen from '../screens/LoginScreen';

const navigation = { replace: jest.fn(), navigate: jest.fn() };

const PASSWORD_ACCOUNT = { user: { id: 11, username: 'juan' }, token: 'tok-juan', refreshToken: 'rt-juan' };
const GOOGLE_ACCOUNT = { user: { id: 22, username: 'maria.g' }, token: 'tok-maria', refreshToken: 'rt-maria' };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  mockPost.mockReset();
  mockLogin.mockReset();
  mockGoogleSignIn.mockReset();
  navigation.replace.mockReset();
  navigation.navigate.mockReset();
  mockGoogleSignIn.mockResolvedValue({
    firebaseIdToken: 'google-id-token',
    email: 'maria@gmail.com',
    firstName: 'Maria',
    lastName: 'G',
    googleUid: 'g-uid',
  });
});

afterEach(() => cleanup());

// RNTL 14's fireEvent resolves with the handler's own return value, so awaiting
// a press whose sign-in is held open never returns. Fire, then let the press's
// own act() settle (a second act() opened on top of it corrupts later tests).
const flush = () => new Promise((r) => setTimeout(r, 0));
async function press(el: any) {
  void fireEvent.press(el);
  await flush();
}

async function fillPasswordForm(res: any) {
  await fireEvent.changeText(res.getByTestId('username-input'), 'juan');
  await fireEvent.changeText(res.getByTestId('password-input'), 'secret123');
}

describe('LoginScreen signs in one account at a time', () => {
  it('ignores "Log In" while a Google sign-in is still in flight', async () => {
    const google = deferred<any>();
    mockPost.mockImplementation((url: string) =>
      url === '/customers/google-login' ? google.promise : Promise.resolve({ data: PASSWORD_ACCOUNT })
    );
    const res: any = await render(<LoginScreen navigation={navigation} />);
    await fillPasswordForm(res);

    await press(res.getByTestId('login-google-button'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/customers/google-login', expect.anything()));
    await press(res.getByTestId('login-button'));
    void fireEvent(res.getByTestId('password-input'), 'submitEditing');
    await flush();

    await act(async () => { google.resolve({ data: GOOGLE_ACCOUNT }); });

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(mockPost).not.toHaveBeenCalledWith('/customers/login', expect.anything());
    expect(mockLogin).toHaveBeenCalledWith(GOOGLE_ACCOUNT.user, 'tok-maria', 'rt-maria');
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('ignores "Continue with Google" while a password sign-in is still in flight', async () => {
    const password = deferred<any>();
    mockPost.mockImplementation((url: string) =>
      url === '/customers/login' ? password.promise : Promise.resolve({ data: GOOGLE_ACCOUNT })
    );
    const res: any = await render(<LoginScreen navigation={navigation} />);
    await fillPasswordForm(res);

    await press(res.getByTestId('login-button'));
    await press(res.getByTestId('login-google-button'));

    await act(async () => { password.resolve({ data: PASSWORD_ACCOUNT }); });

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalledWith('/customers/google-login', expect.anything());
    expect(mockLogin).toHaveBeenCalledWith(PASSWORD_ACCOUNT.user, 'tok-juan', 'rt-juan');
  });

  it('starts only one sign-in when both buttons are pressed in the same tick', async () => {
    mockPost.mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/customers/login' ? PASSWORD_ACCOUNT : GOOGLE_ACCOUNT })
    );
    const res: any = await render(<LoginScreen navigation={navigation} />);
    await fillPasswordForm(res);

    const logIn = res.getByTestId('login-button');
    const google = res.getByTestId('login-google-button');
    // One act() scope: both handlers run before React re-renders, so `disabled`
    // is still false for the second press. Only the shared guard can stop it.
    await act(async () => {
      void fireEvent.press(logIn);
      void fireEvent.press(google);
    });

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('frees the other button again once a sign-in fails', async () => {
    mockPost.mockImplementation((url: string) =>
      url === '/customers/login'
        ? Promise.reject(Object.assign(new Error('x'), { status: 401 }))
        : Promise.resolve({ data: GOOGLE_ACCOUNT })
    );
    const res: any = await render(<LoginScreen navigation={navigation} />);
    await fillPasswordForm(res);

    await fireEvent.press(res.getByTestId('login-button'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(res.getByText('Log In')).toBeTruthy());

    await fireEvent.press(res.getByTestId('login-google-button'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(mockLogin).toHaveBeenCalledWith(GOOGLE_ACCOUNT.user, 'tok-maria', 'rt-maria');
  });
});
