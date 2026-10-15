import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

/**
 * When the customer can still talk to their dispatcher.
 *
 * The order being settled and the conversation being over are two different
 * things, and they used to share one flag. Once a rider was ASSIGNED the
 * customer's input bar was replaced by "This errand is currently closed" —
 * while the dispatcher's own CLOSED_STATUSES (OrderChatScreen.tsx) never
 * included ASSIGNED, so the dispatcher could still send. The customer simply
 * could not answer.
 *
 * That matters most in exactly the case the half-payment flow creates: a
 * receipt rings up higher than the customer agreed to, the rider is held at the
 * door, and the dispatcher has to reach the customer to arrange the difference.
 *
 * Lives in its own file rather than beside the other CustomerChatScreen tests
 * because that suite leaves enough un-awaited async work behind that a seventh
 * mount of this screen renders an empty tree. A separate file gets a fresh
 * module registry and makes these deterministic.
 */

jest.setTimeout(30000);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

const mockPush = jest.fn((..._args: any[]) => Promise.resolve());

jest.mock('../firebase/config', () => ({ database: {}, auth: {}, app: {} }));

jest.mock('firebase/database', () => ({
  ref: jest.fn((db: any, path: string) => ({ path })),
  push: (refObj: any, val: any) => mockPush(refObj, val),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  onDisconnect: jest.fn(() => ({ set: jest.fn(() => Promise.resolve()) })),
  onValue: jest.fn((refObj: any, callback: (snap: any) => void) => {
    if (refObj?.path?.includes('presence/dispatcher')) {
      callback({ val: () => ({ online: true, name: 'Dispatcher Dan' }) });
    } else if (refObj?.path?.includes('typing/dispatcher')) {
      callback({ val: () => ({ isTyping: false, name: 'Dispatcher Dan' }) });
    } else if (refObj?.path?.includes('meta')) {
      callback({ val: () => ({ dispatcherName: 'Dispatcher Dan', dispatcherId: 42 }) });
    } else if (refObj?.path?.includes('.info/connected')) {
      callback({ val: () => true });
    } else {
      callback({ val: () => null });
    }
    return jest.fn();
  }),
}));

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn() })),
  subscribeToErrand: jest.fn(() => Promise.resolve()),
  unsubscribeFromErrand: jest.fn(() => Promise.resolve()),
}));

// The status the server reports. Driven as a module-level knob, the way the
// sibling suite drives presence and typing.
let mockErrandStatus = 'PENDING';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn((url: string) =>
      url.includes('/rating')
        ? Promise.reject(new Error('No rating'))
        : Promise.resolve({
            data: {
              id: 'PABILI-123456',
              status: mockErrandStatus,
              categories: 'Fast Food & Restaurant',
            },
          })
    ),
    post: jest.fn(() => Promise.resolve({ data: { success: true } })),
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
      borderLight: '#F3F4F6',
      danger: '#EF4444',
    },
  }),
}));

import CustomerChatScreen from '../screens/CustomerChatScreen';

describe('CustomerChatScreen — when the conversation stays open', () => {
  const mockNavigation: any = { navigate: jest.fn(), goBack: jest.fn() };

  const routeAt = (status: string): any => ({
    params: {
      user: { id: 'user-001', firstName: 'Maria', lastName: 'Santos', username: 'mariasantos' },
      errandId: 'PABILI-123456',
      initialStatus: status,
    },
  });

  const renderAtStatus = (status: string) => {
    mockErrandStatus = status;
    return render(<CustomerChatScreen route={routeAt(status)} navigation={mockNavigation} />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockErrandStatus = 'PENDING';
  });

  it.each(['ASSIGNED', 'IN_TRANSIT'])(
    'lets the customer send a message while the errand is %s',
    async (status) => {
      const res: any = await renderAtStatus(status);

      const input = await res.findByTestId('chat-text-input');
      fireEvent.changeText(input, 'The receipt looks higher than we agreed?');

      await waitFor(() => {
        expect(
          res.getByTestId('send-message-button').props.accessibilityState?.disabled
        ).toBeFalsy();
      });

      fireEvent.press(res.getByTestId('send-message-button'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({ path: 'chats/PABILI-123456/messages' }),
          expect.objectContaining({
            role: 'customer',
            text: 'The receipt looks higher than we agreed?',
          })
        );
      });
    }
  );

  it.each([
    ['DELIVERED', 'This errand was delivered. Conversation is archived.'],
    ['COMPLETED', 'This errand is completed. Conversation is archived.'],
    ['CANCELLED', 'This errand was cancelled. Conversation is archived.'],
  ])('archives the conversation once the errand is %s', async (status, notice) => {
    const res: any = await renderAtStatus(status);

    await waitFor(() => {
      expect(res.getByText(notice)).toBeTruthy();
    });

    expect(res.queryByTestId('chat-text-input')).toBeNull();
  });

  it('shows rating modal when errand is DELIVERED and unrated', async () => {
    const res: any = await renderAtStatus('DELIVERED');

    await waitFor(() => {
      expect(res.getByText('How was your errand?')).toBeTruthy();
      expect(res.getByText("Rate your rider's service for this delivery.")).toBeTruthy();
    });
  });

  it('still freezes the order itself once a rider is assigned', async () => {
    // The conversation reopening must not reopen the ORDER. Payment mode is
    // settled at dispatch, and the button that would change it stays disabled.
    const res: any = await renderAtStatus('ASSIGNED');

    await res.findByTestId('chat-text-input');

    const paymentButton = res.queryByTestId('open-payment-modal');
    if (paymentButton) {
      expect(paymentButton.props.accessibilityState?.disabled).toBeTruthy();
    }
  });

  it('disables action buttons when DELIVERED while keeping view map active', async () => {
    const res: any = await renderAtStatus('DELIVERED');

    await waitFor(() => {
      expect(res.getByText('This errand was delivered. Conversation is archived.')).toBeTruthy();
    });

    // Header info button is disabled
    const infoButton = res.queryByTestId('header-view-details-button');
    if (infoButton) {
      expect(infoButton.props.accessibilityState?.disabled).toBeTruthy();
    }
  });
});
