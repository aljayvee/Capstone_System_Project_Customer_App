import { getCachedEstablishments, searchEstablishments } from '../services/establishments';
import { usePagedStores, type PagedStores, type StorePageFetch } from './usePagedStores';

/** Home's "Stores near you" row and its screen share one answer for this long. */
export const NEARBY_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * The "Stores near you" screen (2026-10-11), opened from Home's row: the stores
 * nearest the customer's saved location, in the server's recommendation order
 * (distance first, then their own past orders and everyone's), with photos. The
 * first page is the row's own answer (four stores, shared for two minutes),
 * then six at a time up to 20 as the list reaches its end
 * (hooks/usePagedStores.ts). A server before 2026-10-11 sends the four only.
 */
export function useNearbyStoresPages(near: { latitude: number; longitude: number } | null, ready: boolean): PagedStores {
  const lat = near?.latitude;
  const lng = near?.longitude;
  const fetchPage: StorePageFetch = async (page, signal) => {
    const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
    const result = await searchEstablishments(
      { near: point, photos: true, ...(page.offset > 0 ? { offset: page.offset, limit: page.limit } : {}) },
      signal,
      { maxAgeMs: page.cached ? NEARBY_MAX_AGE_MS : undefined }
    );
    return {
      items: result.items,
      google: result.google,
      hasMore: result.hasMore === true,
      outsideServiceArea: result.outsideServiceArea === true,
    };
  };
  // The row's (or the last visit's) first page, however old, to start on.
  const peekFirst = () => {
    const point = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
    const kept = getCachedEstablishments({ near: point, photos: true }, Infinity);
    return kept
      ? {
          items: kept.items,
          google: kept.google,
          hasMore: kept.hasMore === true,
          outsideServiceArea: kept.outsideServiceArea === true,
        }
      : null;
  };
  return usePagedStores(fetchPage, ready, `${lat},${lng}`, 'NearbyStores', { peekFirst });
}

/** "Find stores" shows this many, and this many more each time See more is tapped. */
export const FIND_STORES_PAGE_SIZE = 10;

/**
 * "Find stores", before anything is typed (2026-10-14). It showed the four
 * stores of Home's row; now the featured brands come first (Jollibee,
 * McDonald's, Fitmart, Kimsan, Savemore, 7-Eleven: the server's
 * FEATURED_STORE_BRANDS), each marked `featured`, then every other store in the
 * recommendation order, which learns from the customer's own past orders.
 * Ten at a time, up to STORE_PAGES_MAX; the screen's "See more" asks for the
 * next ten. A server from before then sends no marks, and the list simply
 * pages in the usual order.
 */
export function useFindStoresPages(near: { latitude: number; longitude: number } | null, ready: boolean): PagedStores {
  const lat = near?.latitude;
  const lng = near?.longitude;
  const point = () => (lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null);
  const fetchPage: StorePageFetch = async (page, signal) => {
    const result = await searchEstablishments(
      {
        near: point(),
        photos: true,
        featured: true,
        offset: page.offset,
        limit: page.offset > 0 ? page.limit : FIND_STORES_PAGE_SIZE,
      },
      signal,
      { maxAgeMs: page.cached ? NEARBY_MAX_AGE_MS : undefined }
    );
    return {
      items: result.items,
      google: result.google,
      hasMore: result.hasMore === true,
      outsideServiceArea: result.outsideServiceArea === true,
    };
  };
  const peekFirst = () => {
    const kept = getCachedEstablishments(
      { near: point(), photos: true, featured: true, offset: 0, limit: FIND_STORES_PAGE_SIZE },
      Infinity
    );
    return kept
      ? {
          items: kept.items,
          google: kept.google,
          hasMore: kept.hasMore === true,
          outsideServiceArea: kept.outsideServiceArea === true,
        }
      : null;
  };
  return usePagedStores(fetchPage, ready, `${lat},${lng}:featured`, 'FindStores', {
    peekFirst,
    pageSize: FIND_STORES_PAGE_SIZE,
  });
}
