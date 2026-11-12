import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

/**
 * Choosing how to pay follows Approve on the order summary (2026-10-15).
 *
 * There is no payment card in the chat any more. Approve opens the choice in a
 * dialog with no way to close it; an approved summary with no choice on record
 * (the app was closed on the dialog) reads "Choose payment method" instead.
 * Debit/Credit Card is gone from the list.
 */

jest.setTimeout(30000);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

let mockMessagesData: Record<string, any> = {};
/** The choice on record, as the server reports it: on the errand, and on its own. */
let mockErrandSelection: any = null;
let mockSelectionEndpoint: any = null;
const mockPush = jest.fn((..._args: any[]) => Promise.resolve());
const mockUpdate = jest.fn((..._args: any[]) => Promise.resolve());
const mockAlert = jest.fn();

jest.mock('../firebase/config', () => ({ database: {}, auth: {}, app: {} }));

jest.mock('firebase/database', () => ({
  ref: jest.fn((_db: any, path: string) => ({ path })),
  push: (refObj: any, val: any) => mockPush(refObj, val),
  set: jest.fn(() => Promise.resolve()),
  update: (refObj: any, val: any) => mockUpdate(refObj, val),
  onDisconnect: jest.fn(() => ({ set: jest.fn(() => Promise.resolve()) })),
  onValue: jest.fn((refObj: any, callback: (snap: any) => void) => {
    if (refObj?.path?.includes('meta')) {
      callback({ val: () => ({ dispatcherName: 'Dispatcher Dan', dispatcherId: 42 }) });
    } else if (refObj?.path?.endsWith('/messages')) {
      callback({ val: () => mockMessagesData });
    } else {
      callback({ val: () => null });
    }
    return jest.fn();
  }),
}));

jest.mock('../firebase/realtimeSession', () => ({
  ensureRealtimeSession: jest.fn(() => Promise.resolve(true)),
  renewRealtimeSession: jest.fn(() => Promise.resolve(true)),
  settleRealtimeSession: jest.fn(() => Promise.resolve(true)),
  endRealtimeSession: jest.fn(() => Promise.resolve()),
}));

jest.mock('../context/NetworkContext', () => ({
  useNetworkStatus: () => ({
    isConnected: true,
    isSlow: false,
    justReconnected: false,
    retry: async () => {},
    reconnectCount: 0,
  }),
}));

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn() })),
  subscribeToErrand: jest.fn(() => Promise.resolve()),
  unsubscribeFromErrand: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/alertModal', () => ({
  showAppAlert: (...args: any[]) => mockAlert(...args),
}));

// The catalogue as production holds it after 2026-10-15: no card row.
const MODES = [
  { id: 1, name: 'Cash on Delivery', status: 'Active' },
  { id: 2, name: 'GCash / PayMaya', status: 'Active' },
  { id: 3, name: 'Bank Transfer', status: 'Active' },
];

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn((url: string) => {
      if (url.includes('/rating')) return Promise.reject(new Error('No rating'));
      if (url.includes('/payment-modes')) return Promise.resolve({ data: MODES });
      if (url.endsWith('/payment-selection')) return Promise.resolve({ data: mockSelectionEndpoint });
      return Promise.resolve({
        data: {
          id: 'PABILI-123456',
          status: 'PENDING',
          categories: 'Fast Food & Restaurant',
          paymentPlan: null,
          paymentSelection: mockErrandSelection,
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
      primaryLight: '#FFE4EC',
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
      overlay: 'rgba(0,0,0,0.5)',
    },
  }),
}));

import CustomerChatScreen from '../screens/CustomerChatScreen';
import { apiClient } from '../services/apiClient';

const route: any = {
  params: {
    user: { id: 'user-001', firstName: 'Maria', lastName: 'Santos', username: 'mariasantos' },
    errandId: 'PABILI-123456',
    initialStatus: 'PENDING',
  },
};
const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };

const orderCard = (overrides: Record<string, unknown> = {}) => ({
  id: 'oc1',
  senderId: 'disp-42',
  senderName: 'Dispatcher Dan',
  role: 'dispatcher',
  type: 'order_confirmation',
  groupedItems: { 'Mercury Drug': { Medicine: [{ itemName: 'Biogesic', quantity: 2 }] } },
  deliveryFee: 70,
  confirmed: false,
  status: 'pending',
  timestamp: Date.now() - 20000,
  ...overrides,
});

// A card an older dispatcher screen sent beside the list.
const legacyPaymentCard = {
  id: 'pp1',
  senderId: 'disp-42',
  senderName: 'Dispatcher Dan',
  role: 'dispatcher',
  type: 'payment_prompt',
  text: 'Please choose your payment method so I can confirm it.',
  timestamp: Date.now() - 10000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockErrandSelection = null;
  mockSelectionEndpoint = null;
});

describe('CustomerChatScreen, choosing how to pay', () => {
  it('shows no payment card, only the order summary to approve', async () => {
    mockMessagesData = { oc1: orderCard(), pp1: legacyPaymentCard };
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);

    await waitFor(() => expect(res.getByText('Approve Order (₱70.00)')).toBeTruthy());
    expect(res.queryByTestId('open-payment-modal')).toBeNull();
    expect(res.queryByText(/Please choose your payment method/)).toBeNull();
    expect(res.queryByText('Choose payment method')).toBeNull();
    res.unmount();
  });

  it('opens the choice on Approve, with no way to close it and no card option', async () => {
    mockMessagesData = { oc1: orderCard() };
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);
    await waitFor(() => expect(res.getByText('Approve Order (₱70.00)')).toBeTruthy());

    await act(async () => {
      fireEvent.press(res.getByText('Approve Order (₱70.00)'));
    });

    expect(apiClient.post).toHaveBeenCalledWith('/errands/PABILI-123456/confirm-order', {});
    await waitFor(() => expect(res.getByTestId('payment-option-COD')).toBeTruthy());
    expect(res.getByText('Choose payment method')).toBeTruthy();
    expect(res.getByTestId('payment-option-GCASH')).toBeTruthy();
    expect(res.getByTestId('payment-option-BANK_TRANSFER')).toBeTruthy();
    expect(res.queryByText(/Debit\/Credit Card/)).toBeNull();
    expect(res.queryByTestId('payment-modal-close')).toBeNull();
    // The dialog replaces the old "Order Confirmed" alert.
    expect(mockAlert).not.toHaveBeenCalled();
    res.unmount();
  });

  it('records the choice, stamps the order summary, and says so in the chat', async () => {
    mockMessagesData = { oc1: orderCard() };
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);
    await waitFor(() => expect(res.getByText('Approve Order (₱70.00)')).toBeTruthy());
    await act(async () => {
      fireEvent.press(res.getByText('Approve Order (₱70.00)'));
    });
    await waitFor(() => expect(res.getByTestId('payment-option-COD')).toBeTruthy());

    await act(async () => {
      fireEvent.press(res.getByTestId('payment-option-COD'));
    });
    await act(async () => {
      fireEvent.press(res.getByTestId('payment-confirm-final'));
    });

    expect(apiClient.post).toHaveBeenCalledWith('/errands/PABILI-123456/payment-selection', { paymentModeId: 1 });
    await waitFor(() => expect(res.queryByTestId('payment-modal')).toBeNull());
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'chats/PABILI-123456/messages/oc1' }),
      expect.objectContaining({ paymentMethod: 'Cash on Delivery', paymentChosenAt: expect.any(Number) })
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'chats/PABILI-123456/messages' }),
      expect.objectContaining({ role: 'customer', text: expect.stringContaining('Payment mode confirmed: Cash on Delivery') })
    );
    expect(mockAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    res.unmount();
  });

  it('turns Approve into Choose payment method when the app was closed on the choice', async () => {
    mockMessagesData = { oc1: orderCard({ confirmed: true, status: 'approved' }) };
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);

    await waitFor(() => expect(res.getByTestId('order-choose-payment')).toBeTruthy());
    expect(res.queryByText(/Approve Order/)).toBeNull();

    await act(async () => {
      fireEvent.press(res.getByTestId('order-choose-payment'));
    });
    await waitFor(() => expect(res.getByTestId('payment-option-COD')).toBeTruthy());
    res.unmount();
  });

  it('shows how they pay once a choice is on record', async () => {
    mockMessagesData = { oc1: orderCard({ confirmed: true, status: 'approved' }) };
    mockErrandSelection = { paymentMode: { name: 'GCash / PayMaya' } };
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);

    await waitFor(() => expect(res.getByTestId('order-paying-by')).toBeTruthy());
    expect(res.getByText('Paying by GCash / PayMaya')).toBeTruthy();
    expect(res.queryByTestId('order-choose-payment')).toBeNull();
    res.unmount();
  });

  it('closes without asking again when the server already has a choice', async () => {
    // The errand loaded before the choice was made elsewhere; the dialog's own
    // check finds it.
    mockMessagesData = { oc1: orderCard({ confirmed: true, status: 'approved' }) };
    mockSelectionEndpoint = { paymentMode: { name: 'Bank Transfer' } };
    const res: any = await render(<CustomerChatScreen route={route} navigation={navigation} />);
    await waitFor(() => expect(res.getByTestId('order-choose-payment')).toBeTruthy());

    await act(async () => {
      fireEvent.press(res.getByTestId('order-choose-payment'));
    });

    await waitFor(() => expect(res.getByText('Paying by Bank Transfer')).toBeTruthy());
    expect(res.queryByTestId('payment-option-COD')).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalledWith('/errands/PABILI-123456/payment-selection', expect.anything());
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: expect.stringContaining('Payment mode confirmed') })
    );
    res.unmount();
  });
});
