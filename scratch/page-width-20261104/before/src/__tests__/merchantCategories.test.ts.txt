import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchBackendMerchantCategories,
  isSelectableCategory,
  isPabiliCategory,
  FALLBACK_BACKEND_CATEGORIES,
  prioritizeCategoriesWithAffinity,
  recordCategorySearchAffinity,
  getCategorySearchAffinities,
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

describe('isPabiliCategory', () => {
  it.each([
    'Fast Food & Restaurant',
    'Pharmacy & Health',
    'Supermarket & Grocery',
    'Retail & General Merchandise',
    'Water Refilling Station',
    'Bakery & Pastry',
  ])('allows valid Pabili category %s', (name) => {
    expect(isPabiliCategory(name)).toBe(true);
  });

  it.each([
    'Logistics',
    'Logicstics',
    'Logistics & Freight',
    'Courier Services',
    'Express Courier',
    'Tacurong Cargo Forwarder',
    'Salons',
    'Beauty Salon',
    'Hair Salon',
    'Barbershop',
    'Barber Shop',
    'Spa & Salon',
    'Carwash',
    'Car Wash',
    'Auto Wash Tacurong',
    'Auto Detailing',
    'Schools',
    'Tacurong National High School',
    'Banks',
    'ATM & Banks',
    'Padala Outlets',
    'Remittance Centers',
    'Motor Trades',
    'Auto Parts',
  ])('rejects non-Pabili service category %s', (name) => {
    expect(isPabiliCategory(name)).toBe(false);
  });
});

describe('prioritizeCategoriesWithAffinity', () => {
  const sampleCategories = [
    { id: 1, name: 'Fast Food & Restaurant', status: 'Active', isRecommended: true, orderedBefore: false, orderCount: 0 },
    { id: 2, name: 'Pharmacy & Health', status: 'Active', isRecommended: true, orderedBefore: false, orderCount: 0 },
    { id: 3, name: 'Supermarket & Grocery', status: 'Active', isRecommended: true, orderedBefore: false, orderCount: 0 },
    { id: 4, name: 'Bakery & Pastry', status: 'Active', isRecommended: true, orderedBefore: false, orderCount: 0 },
    { id: 5, name: 'Retail & General Merchandise', status: 'Active', isRecommended: false, orderedBefore: false, orderCount: 0 },
    { id: 6, name: 'Cafe & Drinks', status: 'Active', isRecommended: false, orderedBefore: false, orderCount: 0 },
  ];

  it('cold start: stamps the first four as isRecommended: true and the rest as false', () => {
    const result = prioritizeCategoriesWithAffinity(sampleCategories, {});
    expect(result).toHaveLength(6);
    expect(result.slice(0, 4).every((c) => c.isRecommended === true)).toBe(true);
    expect(result.slice(4).every((c) => c.isRecommended === false)).toBe(true);
  });

  it('past orders: categories ordered before jump to top and receive isRecommended: true', () => {
    const withOrders = [
      ...sampleCategories.map((c) => ({ ...c })),
    ];
    // Suppose Retail (#5) was ordered 3 times, Bakery (#4) ordered 1 time
    withOrders[4].orderCount = 3;
    withOrders[4].orderedBefore = true;
    withOrders[3].orderCount = 1;
    withOrders[3].orderedBefore = true;

    const result = prioritizeCategoriesWithAffinity(withOrders, {});
    expect(result[0].name).toBe('Retail & General Merchandise');
    expect(result[0].isRecommended).toBe(true);
    expect(result[0].orderedBefore).toBe(true);

    expect(result[1].name).toBe('Bakery & Pastry');
    expect(result[1].isRecommended).toBe(true);
    expect(result[1].orderedBefore).toBe(true);

    expect(result[2].name).toBe('Fast Food & Restaurant');
    expect(result[3].name).toBe('Pharmacy & Health');
    expect(result.slice(0, 4).every((c) => c.isRecommended === true)).toBe(true);
    expect(result.slice(4).every((c) => c.isRecommended === false)).toBe(true);
  });

  it('search affinity: high customer search count promotes a category into the top 4', () => {
    const affinities = {
      'Cafe & Drinks': 10,
    };
    const result = prioritizeCategoriesWithAffinity(sampleCategories, affinities);
    // Cafe & Drinks had 0 orders but 10 searches, so it jumps to top
    expect(result[0].name).toBe('Cafe & Drinks');
    expect(result[0].isRecommended).toBe(true);
    expect(result.slice(0, 4).every((c) => c.isRecommended === true)).toBe(true);
    expect(result.slice(4).every((c) => c.isRecommended === false)).toBe(true);
  });
});

describe('recordCategorySearchAffinity & getCategorySearchAffinities', () => {
  it('records exact category name search affinity', async () => {
    await recordCategorySearchAffinity('Pharmacy & Health');
    await recordCategorySearchAffinity('Pharmacy & Health');
    const affinities = await getCategorySearchAffinities();
    expect(affinities['Pharmacy & Health']).toBe(2);
  });

  it('matches common keywords to standard categories', async () => {
    await recordCategorySearchAffinity('burger');
    await recordCategorySearchAffinity('medicine');
    const affinities = await getCategorySearchAffinities();
    expect(affinities['Fast Food & Restaurant']).toBe(1);
    expect(affinities['Pharmacy & Health']).toBe(1);
  });
});

