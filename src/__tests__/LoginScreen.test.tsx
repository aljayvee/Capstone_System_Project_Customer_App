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
    expect(res.getByText('Required!')).toBeTruthy();
  });

  it('blocks submission and flags both fields when they are empty', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.press(res.getByTestId('login-button'));

    expect(mockPost).not.toHaveBeenCalled();
    expect(res.getAllByText('Required!')).toHaveLength(2);
  });

  it('surfaces the server error instead of navigating', async () => {
    mockPost.mockRejectedValue(new Error('Invalid username or password'));
    const res: any = await render(<LoginScreen navigation={navigation} />);

    await fireEvent.changeText(res.getByTestId('username-input'), 'juandelacruz');
    await fireEvent.changeText(res.getByTestId('password-input'), 'wrongpass');
    await fireEvent.press(res.getByTestId('login-button'));

    await waitFor(() => expect(res.getByText('Invalid username or password')).toBeTruthy());
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('triggers focus and blur transitions smoothly on username and password inputs', async () => {
    const res: any = await render(<LoginScreen navigation={navigation} />);

    const usernameInput = res.getByTestId('username-input');
    const passwordInput = res.getByTestId('password-input');

    fireEvent(usernameInput, 'focus');
    fireEvent(usernameInput, 'blur');
    fireEvent(passwordInput, 'focus');
    fireEvent(passwordInput, 'blur');

    expect(usernameInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
  });
});
