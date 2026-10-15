import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';

const mockPost = jest.fn();
const mockLogin = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: any[]) => mockPost(...args) },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve(null)),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

import { ApiError } from '../services/ApiError';
import LoginScreen from '../screens/LoginScreen';

const navigation = { replace: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  mockPost.mockReset();
  mockLogin.mockReset();
  navigation.replace.mockReset();
  navigation.navigate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('LoginScreen', () => {
  it('renders the remodelled screen with a single username-or-email field and no social sign-in', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    expect(res.getByText('Login')).toBeTruthy();
    expect(res.getByPlaceholderText('Enter your username or email')).toBeTruthy();
    expect(res.getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(res.getByTestId('login-button')).toBeTruthy();
    expect(res.getByTestId('register-link')).toBeTruthy();

    // The reference design's social block was explicitly dropped.
    expect(res.queryByText('Or Continue With')).toBeNull();
    expect(res.queryByText('Apple')).toBeNull();
    expect(res.queryByText('Google')).toBeNull();
  });

  it('offers a way out to the forgot-password flow', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    expect(res.getByText('Forgot Password?')).toBeTruthy();
    await fireEvent.press(res.getByTestId('forgot-password-link'));

    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('accepts an email address in the identifier field', async () => {
    mockPost.mockResolvedValue({ data: { user: { id: 1 }, token: 't' } });
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), 'juan@gmail.com');
    await fireEvent.changeText(res.getByTestId('password-input'), 'secret123');
    await fireEvent.press(res.getByTestId('login-button'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/customers/login', {
      username: 'juan@gmail.com',
      password: 'secret123',
    });
  });

  it('trims the edges of the password but keeps the spaces inside it', async () => {
    mockPost.mockResolvedValue({ data: { user: { id: 1 }, token: 't' } });
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), '  juandelacruz  ');
    await fireEvent.changeText(res.getByTestId('password-input'), '  my pass word  ');
    await fireEvent.press(res.getByTestId('login-button'));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith('/customers/login', {
      username: 'juandelacruz',
      password: 'my pass word',
    });
  });

  it('tells the customer that edge spaces are ignored', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    expect(res.queryByTestId('password-space-hint')).toBeNull();
    await fireEvent.changeText(res.getByTestId('password-input'), 'trailing ');
    expect(res.getByTestId('password-space-hint')).toBeTruthy();
  });

  it('does not warn about spaces that sit inside the password', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('password-input'), 'my pass word');
    expect(res.queryByTestId('password-space-hint')).toBeNull();
  });

  it('treats an all-spaces password as an empty field', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), 'juandelacruz');
    await fireEvent.changeText(res.getByTestId('password-input'), '      ');
    await fireEvent.press(res.getByTestId('login-button'));

    expect(mockPost).not.toHaveBeenCalled();
    expect(res.getByText('Required')).toBeTruthy();
  });

  it('blocks submission and flags both fields when they are empty', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.press(res.getByTestId('login-button'));

    expect(mockPost).not.toHaveBeenCalled();
    expect(res.getAllByText('Required')).toHaveLength(2);
  });

  it('reports a wrong password as a wrong password', async () => {
    // A 401 from /customers/login means the credentials were wrong. It used to
    // reach the interceptor's refresh branch instead and come back as "Your
    // session has expired", which is a different and alarming claim.
    mockPost.mockRejectedValue(new ApiError('Invalid username or password', { status: 401 }));
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), 'juandelacruz');
    await fireEvent.changeText(res.getByTestId('password-input'), 'wrongpass');
    await fireEvent.press(res.getByTestId('login-button'));

    await waitFor(() => expect(res.getByText('Wrong password.')).toBeTruthy());
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("never paints the server text into the banner", async () => {
    // The app talks to a deployed backend, and whatever it - or a CDN in front
    // of it - decides to say used to land here verbatim. Status code decides.
    mockPost.mockRejectedValue(
      new ApiError('please use secure cookies', { status: 401, serverMessage: 'please use secure cookies' })
    );
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), 'juandelacruz');
    await fireEvent.changeText(res.getByTestId('password-input'), 'wrongpass');
    await fireEvent.press(res.getByTestId('login-button'));

    await waitFor(() => expect(res.getByText('Wrong password.')).toBeTruthy());
    expect(res.queryByText('please use secure cookies')).toBeNull();
  });

  it('says the customer is offline when the request never lands', async () => {
    mockPost.mockRejectedValue(new ApiError('Network Error', { code: 'ERR_NETWORK', isOffline: true }));
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), 'juandelacruz');
    await fireEvent.changeText(res.getByTestId('password-input'), 'whatever');
    await fireEvent.press(res.getByTestId('login-button'));

    await waitFor(() =>
      expect(res.getByText("You're offline. Check your Wi-Fi or mobile data.")).toBeTruthy()
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('triggers focus and blur transitions smoothly on username and password inputs', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    const usernameInput = res.getByTestId('username-input');
    const passwordInput = res.getByTestId('password-input');

    await fireEvent(usernameInput, 'focus');
    await fireEvent(usernameInput, 'blur');
    await fireEvent(passwordInput, 'focus');
    await fireEvent(passwordInput, 'blur');

    expect(usernameInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
  });

  it('marks onboarding completed in AsyncStorage upon successful login', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    mockPost.mockResolvedValue({ data: { user: { id: 1 }, token: 't', refreshToken: 'rt' } });
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), 'juan@gmail.com');
    await fireEvent.changeText(res.getByTestId('password-input'), 'secret123');
    await fireEvent.press(res.getByTestId('login-button'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sugo_customer_onboarding_completed', 'true');
      expect(mockLogin).toHaveBeenCalled();
    });
  });
});
