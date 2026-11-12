import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

// The rider is waiting at the last shop; this is the customer being told so,
// over whatever screen is open, with one tap to the chat where they pay.

const handlers: Record<string, (payload: any) => void> = {};
const mockSocket = {
  on: jest.fn((event: string, cb: (payload: any) => void) => {
    handlers[event] = cb;
  }),
  off: jest.fn(),
};
jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() => Promise.resolve(mockSocket)),
}));

const mockUser = { id: 42, firstName: 'Maria' };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockNavigate = jest.fn();
jest.mock('../navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

let mockActiveChat: string | null = null;
jest.mock('../utils/activeChatTracker', () => ({
  getActiveChatErrandId: () => mockActiveChat,
}));

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    colors: {
      primary: '#F62459',
      danger: '#EF4444',
      bgApp: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E2E8F0',
      textDark: '#0B132B',
      textGray: '#64748B',
      bgGray: '#F1F5F9',
    },
    isDark: false,
  }),
}));

import HalfPaymentPrompt from '../components/HalfPaymentPrompt';

const REQUEST = { errandId: 'ERR-1', dueUpFront: 585, goodsTotal: 1170 };

async function renderPrompt() {
  const res: any = await render(<HalfPaymentPrompt />);
  // Let getSocket() resolve and the listeners attach.
  await act(async () => {});
  return res;
}

describe('HalfPaymentPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveChat = null;
    for (const key of Object.keys(handlers)) delete handlers[key];
  });

  it('stays hidden until the rider asks', async () => {
    const res = await renderPrompt();
    expect(res.queryByText('Your items are bought')).toBeNull();
  });

  it('says how much, and of what, when the rider asks', async () => {
    const res = await renderPrompt();
    await act(async () => handlers['errand:half_payment_requested'](REQUEST));

    expect(res.getByText('Your items are bought')).toBeTruthy();
    expect(res.getByText(/paid ₱1,170\.00 for your items/)).toBeTruthy();
    expect(res.getByText(/half-payment of ₱585\.00/)).toBeTruthy();
  });

  it('takes the customer to that errand’s chat', async () => {
    const res = await renderPrompt();
    await act(async () => handlers['errand:half_payment_requested'](REQUEST));
    await act(async () => fireEvent.press(res.getByText('Open chat')));

    expect(mockNavigate).toHaveBeenCalledWith('CustomerChat', { user: mockUser, errandId: 'ERR-1' });
    // After the modal's own exit animation.
    await waitFor(() => expect(res.queryByText('Your items are bought')).toBeNull());
  });

  it('only closes when that chat is already open', async () => {
    mockActiveChat = 'ERR-1';
    const res = await renderPrompt();
    await act(async () => handlers['errand:half_payment_requested'](REQUEST));
    await act(async () => fireEvent.press(res.getByText('Open chat')));

    expect(mockNavigate).not.toHaveBeenCalled();
    await waitFor(() => expect(res.queryByText('Your items are bought')).toBeNull());
  });

  it('goes away once the half is paid', async () => {
    const res = await renderPrompt();
    await act(async () => handlers['errand:half_payment_requested'](REQUEST));
    await act(async () =>
      handlers['errand:payment_updated']({ errandId: 'ERR-1', reason: 'upfront_confirmed' })
    );

    await waitFor(() => expect(res.queryByText('Your items are bought')).toBeNull());
  });
});
