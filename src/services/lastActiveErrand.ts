import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ErrandSummary } from '../hooks/useActiveErrands';

const CACHE_KEY = '@sugo_customer_last_active_errand';

export interface CachedActiveErrand {
  errand: ErrandSummary;
  /** When this snapshot was taken, so the UI can say how stale it is. */
  cachedAt: number;
}

/**
 * The last active errand the app successfully loaded, kept on disk.
 *
 * Exists for one reason: the offline screen. A customer whose rider is already
 * on the way is the one person for whom a hard block is genuinely cruel, and
 * the moment they most want to look is the moment nothing can be fetched. So
 * the snapshot is written while the network still works.
 *
 * Follows the same live-fetch-then-fall-back-to-disk shape as
 * services/merchantCategories.ts, and like that one it distinguishes "there are
 * no active errands" (clear the cache) from "we could not ask" (leave it alone).
 */
export async function cacheActiveErrand(errand: ErrandSummary | null): Promise<void> {
  try {
    if (!errand) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return;
    }
    const payload: CachedActiveErrand = { errand, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A snapshot is a nicety. Never let it break the fetch that produced it.
  }
}

export async function readCachedActiveErrand(): Promise<CachedActiveErrand | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedActiveErrand;
    if (!parsed?.errand?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCachedActiveErrand(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing stored.
  }
}

/**
 * "Last updated 4 minutes ago". Plain relative time, no clock, because the
 * point is how stale this is rather than when it happened.
 */
export function describeStaleness(cachedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - cachedAt) / 1000));
  if (seconds < 60) return 'Last updated just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last updated ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `Last updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
