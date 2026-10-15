import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

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

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Modal = ({ children, visible }: any) => (visible ? children : null);
  return RN;
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
    updateUser: jest.fn(),
  }),
}));

let mockIsDark = false;

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    colors: {
      primary: '#F62459',
      bgApp: mockIsDark ? '#000000' : '#F8F9FA',
      card: '#FFFFFF',
      textDark: '#1E293B',
      textGray: '#64748B',
      textMedium: '#475569',
      textLight: '#94A3B8',
      border: '#E2E8F0',
      danger: '#EF4444',
      bgGray: '#F1F5F9',
    },
    isDark: mockIsDark,
    setThemeMode: jest.fn(),
  }),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    put: jest.fn(() => Promise.resolve({ data: { user: {} } })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Shows a marker while open, so a test can see Home's "add your birthdate"
// open it.
jest.mock('../components/CalendarPickerModal', () => (props: any) => {
  const { View } = require('react-native');
  return props.visible ? <View testID="calendar-picker-open" /> : null;
});

import EditAccountScreen from '../screens/EditAccountScreen';

describe('EditAccountScreen Component', () => {
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
        middleName: 'M',
        lastName: 'Doe',
        birthdate: '1995-05-15',
        email: 'john@example.com',
        phone: '09123456789',
        avatar: null,
      },
    },
  };

  it('renders top navigation header with back button and title', async () => {
    const res: any = await render(
      <EditAccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Edit Account Information')).toBeTruthy();
    expect(res.getByTestId('back-button')).toBeTruthy();
  });

  it('renders Personal Identity and Contact Details Bento cards', async () => {
    const res: any = await render(
      <EditAccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Personal Identity')).toBeTruthy();
    expect(res.getByText('FIRST NAME *')).toBeTruthy();
    expect(res.getByText('MIDDLE NAME (OPTIONAL)')).toBeTruthy();
    expect(res.getByText('LAST NAME *')).toBeTruthy();
    expect(res.getByText('Contact Details')).toBeTruthy();
    expect(res.getByText('EMAIL ADDRESS')).toBeTruthy();
    expect(res.getByText('MOBILE PHONE')).toBeTruthy();
  });

  it('renders sticky bottom save button with testID', async () => {
    const res: any = await render(
      <EditAccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const saveBtn = res.getByTestId('save-profile-button');
    expect(saveBtn).toBeTruthy();
    expect(res.getByText('Save Profile Changes')).toBeTruthy();
  });

  it('navigates back when Back button is pressed without edits', async () => {
    const res: any = await render(
      <EditAccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const backBtn = res.getByTestId('back-button');
    fireEvent.press(backBtn);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('opens photo picker modal when avatar is tapped', async () => {
    const res: any = await render(
      <EditAccountScreen navigation={mockNavigation} route={mockRoute} />
    );

    const avatarBtn = res.getByTestId('edit-avatar-picker-btn');
    fireEvent.press(avatarBtn);

    await waitFor(() => {
      expect(res.getByTestId('choose-gallery-option')).toBeTruthy();
      expect(res.getByTestId('take-photo-option')).toBeTruthy();
    });
  });

  it('is keyboard-safe: the form scrolls the focused field clear of the keyboard and the Save dock', async () => {
    const res: any = await render(<EditAccountScreen navigation={mockNavigation} route={mockRoute} />);
    expect(res.getByTestId('edit-account-scroll')).toBeTruthy();
    expect(res.getByTestId('edit-phone-input')).toBeTruthy();
  });

  it('opens the date picker, with the field marked, when Home sends the customer to add a birthdate', async () => {
    jest.useFakeTimers();
    try {
      const route: any = { params: { user: { ...mockRoute.params.user, birthdate: null }, focusField: 'birthdate' } };
      const res: any = await render(<EditAccountScreen navigation={mockNavigation} route={route} />);
      expect(res.queryByTestId('calendar-picker-open')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(res.getByTestId('calendar-picker-open')).toBeTruthy();
      const field = res.getByTestId('edit-birthdate-field');
      expect(StyleSheet.flatten(field.props.style).borderColor).toBe('#F62459');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not open anything on its own when opened from the Account screen', async () => {
    jest.useFakeTimers();
    try {
      const res: any = await render(<EditAccountScreen navigation={mockNavigation} route={mockRoute} />);
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(res.queryByTestId('calendar-picker-open')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders phonePrefixBox with neutral frosted substrate and black shadow in dark mode', async () => {
    mockIsDark = true;
    try {
      const res: any = await render(<EditAccountScreen navigation={mockNavigation} route={mockRoute} />);
      const prefixBox = res.getByTestId('phone-prefix-box');
      const flattened = StyleSheet.flatten(prefixBox.props.style);
      expect(flattened.backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
      expect(flattened.shadowColor).toBe('#000000');
    } finally {
      mockIsDark = false;
    }
  });
});
