import { useCallback, useEffect, useState } from 'react';
import {
  getCachedEstablishments,
  searchEstablishments,
  type Establishment,
  type EstablishmentResults,
} from '../services/establishments';

export type EstablishmentSearchStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/** One letter matches half the city; the list waits for a second. */
export const MIN_QUERY_LENGTH = 2;
/** A pause in typing, so one billed search goes out per word rather than per letter. */
export const SEARCH_DEBOUNCE_MS = 450;

/**
 * The "Location" list in step 1: the stores nearest the customer until they
 * type, then the stores matching what they typed.
 *
 * Nothing is asked until `ready` (the customer's saved location has loaded), so
 * the nearby list is fetched once, around the right point. Each new search
 * cancels the one before, so a slow answer never replaces a newer one.
 */
export function useEstablishmentSearch(
  query: string,
  near: { latitude: number; longitude: number } | null,
  ready: boolean,
  options: {
    /** Accept a nearby list this recent without asking again (see services/establishments.ts). */
    maxAgeMs?: number;
    /** Ask for each shop's photo address too: the Home row's cards. Each is a billed lookup. */
    withPhotos?: boolean;
    /** Only this merchant category's stores (Home's category tiles). */
    categoryId?: number | null;
    /** Optional category name for strict client-side category matching. */
    categoryName?: string | null;
  } = {}
) {
  const { maxAgeMs, withPhotos = false, categoryId = null, categoryName = null } = options;

  const trimmed = query.trim();
  const q = trimmed.length >= MIN_QUERY_LENGTH ? trimmed : '';
  const lat = near?.latitude;
  const lng = near?.longitude;

  // Stale-while-revalidate (2026-10-14): the list kept for this place, however
  // old, is what the list starts on, even on the first frame; a fresh one is
  // fetched behind it when the kept one is past `maxAgeMs`. Every return to
  // Home or a merchant screen used to start on a skeleton. Typed searches are
  // never kept, so they start empty as before.
  const peek = (): EstablishmentResults | null => {
    if (!ready || q || !maxAgeMs) return null;
    const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
    return getCachedEstablishments({ near: point, photos: withPhotos, categoryId }, Infinity);
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
    const show = (result: EstablishmentResults) => {
      setItems(result.items);
      setGoogleAvailable(result.google === 'ok');
      setOutsideServiceArea(result.outsideServiceArea === true);
      setStatus(result.items.length > 0 ? 'ready' : 'empty');
    };
    const kept = attempt === 0 ? peek() : null;
    if (kept) show(kept);
    else setStatus('loading');
    const timer = setTimeout(
      () => {
        const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
        // A retry after an error must reach the server; nothing failed is cached anyway.
        searchEstablishments({ q, near: point, photos: withPhotos, categoryId, categoryName }, controller.signal, {
          maxAgeMs: attempt === 0 ? maxAgeMs : undefined,
        })
          .then((result) => {
            if (controller.signal.aborted) return;
            show(result);
          })
          .catch((err) => {
            if (controller.signal.aborted) return;
            console.warn('[Establishments] Store search failed:', err?.message);
            // A failed refresh keeps the kept list; only nothing at all is an error.
            if (!kept) setStatus('error');
          });
      },
      q ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, lat, lng, ready, attempt, maxAgeMs, withPhotos, categoryId, categoryName]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { items, status, googleAvailable, outsideServiceArea, retry, query: q };
}
