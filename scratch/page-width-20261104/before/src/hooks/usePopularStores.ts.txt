import { useCallback, useEffect, useState } from 'react';
import {
  fetchPopularEstablishments,
  getCachedPopularEstablishments,
  type Establishment,
  type PopularResults,
  type PopularSort,
} from '../services/establishments';
import type { EstablishmentSearchStatus } from './useEstablishmentSearch';
import { usePagedStores, STORE_PAGE_SIZE, STORE_PAGES_MAX, type PagedStores, type StorePageFetch } from './usePagedStores';

/** Home and the Popular Stores screen share one answer for this long. */
export const POPULAR_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * The Home tab's "Popular Stores", and the screen "See all popular stores"
 * opens: six shops near the customer, best rated on Google first.
 *
 * Waits for `ready` (the saved location has loaded), so the list is asked for
 * once, around the right point. Photos are always asked for: both places that
 * use this show them. "Try again" after an error always reaches the server.
 */
export const POPULAR_CATEGORY_LIMIT = 10;

export function usePopularStores(
  near: { latitude: number; longitude: number } | null,
  ready: boolean,
  categoryIdOrFlag?: number | boolean | null,
  maybeCategoryIdOrName?: number | string | null,
  categoryName?: string | null
) {
  const categoryId =
    typeof categoryIdOrFlag === 'number'
      ? categoryIdOrFlag
      : typeof maybeCategoryIdOrName === 'number'
        ? maybeCategoryIdOrName
        : null;
  const resolvedCategoryName =
    typeof categoryName === 'string'
      ? categoryName
      : typeof maybeCategoryIdOrName === 'string'
        ? maybeCategoryIdOrName
        : null;
  const lat = near?.latitude;
  const lng = near?.longitude;

  // Stale-while-revalidate (2026-10-14), as useEstablishmentSearch: the kept
  // list for this place, however old, shows from the first frame, and a fresh
  // one is fetched behind it once it is past POPULAR_MAX_AGE_MS.
  const peek = (): PopularResults | null => {
    if (!ready) return null;
    const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
    return getCachedPopularEstablishments(
      { near: point, photos: true, ...(categoryId !== null ? { categoryId, limit: POPULAR_CATEGORY_LIMIT } : {}) },
      Infinity
    );
  };
  const [items, setItems] = useState<Establishment[]>(() => peek()?.items ?? []);
  const [status, setStatus] = useState<EstablishmentSearchStatus>(() => {
    const kept = peek();
    return kept ? (kept.items.length > 0 ? 'ready' : 'empty') : 'idle';
  });
  const [googleAvailable, setGoogleAvailable] = useState(() => (peek()?.google ?? 'ok') === 'ok');
  const [outsideServiceArea, setOutsideServiceArea] = useState(() => peek()?.outsideServiceArea === true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    const show = (result: PopularResults) => {
      setItems(result.items);
      setGoogleAvailable(result.google === 'ok');
      setOutsideServiceArea(result.outsideServiceArea === true);
      setStatus(result.items.length > 0 ? 'ready' : 'empty');
    };
    const kept = attempt === 0 ? peek() : null;
    if (kept) show(kept);
    else setStatus('loading');
    const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
    fetchPopularEstablishments(
      {
        near: point,
        photos: true,
        ...(categoryId !== null
          ? { categoryId, categoryName: resolvedCategoryName, limit: POPULAR_CATEGORY_LIMIT }
          : {}),
      },
      controller.signal,
      {
        maxAgeMs: attempt === 0 ? POPULAR_MAX_AGE_MS : undefined,
      }
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        show(result);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn('[PopularStores] Could not load popular stores:', err?.message);
        // A failed refresh keeps the kept list; only nothing at all is an error.
        if (!kept) setStatus('error');
      });
    return () => controller.abort();
  }, [lat, lng, ready, attempt, categoryId, resolvedCategoryName]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { items, status, googleAvailable, outsideServiceArea, retry };
}

/** The Popular Stores screen loads this many at a time; the first page is the one Home already has. */
export const POPULAR_PAGE_SIZE = STORE_PAGE_SIZE;
/** The most the screen loads as the customer scrolls (2026-10-10). */
export const POPULAR_MAX_STORES = STORE_PAGES_MAX;

/**
 * The Popular Stores screen: the first page in the chosen sort, then the next
 * page each time `loadMore` is called (the list reached its end), up to
 * POPULAR_MAX_STORES (hooks/usePagedStores.ts). Changing the sort starts again
 * from the top; the server reorders the same stores, so nothing is lost.
 * Recommended's first page is Home's row's answer, shared for two minutes.
 */
export function usePopularStoresPages(
  near: { latitude: number; longitude: number } | null,
  ready: boolean,
  sort: PopularSort,
  categoryId?: number | null,
  categoryName?: string | null
): PagedStores {
  const lat = near?.latitude;
  const lng = near?.longitude;
  const fetchPage: StorePageFetch = (page, signal) => {
    const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
    return fetchPopularEstablishments(
      {
        near: point,
        photos: true,
        sort,
        ...(categoryId != null ? { categoryId, categoryName } : {}),
        ...(page.offset > 0 ? { offset: page.offset, limit: page.limit } : {}),
      },
      signal,
      { maxAgeMs: page.cached ? POPULAR_MAX_AGE_MS : undefined }
    );
  };
  // The row's (or the last visit's) first page in this sort, however old.
  const peekFirst = () => {
    const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
    return getCachedPopularEstablishments(
      { near: point, photos: true, sort, ...(categoryId != null ? { categoryId } : {}) },
      Infinity
    );
  };
  return usePagedStores(fetchPage, ready, `${lat},${lng},${sort},${categoryId ?? ''}`, 'PopularStores', { peekFirst });
}
