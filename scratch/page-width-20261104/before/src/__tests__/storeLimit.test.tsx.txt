jest.unmock('../services/storeLimit');

import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import {
  getStoresAllowed,
  refreshStoreLimit,
  resetStoreLimitForTests,
  setStoresAllowedFromRateConfig,
  storesAllowedFor,
  useStoresAllowed,
} from '../services/storeLimit';
import { emptyDraft, mergeStoreSelection } from '../services/pabiliDraft';

jest.mock('../services/apiClient', () => ({ apiClient: { get: jest.fn() } }));

// The owner's "Max Additional Stores Allowed" used to change nothing in the
// app: every picker stopped at a literal 3 (2026-10-25).
describe('store limit', () => {
  beforeEach(() => {
    resetStoreLimitForTests();
    (apiClient.get as jest.Mock).mockReset();
  });

  it('is the first store plus the additional stores, clamped', () => {
    expect(storesAllowedFor(5)).toBe(6);
    expect(storesAllowedFor(0)).toBe(1);
    expect(storesAllowedFor(-3)).toBe(1);
    expect(storesAllowedFor(40)).toBe(6);
    expect(storesAllowedFor(undefined)).toBe(3);
  });

  it('reads the rate card when a picker mounts, and re-renders with it', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { maxAdditionalStores: 4 } });
    function Probe() {
      return <Text testID="limit">{String(useStoresAllowed())}</Text>;
    }
    expect(getStoresAllowed()).toBe(3);
    const res = await render(<Probe />);
    await waitFor(() => expect(res.getByTestId('limit').props.children).toBe('5'));
    expect(apiClient.get).toHaveBeenCalledWith('/rate-config');
  });

  it('keeps the last known limit when the rate card cannot be read', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { maxAdditionalStores: 3 } });
    await refreshStoreLimit();
    expect(getStoresAllowed()).toBe(4);
    const later = Date.now() + 120_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(later);
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await refreshStoreLimit();
    now.mockRestore();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(getStoresAllowed()).toBe(4);
  });

  it('lets the saved list grow to the limit, and names it when refusing', () => {
    const store = (name: string) => ({ key: name, name, latitude: 6.68, longitude: 124.67 } as any);
    const picked = ['A', 'B', 'C', 'D', 'E'].map(store);
    expect(mergeStoreSelection(emptyDraft([]), [], picked, 5).notice).toBeUndefined();
    const refused = mergeStoreSelection(emptyDraft([]), [], picked, 3);
    expect(refused.notice).toContain('up to 3 stores');
  });
});
