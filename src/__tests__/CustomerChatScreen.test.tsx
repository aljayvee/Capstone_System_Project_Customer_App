import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { FlatList } from 'react-native';

jest.setTimeout(30000);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

let mockMessagesData: Record<string, any> = {};
let mockOtherPresenceData: any = { online: true, name: 'Dispatcher Dan' };
let mockOtherTypingData: any = { isTyping: false, name: 'Dispatcher Dan' };
let messageListenerCallback: ((snap: any) => void) | null = null;
// How many times the messages listener is refused before it is allowed, the
// way RTDB answers a listener opened without a Firebase session.
let mockMessageRefusals = 0;
// The errand's payment plan, as GET /errands/:id returns it. Null is COD.
let mockPaymentPlan: any = null;
const mockEnsureRealtimeSession = jest.fn();
const mockRenewRealtimeSession = jest.fn(() => Promise.resolve(true));
// What the phone's radio says. The refusal banner may only blame the network
// when this is false.
let mockIsConnected = true;
const mockPush = jest.fn((..._args: any[]) => Promise.resolve());
const mockSet = jest.fn((..._args: any[]) => Promise.resolve());
const mockUpdate = jest.fn((..._args: any[]) => Promise.resolve());

jest.mock('../firebase/config', () => ({
  database: {},
  auth: {},
  app: {},
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn((db: any, path: string) => ({ path })),
  push: (refObj: any, val: any) => mockPush(refObj, val),
  set: (refObj: any, val: any) => mockSet(refObj, val),
  update: (refObj: any, val: any) => mockUpdate(refObj, val),
  onDisconnect: jest.fn(() => ({
    set: jest.fn(() => Promise.resolve()),
  })),
  onValue: jest.fn((refObj: any, callback: (snap: any) => void, onError?: (err: Error) => void) => {
    if (refObj?.path?.includes('presence/dispatcher')) {
      callback({ val: () => mockOtherPresenceData });
    } else if (refObj?.path?.includes('typing/dispatcher')) {
      callback({ val: () => mockOtherTypingData });
    } else if (refObj?.path?.includes('meta')) {
      callback({ val: () => ({ dispatcherName: 'Dispatcher Dan', dispatcherId: 42 }) });
    } else if (refObj?.path?.includes('.info/connected')) {
      callback({ val: () => true });
    } else if (refObj?.path?.includes('messages')) {
      if (mockMessageRefusals > 0) {
        mockMessageRefusals -= 1;
        onError?.(new Error('permission_denied at /chats: Client does not have permission'));
      } else {
        messageListenerCallback = callback;
        callback({ val: () => mockMessagesData });
      }
    } else {
      callback({ val: () => null });
    }
    return jest.fn();
  }),
}));

jest.mock('../firebase/realtimeSession', () => ({
  ensureRealtimeSession: () => mockEnsureRealtimeSession(),
  renewRealtimeSession: () => mockRenewRealtimeSession(),
  settleRealtimeSession: jest.fn(() => Promise.resolve(true)),
  endRealtimeSession: jest.fn(() => Promise.resolve()),
}));

jest.mock('../context/NetworkContext', () => ({
  useNetworkStatus: () => ({
    isConnected: mockIsConnected,
    isSlow: false,
    justReconnected: false,
    retry: async () => {},
    reconnectCount: 0,
  }),
}));

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() =>
    Promise.resolve({
      on: jest.fn(),
      off: jest.fn(),
    })
  ),
  subscribeToErrand: jest.fn(() => Promise.resolve()),
  unsubscribeFromErrand: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn((url: string) => {
      if (url.includes('/rating')) {
        return Promise.reject(new Error('No rating'));
      }
      return Promise.resolve({
        data: {
          id: 'PABILI-123456',
          status: 'PENDING',
          categories: 'Fast Food & Restaurant',
          paymentPlan: mockPaymentPlan,
        },
      });
    }),
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

// First in the file on purpose: the decline test at the end of the next block
// leaves an act() unfinished, and anything rendered after it commits nothing.
describe('CustomerChatScreen (the half-payment asked for mid-way)', () => {
  const route: any = {
    params: {
      user: { id: 'user-001', firstName: 'Maria', lastName: 'Santos', username: 'mariasantos' },
      errandId: 'PABILI-123456',
      initialStatus: 'IN_TRANSIT',
    },
  };
  const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };

  /** ₱1,170 of real receipts on the 50% plan. */
  const plan = (overrides: Record<string, unknown> = {}) => ({
    hasLedger: true,
    state: 'AWAITING_UPFRONT',
    dueUpFront: 585,
    goodsTotal: 1170,
    amountPaid: 0,
    balanceDue: 1290,
    halfPaymentRequestedAt: '2026-09-23T08:00:00.000Z',
    ...overrides,
  });

  const proofRequest = {
    m1: {
      senderId: 'disp-42',
      senderName: 'Dispatcher Dan',
      role: 'dispatcher',
      type: 'payment_proof_request',
      text: 'Once you have sent the ₱585.00, upload a screenshot of your GCash or PayMaya receipt here.',
      timestamp: Date.now() - 10000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageRefusals = 0;
    mockEnsureRealtimeSession.mockImplementation(() => Promise.resolve(true));
    mockMessagesData = proofRequest;
  });

  afterEach(() => {
    mockPaymentPlan = null;
  });

  it('opens the receipt upload when the dispatcher shows where to send it', async () => {
    mockPaymentPlan = plan();
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);

    await waitFor(() => {
      // Step 7: the modal, without the customer having to find it.
      expect(res.getByText('Payment receipt')).toBeTruthy();
      // And the amount stays in view above the thread while it is owed.
      expect(res.getByTestId('half-payment-banner')).toBeTruthy();
      expect(res.getByText(/Half-payment needed: ₱585\.00, half of the ₱1170\.00/)).toBeTruthy();
    });
    res.unmount();
  });

  it('asks for nothing before the rider has bought everything', async () => {
    // Same card in the thread, but the rider has not asked: there is no real
    // total yet, so there is nothing to send and the server would refuse it.
    mockPaymentPlan = plan({ halfPaymentRequestedAt: null });
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);

    await waitFor(() => {
      expect(res.getByText('Nothing to send yet')).toBeTruthy();
    });
    expect(res.queryByTestId('half-payment-banner')).toBeNull();
    expect(res.queryByText('Payment receipt')).toBeNull();
    res.unmount();
  });

  it('goes quiet once the half is paid', async () => {
    mockPaymentPlan = plan({ state: 'AWAITING_BALANCE', amountPaid: 585, balanceDue: 705 });
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);

    await waitFor(() => {
      expect(res.getByText('Half-payment received')).toBeTruthy();
    });
    expect(res.queryByTestId('half-payment-banner')).toBeNull();
    res.unmount();
  });
});

describe('CustomerChatScreen (Messenger-Style Chat UI, Presence & New Message Pill)', () => {
  const mockUser = {
    id: 'user-001',
    firstName: 'Maria',
    lastName: 'Santos',
    username: 'mariasantos',
  };

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    params: {
      user: mockUser,
      errandId: 'PABILI-123456',
      initialStatus: 'PENDING',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesData = {
      msg1: {
        senderId: 'disp-42',
        senderName: 'Dispatcher Dan',
        role: 'dispatcher',
        type: 'text',
        text: 'Hello Maria! Reviewing your order now.',
        timestamp: Date.now() - 60000,
      },
      msg2: {
        senderId: 'user-001',
        senderName: 'Maria',
        role: 'customer',
        type: 'text',
        text: 'Thank you! Please make sure the fries are hot.',
        timestamp: Date.now() - 30000,
      },
    };
    mockOtherPresenceData = { online: true, name: 'Dispatcher Dan' };
    mockOtherTypingData = { isTyping: false, name: 'Dispatcher Dan' };
    mockMessageRefusals = 0;
    mockIsConnected = true;
    mockEnsureRealtimeSession.mockImplementation(() => Promise.resolve(true));
  });

  it('opens the chat listener only after the Firebase session settles', async () => {
    let settle: (ok: boolean) => void = () => {};
    mockEnsureRealtimeSession.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => { settle = resolve; })
    );
    const { onValue } = jest.requireMock('firebase/database');
    const messageListens = () =>
      onValue.mock.calls.filter(([refObj]: any[]) => refObj?.path?.endsWith('/messages')).length;

    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    // Opened any earlier, RTDB refuses it and never re-sends the listen.
    expect(messageListens()).toBe(0);

    await act(async () => {
      settle(true);
    });

    await waitFor(() => {
      expect(res.getByText('Hello Maria! Reviewing your order now.')).toBeTruthy();
    });
    expect(messageListens()).toBe(1);
  });

  // A refusal is the database turning down this device's identity, typically
  // an ID token that expired while the phone slept. The app still reports
  // itself signed in, so only a renewed session gets the chat back (2026-10-11).
  it('renews a refused session without showing anything, and opens the chat', async () => {
    mockMessageRefusals = 1;

    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getByText('Hello Maria! Reviewing your order now.')).toBeTruthy();
    });
    expect(res.queryByTestId('chat-connection-error-banner')).toBeNull();
    expect(mockRenewRealtimeSession).toHaveBeenCalledTimes(1);
  });

  it('shows the banner, without blaming the network, only when the renewed session is refused too', async () => {
    mockMessageRefusals = 2;

    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getByTestId('chat-connection-error-banner')).toBeTruthy();
    });
    expect(res.getByText("This chat didn't open")).toBeTruthy();
    expect(res.queryByText(/Wi-Fi|lost the connection/)).toBeNull();

    await act(async () => {
      fireEvent.press(res.getByTestId('tap-to-refresh-chat-connection-btn'));
    });

    await waitFor(() => {
      expect(res.queryByTestId('chat-connection-error-banner')).toBeNull();
      expect(res.getByText('Hello Maria! Reviewing your order now.')).toBeTruthy();
    });
    // Once silently, once for the tap: Try again must not reopen the chat
    // under the identity that was just refused.
    expect(mockRenewRealtimeSession).toHaveBeenCalledTimes(2);
  });

  it('says the phone is offline only when it is', async () => {
    mockMessageRefusals = 2;
    mockIsConnected = false;

    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getByText("You're offline")).toBeTruthy();
    });
  });


  it('renders Messenger-style header with Active now presence badge', async () => {
    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getAllByText('Dispatcher Dan').length).toBeGreaterThan(0);
      expect(res.getByText('Active now')).toBeTruthy();
      expect(res.getByTestId('chat-header-presence-dot')).toBeTruthy();
    });
  });

  it('renders conversation bubbles from customer and dispatcher', async () => {
    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getByText('Hello Maria! Reviewing your order now.')).toBeTruthy();
      expect(res.getByText('Thank you! Please make sure the fries are hot.')).toBeTruthy();
    });
  });

  // 2026-10-14: the order summary nested three boxes with 10, 8 and 6 dp
  // inside and 4 dp between items. The category box is gone; items have room.
  it('lays the order summary out with an unboxed category and spaced items', async () => {
    const { StyleSheet } = require('react-native');
    mockMessagesData = {
      ...mockMessagesData,
      oc1: {
        id: 'oc1',
        senderId: 'disp-42',
        senderName: 'Dispatcher Dan',
        role: 'dispatcher',
        type: 'order_confirmation',
        groupedItems: {
          'Mercury Drug': {
            Medicine: [
              { itemName: 'Biogesic', quantity: 2 },
              { itemName: 'Isopropyl Alcohol', quantity: 1 },
            ],
          },
        },
        deliveryFee: 70,
        timestamp: Date.now(),
      },
    };

    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );
    await waitFor(() => expect(res.getByText('Biogesic')).toBeTruthy());

    const category = StyleSheet.flatten(res.getByTestId('order-category-0-0').props.style);
    expect(category.borderWidth ?? 0).toBe(0);
    expect(category.backgroundColor).toBeUndefined();
    expect(category.gap).toBeGreaterThanOrEqual(8);

    expect(StyleSheet.flatten(res.getByTestId('order-items-0-0').props.style).gap).toBeGreaterThanOrEqual(8);
  });

  it('displays typing indicator when otherTyping is true', async () => {
    mockOtherTypingData = { isTyping: true, name: 'Dispatcher Dan', timestamp: Date.now() };

    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getByTestId('chat-typing-indicator')).toBeTruthy();
      expect(res.getByText('Dispatcher Dan is typing...')).toBeTruthy();
    });
  });

  it('allows user to type and send message via input bar', async () => {
    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    const input = await res.findByTestId('chat-text-input');
    fireEvent.changeText(input, 'Can you add extra gravy please?');

    await waitFor(() => {
      const sendBtn = res.getByTestId('send-message-button');
      expect(sendBtn.props.accessibilityState?.disabled).toBeFalsy();
    });

    const sendBtn = res.getByTestId('send-message-button');
    fireEvent.press(sendBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'chats/PABILI-123456/messages' }),
        expect.objectContaining({
          text: 'Can you add extra gravy please?',
          role: 'customer',
          senderId: 'user-001',
        })
      );
    });
  });

  it('displays New Message [N] pill button when scrolled up and new messages arrive', async () => {
    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getByText('Hello Maria! Reviewing your order now.')).toBeTruthy();
    });

    // Simulate user scrolling up
    const flatList = res.getByTestId('chat-messages-flatlist');
    fireEvent.scroll(flatList, {
      nativeEvent: {
        layoutMeasurement: { height: 600 },
        contentOffset: { y: 100 },
        contentSize: { height: 1800 },
      },
    });

    // New message arrives from dispatcher
    const updatedMessages = {
      ...mockMessagesData,
      msg3: {
        senderId: 'disp-42',
        senderName: 'Dispatcher Dan',
        role: 'dispatcher',
        type: 'text',
        text: 'Your order has been confirmed by the store!',
        timestamp: Date.now(),
      },
    };

    if (messageListenerCallback) {
      messageListenerCallback({ val: () => updatedMessages });
    }

    await waitFor(() => {
      expect(res.getByTestId('new-messages-pill')).toBeTruthy();
      expect(res.getByText('New Message [1]')).toBeTruthy();
    });

    // Tapping the pill dismisses it
    const pill = res.getByTestId('new-messages-pill');
    fireEvent.press(pill);

    await waitFor(() => {
      expect(res.queryByTestId('new-messages-pill')).toBeNull();
    });
  });

  it('opens Decline / Adjust modal and submits customer adjustment response', async () => {
    const revisionMessage = {
      ...mockMessagesData,
      rev1: {
        id: 'rev1',
        senderId: 'disp-42',
        senderName: 'Dispatcher Dan',
        role: 'dispatcher',
        type: 'system',
        systemKind: 'item_revision',
        text: 'ITEM CHECK\nStill going ahead:\n• 1 × Pancit / Noodles',
        revision: {
          items: [
            { itemName: 'Pancit / Noodles', quantity: 1, available: true },
            { itemName: '70% Isopropyl Alcohol', quantity: 0, available: false },
          ],
        },
        status: 'pending',
        timestamp: Date.now(),
      },
    };

    mockMessagesData = revisionMessage;

    const res: any = await render(
      <CustomerChatScreen route={mockRoute} navigation={mockNavigation} />
    );

    await waitFor(() => {
      expect(res.getByText('Decline / Adjust')).toBeTruthy();
      expect(res.getByText('Proceed with Changes ✓')).toBeTruthy();
    });

    // Press Decline / Adjust
    fireEvent.press(res.getByText('Decline / Adjust'));

    await waitFor(() => {
      expect(res.getByText('Decline or Request Adjustment')).toBeTruthy();
      expect(res.getByText('Skip unavailable items')).toBeTruthy();
    });

    // Select preset chip
    fireEvent.press(res.getByText('Skip unavailable items'));

    await act(async () => {
      fireEvent.press(res.getByText('Send Response'));
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'chats/PABILI-123456/messages/rev1' }),
        expect.objectContaining({
          status: 'rejected',
          rejectionReason: 'Skip unavailable items',
        })
      );
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'chats/PABILI-123456/messages' }),
        expect.objectContaining({
          role: 'customer',
          text: expect.stringContaining('❌ I have declined these changes. Note: "Skip unavailable items"'),
        })
      );
    });

    await waitFor(() => {
      expect(res.queryByText('Decline or Request Adjustment')).toBeNull();
    });

    res.unmount();
  });
});
