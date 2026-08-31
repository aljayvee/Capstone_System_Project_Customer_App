import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchBackendMerchantCategories,
  isSelectableCategory,
  FALLBACK_BACKEND_CATEGORIES,
} from '../services/merchantCategories';
import { apiClient } from '../services/apiClient';

// An in-memory stand-in for the device keystore, following the convention the
// other suites here use. Real enough to exercise the write-then-read-back path
// the cache fallback depends on.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve(null);
    }),
    removeItem: jest.fn((k: string) => {
      store.delete(k);
      return Promise.resolve(null);
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve(null);
    }),
  };
});

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

/**
 * The bug these cover:
 *
 * Deactivating every merchant category in the owner portal left them all still
 * showing on the customer's Bento grid. The server was correct — it returned an
 * empty array — but the client guarded its success path with
 * `response.data.length > 0`, so "none are active" took the same branch as
 * "the request failed", fell through to the cache, and ended at
 * FALLBACK_BACKEND_CATEGORIES. That seed list happens to contain the same four
 * categories an owner would deactivate, so switching them off looked like it
 * had done nothing.
 */
beforeEach(async () => {
  mockGet.mockReset();
  await AsyncStorage.clear();
});

describe('an empty catalogue is an answer, not a failure', () => {
  it('returns no categories when the server says none are active', async () => {
    mockGet.mockResolvedValue({ data: [] });

    const result = await fetchBackendMerchantCategories();

    expect(result).toEqual([]);
    // The specific regression: the hardcoded seed must not stand in here.
    expect(result).not.toEqual(FALLBACK_BACKEND_CATEGORIES);
  });

  it('overwrites the cache with the empty list', async () => {
    // Otherwise the next offline launch resurrects the categories that were
    // just deactivated.
    mockGet.mockResolvedValue({ data: [{ id: 1, name: 'Food & Restaurant', status: 'Active' }] });
    await fetchBackendMerchantCategories();

    mockGet.mockResolvedValue({ data: [] });
    await fetchBackendMerchantCategories();

    mockGet.mockRejectedValue(new Error('offline'));
    await expect(fetchBackendMerchantCategories()).resolves.toEqual([]);
  });

  it('still filters out inactive rows the server chose to include', async () => {
    mockGet.mockResolvedValue({
      data: [
        { id: 1, name: 'Food & Restaurant', status: 'Active' },
        { id: 2, name: 'Bills & Payment Centers', status: 'Inactive' },
      ],
    });

    const result = await fetchBackendMerchantCategories();

    expect(result.map((c) => c.name)).toEqual(['Food & Restaurant']);
  });
});

describe('offline behaviour is unchanged', () => {
  it('falls back to the last known good list when the request fails', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 1, name: 'Pharmacy & Health', status: 'Active' }],
    });
    await fetchBackendMerchantCategories();

    mockGet.mockRejectedValue(new Error('network down'));
    const result = await fetchBackendMerchantCategories();

    expect(result.map((c) => c.name)).toEqual(['Pharmacy & Health']);
  });

  it('drops cached categories that have since been deactivated', async () => {
    // The cache stores whatever was active at write time. A row that went
    // inactive afterwards must not come back through this path.
    await AsyncStorage.setItem(
      '@sugo_customer_merchant_categories_detail',
      JSON.stringify([
        { id: 1, name: 'Food & Restaurant', status: 'Active' },
        { id: 2, name: 'Bills & Payment Centers', status: 'Inactive' },
      ])
    );
    mockGet.mockRejectedValue(new Error('network down'));

    const result = await fetchBackendMerchantCategories();

    expect(result.map((c) => c.name)).toEqual(['Food & Restaurant']);
  });

  it('uses the built-in seed only when there is no server and no cache', async () => {
    mockGet.mockRejectedValue(new Error('network down'));

    const result = await fetchBackendMerchantCategories();

    expect(result).toEqual(FALLBACK_BACKEND_CATEGORIES);
  });
});

describe('isSelectableCategory', () => {
  it.each([
    [{ name: 'Food', status: 'Active' }, true],
    [{ name: 'Food', status: undefined }, true],
    [{ name: 'Food', status: 'Inactive' }, false],
    [{ name: '', status: 'Active' }, false],
    [null, false],
  ])('%o -> %s', (input, expected) => {
    expect(isSelectableCategory(input as any)).toBe(expected);
  });
});
