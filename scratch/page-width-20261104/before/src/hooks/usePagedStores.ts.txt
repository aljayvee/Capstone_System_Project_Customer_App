import { useCallback, useEffect, useRef, useState } from 'react';
import type { Establishment } from '../services/establishments';
import type { EstablishmentSearchStatus } from './useEstablishmentSearch';

/** The store screens load this many at a time after their first page. */
export const STORE_PAGE_SIZE = 6;
/** The most a store screen loads as the customer scrolls. */
export const STORE_PAGES_MAX = 20;

export interface StorePage {
  items: Establishment[];
  google: 'ok' | 'unavailable';
  hasMore: boolean;
  outsideServiceArea?: boolean;
}

/**
 * One page of a store list. The first (`offset` 0, no `limit`) is the one Home's
 * row already asked for, so it may come from the shared cache (`cached`); the
 * rest are `limit` stores from `offset`.
 */
export type StorePageFetch = (
  page: { offset: number; limit?: number; cached: boolean },
  signal: AbortSignal
) => Promise<StorePage>;

/** What a paged store screen shows (components/stores/StorePickScreen.tsx). */
export interface PagedStores {
  items: Establishment[];
  status: EstablishmentSearchStatus;
  googleAvailable: boolean;
  outsideServiceArea?: boolean;
  retry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  loadMore: () => void;
}

/**
 * A store screen's list, a page at a time (2026-10-11, lifted out of the
 * Popular Stores screen so "Stores near you" pages the same way): the first
 * page once `ready`, then the next each time `loadMore` is called (the list
 * reached its end), up to STORE_PAGES_MAX. A new `resetKey` (another place, or
 * another sort) starts again from the top.
 *
 * A failed next page keeps what is shown and sets `moreFailed`; the list then
 * stops asking on its own, and `loadMore` from its "Try again" asks again.
 */
export function usePagedStores(
  fetchPage: StorePageFetch,
  ready: boolean,
  resetKey: string,
  logTag: string,
  options: {
    /**
     * The first page kept from an earlier visit, however old (2026-10-14). The
     * list starts on it, from the first frame, and the fresh page replaces it
     * when it arrives; a failed refresh leaves it. Without it, every visit
     * starts on a skeleton.
     */
    peekFirst?: () => StorePage | null;
    /** Stores per further page; STORE_PAGE_SIZE unless given. */
    pageSize?: number;
  } = {}
): PagedStores {
  const { peekFirst, pageSize = STORE_PAGE_SIZE } = options;
  const peek = () => (ready && peekFirst ? peekFirst() : null);
  const firstOf = (page: StorePage) => page.items.slice(0, STORE_PAGES_MAX);
  const [items, setItems] = useState<Establishment[]>(() => {
    const kept = peek();
    return kept ? firstOf(kept) : [];
  });
  const [status, setStatus] = useState<EstablishmentSearchStatus>(() => {
    const kept = peek();
    return kept ? (kept.items.length > 0 ? 'ready' : 'empty') : 'idle';
  });
  const [googleAvailable, setGoogleAvailable] = useState(() => (peek()?.google ?? 'ok') === 'ok');
  const [outsideServiceArea, setOutsideServiceArea] = useState(() => peek()?.outsideServiceArea === true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The next page in flight; a ref, so two quick ends of the list ask once.
  const more = useRef<AbortController | null>(null);
  // The latest fetch, without making every render a new first page.
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const peekRef = useRef(peekFirst);
  peekRef.current = peekFirst;
  // Set once a further page is shown. A fresh first page arriving after that
  // must not cut the list back to one page under the customer's thumb.
  const extendedRef = useRef(false);

  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    more.current?.abort();
    more.current = null;
    setLoadingMore(false);
    setMoreFailed(false);
    const showFirst = (result: StorePage) => {
      const first = firstOf(result);
      setItems(first);
      setGoogleAvailable(result.google === 'ok');
      setOutsideServiceArea(result.outsideServiceArea === true);
      setHasMore(result.hasMore && first.length > 0 && first.length < STORE_PAGES_MAX);
      setStatus(first.length > 0 ? 'ready' : 'empty');
    };
    extendedRef.current = false;
    const kept = attempt === 0 && peekRef.current ? peekRef.current() : null;
    if (kept) {
      showFirst(kept);
    } else {
      setHasMore(false);
      setOutsideServiceArea(false);
      setItems([]);
      setStatus('loading');
    }
    fetchRef
      .current({ offset: 0, cached: attempt === 0 }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || extendedRef.current) return;
        showFirst(result);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(`[${logTag}] Could not load stores:`, err?.message);
        // A failed refresh keeps the kept page; only nothing at all is an error.
        if (!kept) setStatus('error');
      });
    return () => controller.abort();
  }, [ready, resetKey, attempt, logTag]);

  useEffect(() => () => more.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (!hasMore || more.current || status !== 'ready' || items.length >= STORE_PAGES_MAX) return;
    const controller = new AbortController();
    more.current = controller;
    setLoadingMore(true);
    setMoreFailed(false);
    const offset = items.length;
    fetchRef
      .current({ offset, limit: Math.min(pageSize, STORE_PAGES_MAX - offset), cached: false }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        // Each store once, even if the server's list shifted between pages.
        const seen = new Set(items.map((store) => store.key));
        const next = [...items, ...result.items.filter((store) => !seen.has(store.key))].slice(0, STORE_PAGES_MAX);
        extendedRef.current = true;
        setItems(next);
        setHasMore(result.hasMore && next.length > items.length && next.length < STORE_PAGES_MAX);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(`[${logTag}] Could not load more stores:`, err?.message);
        setMoreFailed(true);
      })
      .finally(() => {
        if (more.current !== controller) return;
        more.current = null;
        setLoadingMore(false);
      });
  }, [hasMore, status, items, logTag, pageSize]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { items, status, googleAvailable, outsideServiceArea, retry, hasMore, loadingMore, moreFailed, loadMore };
}
