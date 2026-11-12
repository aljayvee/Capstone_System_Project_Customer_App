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
  isRecommended?: boolean;
  orderedBefore?: boolean;
  orderCount?: number;
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
    isRecommended: true,
    orderedBefore: false,
    orderCount: 0,
  },
  {
    id: 2,
    name: 'Pharmacy & Health',
    description: 'Drugstores, medical supply stores, and clinics',
    status: 'Active',
    isRecommended: true,
    orderedBefore: false,
    orderCount: 0,
  },
  {
    id: 3,
    name: 'Supermarket & Grocery',
    description: 'Supermarkets, convenience stores, and public market stalls',
    status: 'Active',
    isRecommended: true,
    orderedBefore: false,
    orderCount: 0,
  },
  {
    id: 4,
    name: 'Retail & General Merchandise',
    description: 'Department stores, hardware, school supplies, and dry goods',
    status: 'Active',
    isRecommended: true,
    orderedBefore: false,
    orderCount: 0,
  },
];

export const FALLBACK_PABILI_CATEGORIES = FALLBACK_BACKEND_CATEGORIES.map((c) => c.name);

/**
 * Category name tokens that identify a non-Pabili service type.
 *
 * This is the client-side counterpart of the server's RETIRED_CATEGORY_NAMES /
 * BLOCKED_CATEGORY_TOKENS lists (server/src/lib/blockedCategoryNames.ts).
 * The server already filters these out through the seeder and the creation
 * guard; this list is the defensive second layer — it ensures the CustomerApp's
 * Find Stores screen never shows these types even if one somehow slips through
 * as Active in the database.
 *
 * Matched as whole words against the lower-cased category name, so "school"
 * does not trip on "preschool" — but "Motor Parts" WILL be caught because
 * both "motor" and "parts" are common retail identifiers only in that context.
 * Keep terms unambiguous: a term that could describe a real Pabili store
 * (e.g. "bank" alone could match "Bank of Bread") should be a phrase instead.
 */
const PABILI_ONLY_DENYLIST_TOKENS: ReadonlyArray<string> = [
  // Schools / Education
  'school', 'schools', 'university', 'college', 'institution', 'institutions', 'education', 'educational', 'academy',

  // Banks / Financial
  'bank', 'banks', 'atm',

  // Padala / Remittance
  'remittance', 'padala',

  // Motor Trades / Auto Parts
  'motorparts', 'automotive',

  // Logistics / Freight / Courier / Express
  'logistics', 'logistic', 'logicstics', 'courier', 'couriers', 'cargo', 'freight', 'shipping', 'forwarder', 'forwarding', 'express', 'xpress',

  // Police Outposts & Law Enforcement
  'police', 'outpost', 'outposts', 'precinct', 'pnp',

  // Government Offices
  'government', 'governments', 'govt', 'office', 'offices', 'municipal', 'capitol', 'courthouse', 'embassy', 'lgu',

  // Network / Telecom / ISP
  'network', 'networks', 'networking', 'telecom', 'telecommunications', 'isp', 'broadband',

  // Internet Cafe / Gaming / Computer Shops
  'internet', 'cybercafe', 'netcafe', 'icafe', 'pisonet', 'esports',

  // Nightclubs / Bars / KTV
  'nightclub', 'nightclubs', 'disco', 'discotheque', 'ktv', 'beerhouse', 'restobar', 'pub', 'videoke', 'karaoke', 'casino',

  // Salons / Personal Care
  'salon', 'salons', 'barbershop', 'barber', 'spa',

  // Carwash
  'carwash',
];

const PABILI_ONLY_DENYLIST_PHRASES: ReadonlyArray<string> = [
  'motor trade', 'motor parts', 'motor accessories',
  'auto parts', 'motorcycle parts',
  'money transfer', 'financial service', 'financial services',
  'pera padala',
  // Logistics & Express
  'logistics service', 'logistics services', 'courier service', 'courier services', 'express courier',
  'cargo forwarder', 'freight forwarder', 'cargo service', 'cargo services',
  'freight service', 'freight services', 'shipping service', 'shipping services',
  'j t express', 'lbc express', 'jrs express', 'flash express', '2go express', 'spx express', 'dhl express', 'palawan express', 'ninja van',
  // Police Outposts & Stations
  'police outpost', 'police station', 'police stations', 'police precinct',
  'fire station', 'gas station', 'gasoline station', 'petrol station', 'bus station', 'bus terminal', 'transit station',
  // Government Offices
  'government office', 'government offices', 'city hall', 'municipal hall', 'barangay hall', 'provincial capitol', 'post office',
  // Network / Telecom
  'cable network', 'radio network', 'tv network', 'internet service', 'telecom service',
  // Internet Cafe / Computer Shops
  'internet cafe', 'internet cafes', 'internet shop', 'cyber cafe', 'computer shop', 'computer cafe', 'net cafe', 'piso net', 'gaming cafe',
  // Nightclubs / Bars
  'night club', 'night clubs', 'comedy club', 'videoke bar', 'karaoke bar', 'ktv bar', 'sports bar', 'cocktail lounge', 'beer house',
  // Salons
  'beauty salon', 'hair salon', 'nail salon', 'barber shop', 'hair and beauty',
  // Carwash
  'car wash', 'auto wash', 'car detailing', 'auto detailing',
];

/**
 * Returns false for category names that describe a non-Pabili service type
 * (schools, banks, padala/remittance outlets, motor trades / auto parts).
 *
 * The server-side seeder is the primary gate; this is the defensive client
 * fallback so the Find Stores screen is never polluted even if the DB state
 * lags behind the latest seed run.
 */
export function isPabiliCategory(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Phrase check first (most specific match).
  for (const phrase of PABILI_ONLY_DENYLIST_PHRASES) {
    if (normalized.includes(phrase)) return false;
  }

  // Whole-word token check.
  const wordSet = new Set(normalized.split(' '));
  for (const token of PABILI_ONLY_DENYLIST_TOKENS) {
    if (wordSet.has(token)) return false;
  }

  return true;
}


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
      isRecommended: Boolean(c.isRecommended),
      orderedBefore: Boolean(c.orderedBefore),
      orderCount: typeof c.orderCount === 'number' ? c.orderCount : 0,
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
      const items: BackendMerchantCategory[] = response.data
        .map(normalizeCategoryItem)
        .filter((c): c is BackendMerchantCategory => isSelectableCategory(c))
        .filter((c) => isPabiliCategory(c.name));

      // Authoritative, including when it is empty. The cache is overwritten
      // with the empty list too — otherwise the next offline launch would
      // resurrect the categories that were just deactivated.
      //
      // The list is already Pabili-filtered above, so a cached read on the
      // next offline launch also stays clean — no second pass needed there.
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
        // Same active-only AND Pabili-only filters the live path applies.
        // Without it the cache was a hole in the rule: it stores whatever was
        // active at write time, so a category deactivated (or retired) after
        // the last successful fetch would stay in this list and be rendered
        // on the Bento grid on any request that fell back to cache.
        return (parsed as Array<BackendMerchantCategory | null>)
          .map(normalizeCategoryItem)
          .filter((c): c is BackendMerchantCategory => isSelectableCategory(c))
          .filter((c) => isPabiliCategory(c.name));
      }
    }
  } catch (error) {
    console.warn('[MerchantCategories] Cached list unreadable.', error);
  }

  // No server, no cache — a first launch with no connectivity. Only here is it
  // right to show the built-in seed: there is genuinely nothing else to show,
  // and an empty grid would look broken rather than intentional.
  // FALLBACK_BACKEND_CATEGORIES only contains the four Pabili-appropriate
  // categories, so no further filtering is needed here.
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

export const SEARCH_AFFINITY_STORAGE_KEY = '@sugo_customer_category_affinity';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Fast Food & Restaurant': [
    'food', 'restaurant', 'fastfood', 'fast food', 'burger', 'chicken', 'pizza',
    'jollibee', 'mcdo', 'mcdonald', 'chowking', 'mang inasal', 'cafe', 'coffee',
    'dining', 'meals', 'snack', 'diner', 'carinderia',
  ],
  'Pharmacy & Health': [
    'pharmacy', 'medicine', 'drug', 'drugstore', 'health', 'meds', 'clinic',
    'mercury', 'generika', 'tmg', 'wellness', 'medical', 'vitamins',
  ],
  'Supermarket & Grocery': [
    'supermarket', 'grocery', 'market', 'groceries', 'mart', 'savemore', 'puregold',
    'primark', 'convenience', 'pantry', 'rice', 'meat', 'vegetables', 'fruits',
  ],
  'Bakery & Pastry': [
    'bakery', 'pastry', 'bread', 'cake', 'bakeshop', 'donuts', 'pandesal', 'goldilocks',
    'red ribbon', 'pastries', 'cookies',
  ],
  'Retail & General Merchandise': [
    'retail', 'merchandise', 'hardware', 'supplies', 'department', 'clothes',
    'shoes', 'apparel', 'dry goods', 'school supplies', 'homeware',
  ],
};

/**
 * Record customer search / exploration affinity for a category.
 * Boosts category position in the "Explore merchants categories" section.
 */
export async function recordCategorySearchAffinity(categoryNameOrQuery: string): Promise<void> {
  if (!categoryNameOrQuery || typeof categoryNameOrQuery !== 'string') return;
  const clean = categoryNameOrQuery.trim().toLowerCase();
  if (!clean) return;

  try {
    const raw = await AsyncStorage.getItem(SEARCH_AFFINITY_STORAGE_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};

    // Match exact category name
    let matchedCategory: string | null = null;
    for (const catName of Object.keys(CATEGORY_KEYWORDS)) {
      if (catName.toLowerCase() === clean) {
        matchedCategory = catName;
        break;
      }
    }

    // If not exact category name, check keyword hits
    if (!matchedCategory) {
      for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => clean.includes(kw) || kw.includes(clean))) {
          matchedCategory = catName;
          break;
        }
      }
    }

    const targetKey = matchedCategory || categoryNameOrQuery.trim();
    map[targetKey] = (map[targetKey] || 0) + 1;
    await AsyncStorage.setItem(SEARCH_AFFINITY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Non-blocking best-effort
  }
}

/**
 * Retrieve cached search affinities.
 */
export async function getCategorySearchAffinities(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_AFFINITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Prioritizes merchant categories based on:
 * 1. Past orders (orderedBefore: true, orderCount heavily weighted)
 * 2. Search / exploration affinity (local customer interaction count)
 * 3. Server composite score / order (popularity, verified places, base weights)
 *
 * Stamped hierarchy invariant:
 * The first 4 categories in the resulting sorted list are stamped with `isRecommended: true`.
 * All subsequent categories have `isRecommended: false`.
 */
export function prioritizeCategoriesWithAffinity(
  categories: BackendMerchantCategory[],
  affinities: Record<string, number> = {}
): BackendMerchantCategory[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];

  const sorted = [...categories].sort((a, b) => {
    // 1. Personal orders from past transactions take primary precedence
    const aOrders = a.orderCount || (a.orderedBefore ? 1 : 0);
    const bOrders = b.orderCount || (b.orderedBefore ? 1 : 0);
    const orderDiff = bOrders - aOrders;
    if (orderDiff !== 0) return orderDiff;

    // 2. Client-side search & category interaction affinity
    const aAffinity = affinities[a.name] || 0;
    const bAffinity = affinities[b.name] || 0;
    const affinityDiff = bAffinity - aAffinity;
    if (affinityDiff !== 0) return affinityDiff;

    // 3. Fallback: preserve original server rank (already sorted by platform orders + places + base weights)
    return 0;
  });

  // Re-stamp the top 4 as recommended in the final dynamic order
  return sorted.map((cat, index) => ({
    ...cat,
    isRecommended: index < 4,
  }));
}

