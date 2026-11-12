import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

jest.setTimeout(30000);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../firebase/config', () => ({
  database: {},
  auth: {},
  app: {},
}));

let mockMetaCallback: any = null;
jest.mock('firebase/database', () => ({
  ref: jest.fn((db, path) => ({ path })),
  onValue: jest.fn((refObj, callback) => {
    if (refObj?.path?.includes('meta')) {
      mockMetaCallback = callback;
      callback({ val: () => ({ dispatcherName: null }) });
    }
    return jest.fn();
  }),
}));

let mockSocketOnClaimed: any = null;
let mockSocketOnUpdated: any = null;
jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() =>
    Promise.resolve({
      on: jest.fn((event, handler) => {
        if (event === 'order:claimed') mockSocketOnClaimed = handler;
        if (event === 'order:updated') mockSocketOnUpdated = handler;
      }),
      off: jest.fn(),
    })
  ),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn((url: string) => {
      if (url.includes('/errands/user/')) {
        return Promise.resolve({
          data: [
            {
              id: 'PABILI-123456',
              status: 'PENDING',
              dispatchLogs: [],
            },
          ],
        });
      }
      if (url.includes('/decline-reasons')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    isDark: false,
    colors: {
      primary: '#F62459',
      card: '#FFFFFF',
      border: '#E5E7EB',
      textDark: '#1F2937',
      textGray: '#6B7280',
      textLight: '#9CA3AF',
      textMedium: '#4B5563',
      bgApp: '#F9FAFB',
      bgGray: '#F3F4F6',
      danger: '#EF4444',
    },
  }),
}));

import WaitingForDispatcherScreen from '../screens/WaitingForDispatcherScreen';

describe('WaitingForDispatcherScreen (Accomplishment Screen)', () => {
  const mockUser = {
    id: 1,
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    username: 'juandelacruz',
  };

  const mockNavigation: any = {
    navigate: jest.fn(),
    replace: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    params: {
      user: mockUser,
      errandId: 'PABILI-123456',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders accomplishment headline, order reference, and zero header back button', async () => {
    const res: any = await render(
      <WaitingForDispatcherScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Verify graceful accomplishment title
    expect(res.getByText('Your errand has been placed!')).toBeTruthy();

    // Verify graceful reassurance copy
    expect(
      res.getByText(
        "We've sent your request to active dispatchers in Tacurong. A dispatcher will review your order and connect with you in under a minute."
      )
    ).toBeTruthy();

    // Verify order capsule
    expect(res.getByTestId('order-id-capsule')).toBeTruthy();

    // Verify ZERO header back button
    expect(res.queryByTestId('back-button')).toBeNull();
    expect(res.queryByText('Errand Status')).toBeNull();

    // Verify removed clutter (What Happens Next, Errand Summary)
    expect(res.queryByText('What Happens Next')).toBeNull();
    expect(res.queryByText('Errand Summary')).toBeNull();
  });

  // 2026-10-14: this screen had the smallest text in the app (10 to 11.5 pt).
  it('sets no text smaller than 12 pt', async () => {
    const { StyleSheet } = require('react-native');
    const res: any = await render(
      <WaitingForDispatcherScreen route={mockRoute} navigation={mockNavigation} />
    );
    const sizes: number[] = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Text') {
        const size = StyleSheet.flatten(node.props.style)?.fontSize;
        if (typeof size === 'number') sizes.push(size);
      }
      (node.children ?? []).forEach(walk);
    };
    walk(res.container);

    expect(sizes.length).toBeGreaterThan(3);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  it('navigates to live chat when Open Live Chat button is tapped', async () => {
    const res: any = await render(
      <WaitingForDispatcherScreen route={mockRoute} navigation={mockNavigation} />
    );

    const chatBtn = res.getByTestId('open-chat-button');
    fireEvent.press(chatBtn);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomerChat', {
      user: mockUser,
      errandId: 'PABILI-123456',
    });
  });

  it('resets navigation to CustomerPortal when Return to Dashboard is tapped', async () => {
    const res: any = await render(
      <WaitingForDispatcherScreen route={mockRoute} navigation={mockNavigation} />
    );

    const dashBtn = res.getByTestId('back-to-dashboard-button');
    fireEvent.press(dashBtn);

    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'CustomerPortal', params: { user: mockUser } }],
    });
  });

  it('intercepts hardware back button on Android and resets to CustomerPortal without Keep Changes modal', async () => {
    const backSpy = jest.spyOn(BackHandler, 'addEventListener');

    await render(
      <WaitingForDispatcherScreen route={mockRoute} navigation={mockNavigation} />
    );

    expect(backSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));

    // Simulate hardware back press callback
    const backHandlerCallback: any = (backSpy.mock.calls[0] as any)[1];
    const handled = backHandlerCallback();

    expect(handled).toBe(true);
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'CustomerPortal', params: { user: mockUser } }],
    });
  });
});
