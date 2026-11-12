import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';

const mockRetry = jest.fn();
// Prefixed "mock" so the jest.mock factory below is allowed to close over it.
let mockNetworkStatus = {
  isConnected: true,
  isSlow: false,
  justReconnected: false,
  retry: mockRetry,
  reconnectCount: 0,
};

jest.mock('../context/NetworkContext', () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

const mockReadCached = jest.fn();
jest.mock('../services/lastActiveErrand', () => {
  const actual = jest.requireActual('../services/lastActiveErrand');
  return {
    ...actual,
    readCachedActiveErrand: (...args: any[]) => mockReadCached(...args),
  };
});

import OfflineGate from '../components/OfflineGate';

function setNetwork(partial: Partial<typeof mockNetworkStatus>) {
  mockNetworkStatus = { ...mockNetworkStatus, ...partial };
}

beforeEach(() => {
  mockRetry.mockReset().mockResolvedValue(undefined);
  mockReadCached.mockReset().mockResolvedValue(null);
  setNetwork({ isConnected: true, isSlow: false, justReconnected: false, reconnectCount: 0 });
});

afterEach(cleanup);

describe('OfflineGate', () => {
  it('stays out of the way while the device is online', async () => {
    const res: any = await render(<OfflineGate />);
    expect(res.queryByTestId('offline-gate')).toBeNull();
  });

  it('blocks the app when the device drops off the network', async () => {
    setNetwork({ isConnected: false });
    const res: any = await render(<OfflineGate />);

    expect(res.getByTestId('offline-gate')).toBeTruthy();
    expect(res.getByText('No internet connection')).toBeTruthy();
    expect(
      res.getByText('Check your Wi-Fi or mobile data. Sugo will pick up where you left off.')
    ).toBeTruthy();
  });

  it('re-reads the radio when the customer asks it to', async () => {
    setNetwork({ isConnected: false });
    const res: any = await render(<OfflineGate />);

    await fireEvent.press(res.getByTestId('offline-retry'));

    await waitFor(() => expect(mockRetry).toHaveBeenCalledTimes(1));
  });

  it('lets go the moment the connection comes back', async () => {
    setNetwork({ isConnected: false });
    const res: any = await render(<OfflineGate />);
    expect(res.getByTestId('offline-gate')).toBeTruthy();

    setNetwork({ isConnected: true });
    await res.rerender(<OfflineGate />);

    expect(res.queryByTestId('offline-gate')).toBeNull();
  });

  it('offers no errand escape when nothing was cached', async () => {
    setNetwork({ isConnected: false });
    const res: any = await render(<OfflineGate />);

    await waitFor(() => expect(mockReadCached).toHaveBeenCalled());
    expect(res.queryByTestId('offline-view-errand')).toBeNull();
  });

  it('offers a read-only look at the last errand it managed to load', async () => {
    // The one person a blank wall punishes most is the customer whose rider is
    // already on the way.
    mockReadCached.mockResolvedValue({
      cachedAt: Date.now() - 4 * 60 * 1000,
      errand: {
        id: 'ERR-1024',
        category: 'Food & Restaurant',
        status: 'IN_TRANSIT',
        description: 'Two orders of chicken inasal',
        pickupAddress: 'Tacurong Public Market',
        pabiliDetails: [{ itemName: 'Chicken inasal' }, { itemName: 'Garlic rice' }],
      },
    });
    setNetwork({ isConnected: false });

    const res: any = await render(<OfflineGate />);

    const escape = await waitFor(() => res.getByTestId('offline-view-errand'));
    expect(res.getByText('Last updated 4 minutes ago')).toBeTruthy();

    await fireEvent.press(escape);

    expect(res.getByText('My errand')).toBeTruthy();
    expect(res.getByText('ERR-1024')).toBeTruthy();
    expect(res.getByText('Chicken inasal')).toBeTruthy();
    // Says plainly that it is frozen, rather than showing stale data as live.
    expect(
      res.getByText('Last updated 4 minutes ago. You are offline, so nothing here can change yet.')
    ).toBeTruthy();
  });
});
