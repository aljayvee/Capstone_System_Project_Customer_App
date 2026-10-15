import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from '../context/NetworkContext';

/**
 * Stale-while-revalidate for the customer's own data (2026-10-14).
 *
 * Screens used to keep what they fetched in their own state, so every visit
 * started empty: a skeleton, a request, and on a slow connection an error
 * where a perfectly good answer from a minute ago could have been shown.
 * Here an answer is kept per key, in memory and (for `persist` keys) on the
 * phone, and shown at once on every visit, however old, while a fresh one is
 * fetched in the background only if it is older than the caller's `staleMs`.
 * A failed refresh keeps the answer on screen and sets `error`; only a screen
 * with nothing at all to show reports it.
 *
 * Optimistic writes (mutateCache) change the answer immediately and hand back
 * an undo for when the server refuses. useSmartPolling refreshes on a timer
 * that stops in the background and offline and slows while nothing changes.
 *
 * Everything here is one account's: clearCache runs on sign-out and session
 * expiry, and a fetch that started under the previous account cannot write.
 */

export interface CacheEntry<T> {
  data: T;
  /** When this answer was fetched, ms since epoch. */
  at: number;
}

const DISK_PREFIX = '@sugo_swr:';

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const errors = new Map<string, unknown>();
const versions = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();
const diskReads = new Map<string, Promise<void>>();
/** Bumped by clearCache, so answers for a signed-out account are dropped. */
let generation = 0;

function notify(key: string) {
  versions.set(key, (versions.get(key) ?? 0) + 1);
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

function same(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// AsyncStorage failures (and the partial mocks tests use) must never break a
// screen: the disk copy is a convenience, memory is the cache.
function diskWrite(key: string, entry: CacheEntry<unknown>) {
  try {
    void Promise.resolve(AsyncStorage.setItem(DISK_PREFIX + key, JSON.stringify(entry))).catch(() => {});
  } catch {
    // ignore
  }
}

function diskRemove(key: string) {
  try {
    void Promise.resolve(AsyncStorage.removeItem(DISK_PREFIX + key)).catch(() => {});
  } catch {
    // ignore
  }
}

/** The answer kept for `key`, if any, however old. */
export function readCache<T>(key: string): CacheEntry<T> | undefined {
  return memory.get(key) as CacheEntry<T> | undefined;
}

/**
 * Keeps `data` as the answer for `key`. Returns whether it differs from the
 * one kept before; an identical answer only refreshes its age and re-renders
 * nothing, which is what lets polling back off.
 */
export function writeCache<T>(key: string, data: T, options: { persist?: boolean } = {}): boolean {
  const before = memory.get(key);
  errors.delete(key);
  if (before && same(before.data, data)) {
    before.at = Date.now();
    if (options.persist) diskWrite(key, before);
    return false;
  }
  const entry: CacheEntry<unknown> = { data, at: Date.now() };
  memory.set(key, entry);
  if (options.persist) diskWrite(key, entry);
  notify(key);
  return true;
}

/** Loads the phone's copy of `key` into memory, once, if memory has none. */
export function hydrateCache(key: string): Promise<void> {
  if (memory.has(key)) return Promise.resolve();
  const pending = diskReads.get(key);
  if (pending) return pending;
  const gen = generation;
  const read = (async () => {
    try {
      const raw = await AsyncStorage.getItem(DISK_PREFIX + key);
      if (!raw || gen !== generation || memory.has(key)) return;
      const entry = JSON.parse(raw) as CacheEntry<unknown>;
      if (entry && typeof entry.at === 'number' && 'data' in entry) {
        memory.set(key, entry);
        notify(key);
      }
    } catch {
      // A missing or unreadable copy is the same as none.
    }
  })();
  diskReads.set(key, read);
  return read;
}

/**
 * Fetches `key` and keeps the answer. One request per key at a time: a second
 * caller while one is out gets the same promise. A failure is recorded for the
 * key and rethrown; the answer kept before it stays.
 */
export function fetchIntoCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { persist?: boolean } = {}
): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const gen = generation;
  let request!: Promise<T>;
  request = (async () => {
    try {
      const data = await fetcher();
      if (gen === generation) writeCache(key, data, options);
      return data;
    } catch (err) {
      if (gen === generation) errors.set(key, err);
      throw err;
    } finally {
      if (inflight.get(key) === request) inflight.delete(key);
      notify(key);
    }
  })();
  inflight.set(key, request);
  notify(key);
  return request;
}

/**
 * An optimistic change: `update` is applied to the kept answer now, and every
 * screen showing it re-renders. Returns the undo, which puts back exactly what
 * was there, for when the server refuses the change.
 */
export function mutateCache<T>(
  key: string,
  update: (current: T | undefined) => T,
  options: { persist?: boolean } = {}
): () => void {
  const before = memory.get(key);
  writeCache(key, update(before?.data as T | undefined), options);
  return () => {
    if (before) {
      memory.set(key, before);
      if (options.persist) diskWrite(key, before);
    } else {
      memory.delete(key);
      if (options.persist) diskRemove(key);
    }
    notify(key);
  };
}

/** Forgets every answer, in memory and on the phone. Sign-out and session expiry. */
export async function clearCache(): Promise<void> {
  generation += 1;
  const keys = new Set([...memory.keys(), ...errors.keys(), ...inflight.keys()]);
  memory.clear();
  errors.clear();
  inflight.clear();
  diskReads.clear();
  keys.forEach(notify);
  try {
    const all = await AsyncStorage.getAllKeys?.();
    const ours = (all ?? []).filter((k: string) => k.startsWith(DISK_PREFIX));
    await Promise.all(ours.map((k: string) => Promise.resolve(AsyncStorage.removeItem(k)).catch(() => {})));
  } catch {
    // Best effort: memory is already clear, and every key carries the user id.
  }
}

export interface CachedResource<T> {
  /** The kept answer, however old; undefined until there is one. */
  data: T | undefined;
  updatedAt: number | null;
  /** Nothing to show yet and an answer is on its way: the one time for a skeleton. */
  isLoading: boolean;
  /** A refresh is out while the kept answer is shown. */
  isRefreshing: boolean;
  /** The last fetch failed. With data, it is still shown; without, show the error. */
  error: unknown | null;
  /** Fetches again if the answer is older than `staleMs`, or always with `force`. */
  revalidate: (options?: { force?: boolean }) => Promise<void>;
}

/**
 * One cached resource. Shows the kept answer at once (from memory, else from
 * the phone for `persist` keys), and fetches in the background when it is
 * older than `staleMs` or there is none. `key` null waits (no user yet).
 */
export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { staleMs: number; persist?: boolean }
): CachedResource<T> {
  const { staleMs, persist = false } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const subscribeKey = useCallback((listener: () => void) => (key ? subscribe(key, listener) : () => {}), [key]);
  useSyncExternalStore(subscribeKey, () => (key ? versions.get(key) ?? 0 : -1));

  const revalidate = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!key) return;
      const current = memory.get(key);
      if (!force && current && Date.now() - current.at < staleMs) return;
      try {
        await fetchIntoCache(key, () => fetcherRef.current(), { persist });
      } catch {
        // Recorded per key; the hook reports it through `error`.
      }
    },
    [key, staleMs, persist]
  );

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    void (async () => {
      if (persist && !memory.has(key)) await hydrateCache(key);
      if (!cancelled) await revalidate();
    })();
    return () => {
      cancelled = true;
    };
  }, [key, persist, revalidate]);

  const entry = key ? (memory.get(key) as CacheEntry<T> | undefined) : undefined;
  const validating = key ? inflight.has(key) : false;
  const error = key ? errors.get(key) ?? null : null;

  return {
    data: entry?.data,
    updatedAt: entry?.at ?? null,
    isLoading: key !== null && !entry && (validating || error === null),
    isRefreshing: Boolean(entry) && validating,
    error,
    revalidate,
  };
}

/**
 * Refreshes on a timer only while it is worth it: `enabled` (the screen is in
 * front), the app in the foreground, and the phone online. Each run of `task`
 * reports whether anything changed; unchanged doubles the wait up to `maxMs`,
 * changed goes back to `minMs`. Coming back to the app after longer than
 * `minMs` runs at once rather than waiting out a full interval.
 */
export function useSmartPolling(
  task: () => Promise<boolean>,
  { enabled, minMs, maxMs }: { enabled: boolean; minMs: number; maxMs: number }
): void {
  const taskRef = useRef(task);
  taskRef.current = task;
  const { isConnected } = useNetworkStatus();
  // Anything but a state name (an environment without AppState) counts as open.
  const [appActive, setAppActive] = useState(
    typeof AppState.currentState !== 'string' || AppState.currentState === 'active'
  );
  const lastRunAt = useRef(Date.now());

  useEffect(() => {
    const sub = AppState.addEventListener?.('change', (state) => setAppActive(state === 'active'));
    return () => sub?.remove?.();
  }, []);

  const running = enabled && appActive && isConnected;

  useEffect(() => {
    if (!running) return undefined;
    let stopped = false;
    let delay = minMs;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      let changed = false;
      try {
        changed = await taskRef.current();
      } catch {
        changed = false;
      }
      lastRunAt.current = Date.now();
      if (stopped) return;
      delay = changed ? minMs : Math.min(delay * 2, maxMs);
      timer = setTimeout(tick, delay);
    };

    const sinceLast = Date.now() - lastRunAt.current;
    timer = setTimeout(tick, Math.max(0, minMs - sinceLast));
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [running, minMs, maxMs]);
}

/** Tests only: a clean cache without touching the phone's copy. */
export function __resetCacheForTests(): void {
  generation += 1;
  memory.clear();
  errors.clear();
  inflight.clear();
  diskReads.clear();
  versions.clear();
}
