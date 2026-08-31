import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';

const CACHE_KEY = '@sugo_customer_merchant_categories';
const DETAIL_CACHE_KEY = '@sugo_customer_merchant_categories_detail';
const IMAGE_CACHE_PREFIX = '@sugo_customer_store_cat_image_';

/**
 * Metadata for a category's owner-set photo (`store_cat_image`). The list
 * endpoint returns only this - never the base64 payload - so a cold start
 * costs a couple of kilobytes regardless of how many photos are set.
 * `updatedAt` doubles as the cache key: a new value means the owner replaced
 * the photo and the device must re-fetch it.
 */
export interface StoreCategoryImageMeta {
  mimeType: string;
  fileSize: number;
  updatedAt: string;
}

export interface BackendMerchantCategory {
  id?: number;
  name: string;
  description?: string;
  status?: string;
  dwellP50Seconds?: number;
  dwellP80Seconds?: number;
  image?: StoreCategoryImageMeta | null;
  _count?: {
    places?: number;
  };
}

/**
 * Last-resort fallback categories matching the backend server's active records in `merchant_categories` table.
 */
export const FALLBACK_BACKEND_CATEGORIES: BackendMerchantCategory[] = [
  {
    id: 1,
    // Must match the seeded name exactly. The server resolves an item's handling
    // fee by matching this string against merchant_categories.name, so a drift
    // here silently drops the errand back to the default fee mode.
    name: 'Fast Food & Restaurant',
    description: 'Fast food chains, diners, carinderias, bakeries, and cafes',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Pharmacy & Health',
    description: 'Drugstores, medical supply stores, and clinics',
    status: 'Active',
  },
  {
    id: 3,
    name: 'Supermarket & Grocery',
    description: 'Supermarkets, convenience stores, and public market stalls',
    status: 'Active',
  },
  {
    id: 4,
    name: 'Retail & General Merchandise',
    description: 'Department stores, hardware, school supplies, and dry goods',
    status: 'Active',
  },
];

export const FALLBACK_PABILI_CATEGORIES = FALLBACK_BACKEND_CATEGORIES.map((c) => c.name);

/**
 * Whether a category should be shown to a customer.
 *
 * Declared once and used by both the live and the cached path. Having the rule
 * written out twice is what let them disagree — the live fetch filtered on
 * status and the cache fallback did not, so deactivating a category in the owner
 * portal removed it from the grid only until the next network hiccup.
 *
 * The server already filters to Active on `/merchant-categories`; this is the
 * client-side half of the same rule, and it matters because the cache outlives
 * any single response.
 */
export function isSelectableCategory(c: BackendMerchantCategory | null): boolean {
  return Boolean(c && c.name && (c.status === 'Active' || !c.status));
}

function normalizeCategoryItem(c: any): BackendMerchantCategory | null {
  if (!c) return null;
  if (typeof c === 'string') {
    const name = c.trim();
    return name ? { name, status: 'Active' } : null;
  }
  if (typeof c === 'object') {
    const name = String(c.name || '').trim();
    if (!name) return null;
    const image =
      c.image && c.image.updatedAt
        ? {
            mimeType: String(c.image.mimeType || 'image/jpeg'),
            fileSize: Number(c.image.fileSize) || 0,
            updatedAt: String(c.image.updatedAt),
          }
        : null;

    return {
      id: typeof c.id === 'number' ? c.id : undefined,
      name,
      description: c.description ? String(c.description).trim() : undefined,
      status: c.status || 'Active',
      image,
      _count: c._count,
    };
  }
  return null;
}

/**
 * The active merchant categories, from the server when it can be reached.
 *
 * The distinction this function turns on is between "the server answered, and
 * the answer was none" and "the server could not be reached". They are not the
 * same thing and must not produce the same result:
 *
 *   - answered with a list  -> use it, and cache it
 *   - answered with none    -> show none. An empty catalogue is a real state
 *                              the owner can put the system into by
 *                              deactivating every category, and the customer
 *                              must see that rather than something invented.
 *   - could not be reached  -> last known good list, then the built-in seed
 *
 * It used to collapse the middle case into the third. The guard was
 * `response.data.length > 0`, so an empty array — the correct response when
 * every category is deactivated — skipped the success path entirely, fell
 * through to the cache, and finally to FALLBACK_BACKEND_CATEGORIES. That seed
 * list is Food & Restaurant, Pharmacy & Health, Supermarket & Grocery and
 * Retail & General Merchandise: precisely the categories an owner would have
 * just switched off. Deactivating them therefore appeared to do nothing at all,
 * because the app replaced the empty answer with hardcoded copies of the very
 * rows that had been retired.
 */
export async function fetchBackendMerchantCategories(): Promise<BackendMerchantCategory[]> {
  try {
    const response = await apiClient.get('/merchant-categories');

    if (Array.isArray(response.data)) {
      const items = response.data
        .map(normalizeCategoryItem)
        .filter((c): c is BackendMerchantCategory => isSelectableCategory(c));

      // Authoritative, including when it is empty. The cache is overwritten
      // with the empty list too — otherwise the next offline launch would
      // resurrect the categories that were just deactivated.
      void AsyncStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(items)).catch(() => {});
      return items;
    }

    // A non-array body means the response was not what this endpoint promises.
    // Treated as a failure so the offline paths below apply.
    console.warn('[MerchantCategories] Unexpected response shape; falling back to cache.');
  } catch (error) {
    console.warn('[MerchantCategories] Live fetch failed, falling back to cache.', error);
  }

  // Reached only when the server could not be reached or answered incoherently.
  try {
    const cached = await AsyncStorage.getItem(DETAIL_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        // Same active-only filter the live path applies. Without it the cache
        // was a hole in the rule: it stores whatever was active at write time,
        // so a category deactivated afterwards stayed in this list and was
        // rendered on the Bento grid on any request that fell back to cache.
        return parsed
          .map(normalizeCategoryItem)
          .filter((c): c is BackendMerchantCategory => isSelectableCategory(c));
      }
    }
  } catch (error) {
    console.warn('[MerchantCategories] Cached list unreadable.', error);
  }

  // No server, no cache — a first launch with no connectivity. Only here is it
  // right to show the built-in seed: there is genuinely nothing else to show,
  // and an empty grid would look broken rather than intentional.
  return FALLBACK_BACKEND_CATEGORIES;
}

/**
 * Fetch active category names string array.
 */
export async function fetchMerchantCategories(): Promise<string[]> {
  const items = await fetchBackendMerchantCategories();
  return items.map((c) => c.name);
}

/**
 * Fetch the owner-set photo for one category as a data URI, ready to hand to
 * an <ImageBackground source={{ uri }} />.
 *
 * Cached in AsyncStorage under the photo's `updatedAt`, so the bytes cross the
 * network exactly once per version. That matters more here than anywhere else
 * in the app: the Bento grid is the first thing rendered after login, often on
 * mobile data, and the alternative is re-downloading several hundred kilobytes
 * of unchanged JPEG on every launch.
 *
 * Resolves to `null` on any failure or when no photo is set — the Bento tile
 * falls back to its built-in stock image, so a missing photo is never a hole
 * in the grid.
 */
export async function fetchCategoryImageDataUri(
  categoryId: number,
  version: string
): Promise<string | null> {
  const cacheKey = `${IMAGE_CACHE_PREFIX}${categoryId}`;

  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.version === version && typeof parsed.uri === 'string' && parsed.uri) {
        return parsed.uri;
      }
    }
  } catch {
    // A corrupt cache entry is not worth failing over; fall through to network.
  }

  try {
    const response = await apiClient.get(`/merchant-categories/${categoryId}/image`);
    const uri = response.data?.imageData;
    if (typeof uri === 'string' && uri.startsWith('data:image/')) {
      void AsyncStorage.setItem(cacheKey, JSON.stringify({ version, uri })).catch(() => {});
      return uri;
    }
  } catch (error) {
    console.warn(`[MerchantCategories] Image fetch failed for category ${categoryId}.`, error);
  }

  return null;
}

/** Drop a cached photo, e.g. when the server reports the category has none. */
export async function clearCachedCategoryImage(categoryId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${IMAGE_CACHE_PREFIX}${categoryId}`);
  } catch {
    // Best effort only.
  }
}
