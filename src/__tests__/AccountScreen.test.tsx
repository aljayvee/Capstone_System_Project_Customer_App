import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '09123456789',
    },
    logout: jest.fn(),
    updateUser: jest.fn(),
  }),
}));

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    colors: {
      primary: '#F62459',
      bgApp: '#F8F9FA',
      card: '#FFFFFF',
      textDark: '#1E293B',
      textGray: '#64748B',
      textMedium: '#475569',
      textLight: '#94A3B8',
      border: '#E2E8F0',
      danger: '#EF4444',
      bgGray: '#F1F5F9',
    },
    isDark: false,
  }),
}));

jest.mock('../components/MapPreviewField', () => () => null);
jest.mock('../components/ConfirmModal', () => () => null);

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

import AccountScreen from '../screens/AccountScreen';

describe('AccountScreen Component', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    params: {
      user: {
        id: 1,
        username: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '09123456789',
      },
    },
  };

  it('renders dedicated navigation header with back button and settings gear', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Account & Profile')).toBeTruthy();
    expect(res.getByTestId('back-button')).toBeTruthy();
    expect(res.getByTestId('account-settings-gear-button')).toBeTruthy();
  });

  it('calls goBack when header back button is pressed', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const backBtn = res.getByTestId('back-button');
    fireEvent.press(backBtn);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('navigates to Settings when gear button is pressed', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const settingsBtn = res.getByTestId('account-settings-gear-button');
    fireEvent.press(settingsBtn);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Settings', expect.anything());
  });

  it('navigates to EditAccount when Edit Profile Details is pressed', async () => {
    const res: any = await render(
      <AccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const editBtn = res.getByTestId('edit-profile-button');
    fireEvent.press(editBtn);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('EditAccount', expect.anything());
  });
});
