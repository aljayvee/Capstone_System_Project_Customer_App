import { useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { extractMerchantCategories } from '../utils/merchantCategories';
import { cacheActiveErrand } from '../services/lastActiveErrand';
import { useCachedResource } from '../services/swrCache';

export interface ErrandSummary {
  id: string;
  category: string;
  categories?: string[] | string;
  description?: string;
  pickupAddress?: string;
  pabiliDetails?: Array<{ itemName?: string; size?: string | null; storeCategory?: string | null }>;
  pinpoints?: Array<{ storeName?: string; storeCategory?: string | null }>;
  status: string;
}

export interface UseActiveErrandsResult {
  errands: ErrandSummary[];
  /** Nothing to show yet: the first load, the one time for a skeleton. */
  loading: boolean;
  /** A pull-to-refresh, or a quiet refresh, is out while the list is shown. */
  refreshing: boolean;
  /** Offline with no list ever loaded. A cached list is shown instead of this. */
  error: boolean;
  refresh: () => Promise<void>;
}

/** Thrown when the phone is offline, so the cache records a failure, not an empty list. */
class OfflineError extends Error {}

async function fetchActiveErrands(userId: string | number): Promise<ErrandSummary[]> {
  let networkFailed = false;

  try {
    const response = await apiClient.get(`/errands/user/${userId}`);
    const allErrands = response.data || [];
    // CANCELLED errands are kept (their chat is still findable/reviewable —
    // see the filter buttons in ChatTab/ActiveChatsScreen), only COMPLETED
    // ones are dropped, since a settled errand has nothing left to chat about.
    const ongoing = allErrands
      .filter((e: any) => e.status !== 'PASSING BY' && e.status !== 'COMPLETED')
      .map((e: any) => ({
        ...e,
        id: String(e.id || e.orderId),
        category: extractMerchantCategories(e),
        status: e.status || 'PENDING',
      }));
    if (ongoing.length > 0) {
      // Snapshot for the offline screen, taken while the network still works.
      void cacheActiveErrand(ongoing[0]);
      return ongoing;
    }
  } catch (err: any) {
    // Was `err.code === 'ERR_NETWORK' || !err.response`, which was true for
    // every failure including a clean 404: the response interceptor used to
    // reject with a bare Error, so both fields were always undefined by the
    // time this looked at them. ApiError carries the real classification now.
    if (err?.isOffline) {
      networkFailed = true;
    }
  }

  try {
    const res = await apiClient.get(`/customers/${userId}/transactions`);
    const transactionErrands = res.data?.orders || [];
    const list = transactionErrands
      .filter((o: any) => o.status !== 'COMPLETED')
      .map((o: any) => ({
        ...o,
        id: String(o.orderId || o.id),
        category: extractMerchantCategories(o),
        status: o.status || 'PENDING',
      }));
    // An empty list here is an answer, not a failure: the customer has nothing
    // running, so the offline screen must stop offering a stale errand.
    void cacheActiveErrand(list.length > 0 ? list[0] : null);
    return list;
  } catch (err: any) {
    if (err?.isOffline || networkFailed) {
      throw new OfflineError('offline');
    }
    return [];
  }
}

/**
 * The customer's errands with a chat (Messages & Support, Active Chats).
 *
 * Cached per account (services/swrCache.ts, 2026-10-14). The list lived in the
 * screen's own state, so every return to the tab started on a skeleton and a
 * reload. Now the last list shows at once and is refreshed quietly when it is
 * over 15 s old; each row's last message is live from Firebase regardless.
 */
export function useActiveErrands(userId: string | number | undefined): UseActiveErrandsResult {
  const key = userId !== undefined && userId !== null && String(userId) !== '' ? `active-errands:${userId}` : null;
  const { data, isLoading, isRefreshing, error, revalidate } = useCachedResource<ErrandSummary[]>(
    key,
    () => fetchActiveErrands(userId!),
    { staleMs: 15 * 1000, persist: true }
  );

  const refresh = useCallback(() => revalidate({ force: true }), [revalidate]);

  return {
    errands: data ?? [],
    loading: key !== null && isLoading,
    refreshing: isRefreshing,
    error: data === undefined && error instanceof OfflineError,
    refresh,
  };
}
