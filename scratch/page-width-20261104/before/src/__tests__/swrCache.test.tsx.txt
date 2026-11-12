import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

/**
 * Caching for the customer's own data (2026-10-14): stale-while-revalidate,
 * optimistic changes with undo, and polling that backs off and pauses.
 */

const mockDisk = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k: string) => Promise.resolve(mockDisk.get(k) ?? null)),
  setItem: jest.fn((k: string, v: string) => {
    mockDisk.set(k, v);
    return Promise.resolve();
  }),
  removeItem: jest.fn((k: string) => {
    mockDisk.delete(k);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve([...mockDisk.keys()])),
}));

const mockApi = { get: jest.fn(), put: jest.fn(), delete: jest.fn() };
jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApi.get(...args),
    put: (...args: unknown[]) => mockApi.put(...args),
    delete: (...args: unknown[]) => mockApi.delete(...args),
  },
  hasSlowRequestInFlight: () => false,
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = require('react');
    useEffect(effect, [effect]);
  },
}));

import {
  __resetCacheForTests,
  clearCache,
  fetchIntoCache,
  mutateCache,
  readCache,
  useCachedResource,
  useSmartPolling,
  writeCache,
} from '../services/swrCache';
import {
  savedLocationsKey,
  setDefaultLocationOptimistic,
  useSavedLocations,
} from '../hooks/useSavedLocations';
import { useDefaultDeliveryLocation } from '../hooks/useDefaultDeliveryLocation';

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  __resetCacheForTests();
  mockDisk.clear();
  jest.clearAllMocks();
});

describe('stale-while-revalidate', () => {
  it('shows the kept answer at once and refreshes it behind, once it is stale', async () => {
    writeCache('k', ['old']);
    const fresh = deferred<string[]>();
    const fetcher = jest.fn(() => fresh.promise);

    const { result } = await renderHook(() => useCachedResource('k', fetcher, { staleMs: 0 }));

    // The old answer is on screen while the new one is out: no skeleton.
    expect(result.current.data).toEqual(['old']);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));

    await act(async () => fresh.resolve(['new']));
    expect(result.current.data).toEqual(['new']);
    expect(result.current.isRefreshing).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not fetch a fresh answer again', async () => {
    writeCache('k', ['kept']);
    const fetcher = jest.fn(() => Promise.resolve(['other']));
    const { result } = await renderHook(() => useCachedResource('k', fetcher, { staleMs: 60_000 }));
    expect(result.current.data).toEqual(['kept']);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps the answer on screen when a refresh fails', async () => {
    writeCache('k', ['kept']);
    const { result } = await renderHook(() =>
      useCachedResource('k', () => Promise.reject(new Error('timeout')), { staleMs: 0 })
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toEqual(['kept']);
    expect(result.current.isLoading).toBe(false);
  });

  it('opens on the phone’s copy after a restart', async () => {
    mockDisk.set('@sugo_swr:p', JSON.stringify({ data: ['from disk'], at: Date.now() }));
    const fetcher = jest.fn(() => Promise.resolve(['net']));
    const { result } = await renderHook(() => useCachedResource('p', fetcher, { staleMs: 60_000, persist: true }));
    await waitFor(() => expect(result.current.data).toEqual(['from disk']));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks once when two screens want the same thing', async () => {
    const answer = deferred<number>();
    const fetcher = jest.fn(() => answer.promise);
    const a = fetchIntoCache('same', fetcher);
    const b = fetchIntoCache('same', fetcher);
    answer.resolve(7);
    await expect(Promise.all([a, b])).resolves.toEqual([7, 7]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('optimistic changes', () => {
  it('applies at once and undoes exactly', () => {
    writeCache('list', [1, 2]);
    const undo = mutateCache<number[]>('list', (cur) => [...(cur ?? []), 3]);
    expect(readCache('list')?.data).toEqual([1, 2, 3]);
    undo();
    expect(readCache('list')?.data).toEqual([1, 2]);
  });

  it('forgets everything on sign-out, and drops answers for the old account', async () => {
    writeCache('locations:8', ['home'], { persist: true });
    const late = deferred<string[]>();
    const pending = fetchIntoCache('locations:8', () => late.promise);
    await clearCache();
    late.resolve(['arrived after sign-out']);
    await pending;
    expect(readCache('locations:8')).toBeUndefined();
    expect([...mockDisk.keys()].some((k) => k.startsWith('@sugo_swr:'))).toBe(false);
  });
});

describe('saved locations', () => {
  const HOME = { id: 1, userId: 8, label: 'Home', address: 'Purok 5', latitude: 6.69, longitude: 124.68, isDefault: true, createdAt: '' };
  const WORK = { id: 2, userId: 8, label: 'Work', address: 'Poblacion', latitude: 6.7, longitude: 124.69, isDefault: false, createdAt: '' };

  it('makes a place the default before the server answers, everywhere it shows', async () => {
    writeCache(savedLocationsKey(8), [HOME, WORK]);
    const saved = deferred<unknown>();
    mockApi.put.mockReturnValueOnce(saved.promise);
    mockApi.get.mockResolvedValue({ data: [{ ...HOME, isDefault: false }, { ...WORK, isDefault: true }] });

    const header = await renderHook(() => useDefaultDeliveryLocation(8));
    expect(header.result.current.location?.address).toBe('Purok 5');

    let done!: Promise<void>;
    await act(async () => {
      done = setDefaultLocationOptimistic(8, WORK);
    });
    // Before the server has answered.
    expect(header.result.current.location?.address).toBe('Poblacion');
    await act(async () => {
      saved.resolve({});
      await done;
    });
    expect(header.result.current.location?.address).toBe('Poblacion');
  });

  it('puts the old default back when the server refuses', async () => {
    writeCache(savedLocationsKey(8), [HOME, WORK]);
    mockApi.put.mockRejectedValueOnce(new Error('timeout'));
    const list = await renderHook(() => useSavedLocations(8));

    await act(async () => {
      await expect(setDefaultLocationOptimistic(8, WORK)).rejects.toThrow('timeout');
    });
    expect(list.result.current.locations.find((l) => l.isDefault)?.label).toBe('Home');
  });

  it('keeps the address in the header when a slow refresh fails', async () => {
    writeCache(savedLocationsKey(8), [HOME]);
    // Stale, so a refresh goes out; it fails.
    (readCache(savedLocationsKey(8)) as { at: number }).at = 0;
    mockApi.get.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));
    const header = await renderHook(() => useDefaultDeliveryLocation(8));
    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(header.result.current.location?.address).toBe('Purok 5');
    expect(header.result.current.failed).toBe(false);
    expect(header.result.current.loading).toBe(false);
  });
});

describe('revisits', () => {
  const near = { latitude: 6.69, longitude: 124.68 };
  const pharmacy = {
    key: 'g1',
    source: 'google',
    name: 'Mercury Drug',
    address: 'Poblacion, Tacurong',
    latitude: 6.69,
    longitude: 124.68,
    placeId: null,
    googlePlaceId: 'g1',
    categoryId: 3,
    categoryName: 'Pharmacy',
    distanceMeters: 213,
  };

  it('starts a store list on the kept one, and keeps it when the refresh fails', async () => {
    const { clearNearbyEstablishmentCache } = require('../services/establishments');
    const { useEstablishmentSearch } = require('../hooks/useEstablishmentSearch');
    clearNearbyEstablishmentCache();
    mockApi.get.mockResolvedValueOnce({ data: { google: 'ok', items: [pharmacy] } });
    const opts = { maxAgeMs: 1, withPhotos: true };

    const first = await renderHook(() => useEstablishmentSearch('', near, true, opts));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    await first.unmount();

    await new Promise((r) => setTimeout(r, 5)); // past maxAgeMs: a refresh will go out
    mockApi.get.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));
    const second = await renderHook(() => useEstablishmentSearch('', near, true, opts));
    // The first frame of the revisit: the kept list, not a skeleton.
    expect(second.result.current.status).toBe('ready');
    expect(second.result.current.items.map((s: any) => s.name)).toEqual(['Mercury Drug']);
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));
    expect(second.result.current.status).toBe('ready');
  });

  it('shows Messages & Support on a revisit with no skeleton', async () => {
    const { useActiveErrands } = require('../hooks/useActiveErrands');
    mockApi.get.mockResolvedValue({ data: [{ id: 'e1', status: 'ASSIGNED', categories: 'Pharmacy' }] });

    const first = await renderHook(() => useActiveErrands(8));
    await waitFor(() => expect(first.result.current.errands).toHaveLength(1));
    await first.unmount();

    const second = await renderHook(() => useActiveErrands(8));
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.errands.map((e: any) => e.id)).toEqual(['e1']);
  });
});

describe('smart polling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('doubles the wait while nothing changes and resets when something does', async () => {
    const results = [false, false, true, false];
    const task = jest.fn(() => Promise.resolve(results.shift() ?? false));
    await renderHook(() => useSmartPolling(task, { enabled: true, minMs: 1000, maxMs: 8000 }));

    const advance = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    };
    await advance(1000); // first run at 1 s: unchanged
    expect(task).toHaveBeenCalledTimes(1);
    await advance(1999); // next waits 2 s
    expect(task).toHaveBeenCalledTimes(1);
    await advance(1); // 2nd run: unchanged -> 4 s
    expect(task).toHaveBeenCalledTimes(2);
    await advance(4000); // 3rd run: changed -> back to 1 s
    expect(task).toHaveBeenCalledTimes(3);
    await advance(1000);
    expect(task).toHaveBeenCalledTimes(4);
  });

  it('does not run while the screen is not in front, or with the app in the background', async () => {
    const task = jest.fn(() => Promise.resolve(false));
    const hidden = await renderHook(() => useSmartPolling(task, { enabled: false, minMs: 1000, maxMs: 8000 }));
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(task).not.toHaveBeenCalled();
    await hidden.unmount();

    let onChange: ((s: string) => void) | undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_t: any, fn: any) => {
      onChange = fn;
      return { remove: jest.fn() } as any;
    });
    await renderHook(() => useSmartPolling(task, { enabled: true, minMs: 1000, maxMs: 8000 }));
    await act(async () => {
      onChange?.('background');
    });
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(task).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
