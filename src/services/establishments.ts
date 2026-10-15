import { apiClient } from './apiClient';
import { haversineDistanceKm } from '../utils/geo';
import { isPabiliCategory } from './merchantCategories';

const NON_PABILI_STORE_PHRASES: ReadonlyArray<string> = [
  'motor trade',
  'motor parts',
  'auto parts',
  'motorcycle parts',
  'car repair',
  'motorcycle repair',
  'machine shop',
  'vulcanizing',
  'elementary school',
  'high school',
  'national high school',
  'integrated school',
  'academy of',
  'central school',
  'college of',
  'pera padala',
  'money transfer',
  'express padala',
  'rural bank',
  'universal bank',
  // Carwash
  'car wash',
  'auto wash',
  'car detailing',
  'auto detailing',
  // Salons
  'beauty salon',
  'hair salon',
  'nail salon',
  'barber shop',
  'hair and beauty',
  // Logistics & Express
  'logistics service',
  'logistics services',
  'courier service',
  'courier services',
  'cargo forwarder',
  'freight forwarder',
  'express courier',
  'logistics express',
  'freight service',
  'freight services',
  'shipping service',
  'shipping services',
  'cargo service',
  'cargo services',
  'j t express',
  'lbc express',
  'jrs express',
  'flash express',
  '2go express',
  'spx express',
  'shopee xpress',
  'dhl express',
  'palawan express',
  'ninja van',
  'ap cargo',
  'capitol cargo',
  'forwarding service',
  'trucking service',
  'hauling service',
  // Police Outposts & Stations
  'police outpost',
  'police station',
  'police stations',
  'police precinct',
  'police headquarters',
  'police community',
  'pnp station',
  'pnp outpost',
  'fire station',
  'gas station',
  'gasoline station',
  'petrol station',
  'bus station',
  'bus terminal',
  'public terminal',
  'transit station',
  'train station',
  'radio station',
  'tv station',
  'broadcasting station',
  // Government Offices
  'government office',
  'government offices',
  'government center',
  'government agency',
  'city hall',
  'municipal hall',
  'barangay hall',
  'town hall',
  'provincial capitol',
  'hall of justice',
  'registry of deeds',
  'bureau of',
  'department of',
  'commission on',
  'office of the',
  'civil service',
  'social security',
  'land transportation',
  'internal revenue',
  'agrarian reform',
  'public attorney',
  'health office',
  'treasurer office',
  'assessor office',
  'civil registrar',
  'post office',
  // Network / Telecom / ISP
  'cable network',
  'radio network',
  'tv network',
  'television network',
  'broadcasting network',
  'computer network',
  'network service',
  'network services',
  'internet service',
  'telecom service',
  'globe store',
  'smart store',
  'pldt office',
  'converge ict',
  'dito telecommunity',
  // Internet Cafe / Computer Shops
  'internet cafe',
  'internet cafes',
  'internet shop',
  'cyber cafe',
  'computer shop',
  'computer cafe',
  'computer center',
  'net cafe',
  'piso net',
  'gaming cafe',
  'gaming hub',
  'gaming center',
  'esports center',
  // Nightclubs / Bars / KTV
  'night club',
  'night clubs',
  'comedy club',
  'videoke bar',
  'karaoke bar',
  'ktv bar',
  'sports bar',
  'cocktail lounge',
  'beer house',
  'gentlemen club',
  'strip club',
  'adult entertainment',
];

const NON_PABILI_STORE_TOKENS: ReadonlyArray<string> = [
  'school',
  'schools',
  'college',
  'university',
  'preschool',
  'bank',
  'banks',
  'atm',
  'bdo',
  'bpi',
  'metrobank',
  'landbank',
  'pnb',
  'chinabank',
  'rcbc',
  'padala',
  'remittance',
  'cebuana',
  'mlhuillier',
  'motorparts',
  // Carwash
  'carwash',
  // Salons
  'salon',
  'salons',
  'barbershop',
  'barber',
  'spa',
  // Logistics & Express
  'logistics',
  'logistic',
  'logicstics',
  'courier',
  'couriers',
  'cargo',
  'freight',
  'shipping',
  'forwarder',
  'forwarding',
  'trucking',
  'hauling',
  'lbc',
  'jrs',
  'ninjavan',
  'spx',
  'dhl',
  'fedex',
  'entrego',
  '2go',
  'express',
  'xpress',
  // Police Outposts & Stations
  'police',
  'outpost',
  'outposts',
  'precinct',
  'pnp',
  'bfp',
  'bjmp',
  'compac',
  'petron',
  'caltex',
  'seaoil',
  'flyingv',
  // Government Offices
  'government',
  'governments',
  'govt',
  'office',
  'offices',
  'municipal',
  'barangay',
  'capitol',
  'courthouse',
  'embassy',
  'lgu',
  'bir',
  'lto',
  'sss',
  'philhealth',
  'pagibig',
  'dswd',
  'comelec',
  'csc',
  'dti',
  'dole',
  'dpwh',
  'denr',
  'nbi',
  'psa',
  'dfa',
  'dilg',
  'deped',
  'tesda',
  'ched',
  // Network / Telecom / ISP
  'network',
  'networks',
  'networking',
  'telecom',
  'telecommunications',
  'isp',
  'pldt',
  'converge',
  'skycable',
  'broadband',
  // Internet Cafe / Computer Shops
  'internet',
  'cybercafe',
  'netcafe',
  'icafe',
  'pisonet',
  'esports',
  'computershop',
  // Nightclubs / Bars / KTV
  'nightclub',
  'nightclubs',
  'disco',
  'discotheque',
  'ktv',
  'beerhouse',
  'restobar',
  'pub',
  'nightlife',
  'videoke',
  'karaoke',
  'casino',
  'gambling',
];

const WATER_STATION_ALLOW_TOKENS = new Set([
  'water',
  'refilling',
  'purified',
  'alkaline',
  'mineral',
  'aquabest',
  'tubig',
]);

function isNonPabiliText(rawText: string): boolean {
  const norm = String(rawText ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return false;

  for (const phrase of NON_PABILI_STORE_PHRASES) {
    if (norm.includes(phrase)) return true;
  }

  const words = new Set(norm.split(' '));
  for (const token of NON_PABILI_STORE_TOKENS) {
    if (words.has(token)) return true;
  }

  // Block "station" / "stations" (Police Station, Gas Station, Bus Station, Fire Station,
  // Radio/TV Station, or a bare "Stations" search) unless it is a Water Refilling Station.
  if (words.has('station') || words.has('stations')) {
    const isWaterRefilling = [...WATER_STATION_ALLOW_TOKENS].some((w) => words.has(w));
    if (!isWaterRefilling) return true;
  }

  return false;
}

/**
 * Returns false when the customer's search query itself asks for a non-Pabili
 * destination (Police Outpost/Stations, Government Offices, Network, Internet Cafe,
 * Nightclub, Logistics, Express, Schools, Banks, Salons, Carwash, etc.).
 */
export function isPabiliSearchQuery(query: string | null | undefined): boolean {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) return true;
  if (!isPabiliCategory(trimmed)) return false;
  return !isNonPabiliText(trimmed);
}

const STREET_ROAD_TOKENS = new Set([
  'street',
  'st',
  'road',
  'rd',
  'highway',
  'hwy',
  'avenue',
  'ave',
  'boulevard',
  'blvd',
  'lane',
  'ln',
  'drive',
  'dr',
  'way',
  'expressway',
  'rotary',
  'junction',
  'crossing',
]);

const KNOWN_BUSINESS_TOKENS = new Set([
  'pharmacy',
  'drug',
  'bakery',
  'bakeshop',
  'restaurant',
  'resto',
  'grill',
  'cafe',
  'coffee',
  'diner',
  'eatery',
  'store',
  'shop',
  'mart',
  'grocery',
  'supermarket',
  'hardware',
  'meat',
  'chicken',
  'pizza',
  'burger',
  'tea',
  'buko',
  'pie',
  'pasalubong',
  'salon',
  'barber',
  'pet',
  'petshop',
  'boutique',
  'clothing',
  'apparel',
  'kitchen',
  'food',
  'kitchenette',
  'fastfood',
  'deli',
  'icecream',
  'donut',
  'lechon',
  'bbq',
  'balbakwa',
  'kambingan',
  'lutong',
  'haus',
  'house',
  'shack',
  'center',
  'hub',
  'plaza',
  'mall',
  'bazaar',
  'trading',
  'enterprise',
  'supply',
  'supplies',
  'depot',
  'wholesaler',
  'retail',
  'gadgets',
  'computers',
  'tailor',
  'florist',
  'botica',
  'farmacia',
  'refreshment',
  'canteen',
  'carinderia',
  // Common national & regional retail / food brands
  'jollibee',
  'mcdonald',
  'mcdonalds',
  'mcdo',
  'chowking',
  'greenwich',
  'manginasal',
  'kfc',
  'dunkin',
  'mercury',
  'watsons',
  'rose',
  'generics',
  'southstar',
  'fitmart',
  'kcc',
  'gaisano',
  'savemore',
  'puregold',
  'alfamart',
  'ministop',
]);

const MUNICIPALITY_STRIP_WORDS = new Set([
  'tacurong',
  'city',
  'of',
  'sultan',
  'kudarat',
  'poblacion',
  'philippines',
]);

/**
 * Returns true if the place's name is purely a road or highway identifier
 * (e.g. "Ledesma street", "Lesdema street tacurong city", "National Highway", "Tacurong - Isulan Rd")
 * without any business or merchant brand keyword.
 */
export function isStreetOnlyName(name: string): boolean {
  const norm = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return false;

  const rawWords = norm.split(' ').filter(Boolean);
  const words = rawWords.filter((w) => !MUNICIPALITY_STRIP_WORDS.has(w));
  if (words.length === 0) return true;

  const hasStreetToken = words.some((w) => STREET_ROAD_TOKENS.has(w));
  if (!hasStreetToken) return false;

  const hasBusinessKeyword = words.some((w) => KNOWN_BUSINESS_TOKENS.has(w));
  if (hasBusinessKeyword) return false;

  return words.length <= 3;
}

/**
 * Returns false if an establishment is a non-Pabili stop
 * (Schools, Banks, Padala Outlets, Motor Trades / parts / repair shops,
 * Police outposts/stations, Government offices, Network/Telecom offices,
 * Internet cafes, Nightclubs/Bars, or Logistics/Express couriers).
 * Pabili is exclusively for buying goods (food, grocery, medicine, retail).
 */
export function isPabiliEstablishment(
  store: Pick<Establishment, 'name' | 'categoryName'> | null | undefined
): boolean {
  if (!store || !store.name) return false;

  // 1. If assigned category is non-Pabili, drop it
  if (store.categoryName && !isPabiliCategory(store.categoryName)) {
    return false;
  }

  // 2. Reject ghost places whose name is purely a street or road name
  if (isStreetOnlyName(store.name)) {
    return false;
  }

  // 3. Name check
  if (isNonPabiliText(store.name)) {
    return false;
  }

  return true;
}

/**
 * Concise safeguard message shown whenever a customer's delivery location is
 * outside the Tacurong City service area.
 */
export const OUTSIDE_SERVICE_AREA_MESSAGE = "Sugo Express isn't in your area yet.";

/**
 * Tacurong City administrative boundary envelope (from tacurong-service-area.geojson)
 * with a ~150m perimeter highway buffer.
 */
const TACURONG_ENVELOPE = {
  minLat: 6.5665,
  maxLat: 6.761,
  minLng: 124.618,
  maxLng: 124.7295,
};

export function isWithinTacurongServiceArea(
  point: { latitude: number; longitude: number } | null | undefined
): boolean {
  if (!point) return true;
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= TACURONG_ENVELOPE.minLat &&
    lat <= TACURONG_ENVELOPE.maxLat &&
    lng >= TACURONG_ENVELOPE.minLng &&
    lng <= TACURONG_ENVELOPE.maxLng
  );
}

/**
 * A real store the customer can pick in step 1's "Location" list: one of the
 * owner's Location Stores, or a Google Maps establishment. The server works out
 * each one's merchant category (services/establishmentService.ts there).
 */
export interface Establishment {
  key: string;
  source: 'catalogue' | 'google';
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** True for owner-verified catalogue stores (from `verified_places`). */
  isVerified?: boolean;
  placeId: string | null;
  googlePlaceId: string | null;
  categoryId: number | null;
  categoryName: string | null;
  distanceMeters: number | null;
  /**
   * True unless the server (via Google Places opening hours / business status)
   * explicitly reports the store as closed right now (`isOpen === false`).
   * If not closed (or unknown), defaults to open (`true`).
   */
  isOpen?: boolean;
  /**
   * User-friendly notice when `isOpen === false` (e.g. "Opens at 8:00 AM" or
   * "Temporarily Unavailable"). Null or omitted when the store is open.
   */
  closedReason?: string | null;
  /**
   * The customer has ordered from this store before. The server ranks the list
   * with it (a usual store can come before a slightly closer one), so the row
   * says why. Optional: absent from servers before 2026-10-08.
   */
  orderedBefore?: boolean;
  /** Google's name for the shop's own photo (server lib/places/placePhotos.ts). Null for Location Stores. */
  photoName?: string | null;
  /** Who took that photo. Google requires it shown with the photo. */
  photoAttribution?: string | null;
  /**
   * The photo's image address on Google's image host, which needs no key and no
   * sign-in. Only filled when the list was asked for with `photos` (the Home row).
   */
  photoUrl?: string | null;
  /** Google's star rating, 1 to 5: only the popular list carries it. Null when unrated. */
  rating?: number | null;
  /** How many people rated it. */
  ratingCount?: number | null;
  /**
   * One of the brands "Find stores" recommends first (2026-10-14). Only on a
   * list asked for with `featured`; servers before then never send it.
   */
  featured?: boolean;
}

/**
 * The image source for a shop's own photo, or null when it has none.
 *
 * The server looks the address up with its own Places key and returns it in the
 * list, so the image loads with no header at all. The first version pointed the
 * image at an API route instead, and the phone's image loader sent no
 * Authorization header with it: every photo was refused as signed out, and
 * every card showed its category picture (2026-10-08).
 */
export function storePhotoSource(store: Pick<Establishment, 'photoUrl'>): { uri: string } | null {
  return store.photoUrl ? { uri: store.photoUrl } : null;
}

/** How far a store is, for a list row or a card: "350 m", "1.2 km". Null when unknown. */
export function storeDistanceLabel(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) return null;
  return meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export interface EstablishmentResults {
  items: Establishment[];
  /** "unavailable": Google could not answer, and the list is SUGO's own stores. */
  google: 'ok' | 'unavailable';
  /**
   * The nearby list only: another page follows (the "Stores near you" screen,
   * 2026-10-11). False from servers before then, which sent four.
   */
  hasMore?: boolean;
  /** True when the customer's location is outside the Tacurong City service area. */
  outsideServiceArea?: boolean;
}

/**
 * The nearby list, kept briefly for the Home tab, which remounts on every tab
 * switch: each fetch is a billed Google request, and the stores near a customer
 * do not change in two minutes. Keyed to about 100 m. Only callers that pass
 * `maxAgeMs` read it, so step 1's list and its "Try again" stay fresh.
 */
const nearbyCache = new Map<string, { at: number; results: EstablishmentResults }>();

// Photos are part of the key: step 1's answer has none, and must not stand in
// for the Home row's. So is a merchant category, whose list is its stores only.
// So is `featured` ("Find stores"), whose order differs from Home's row.
const nearbyKey = (
  near: { latitude: number; longitude: number } | null | undefined,
  photos: boolean,
  categoryId?: number | null,
  featured?: boolean
) =>
  `${near ? `${near.latitude.toFixed(3)},${near.longitude.toFixed(3)}` : 'centre'}${photos ? ':photos' : ''}${
    categoryId ? `:category${categoryId}` : ''
  }${featured ? ':featured' : ''}`;

function singularCategoryWord(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ss|x|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function normalizeCategorySegment(name: string): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularCategoryWord)
    .join(' ');
}

function splitCategorySegments(name: string): string[] {
  return String(name ?? '')
    .split(/\s*(?:&|\band\b|\/|,)\s*/i)
    .map(normalizeCategorySegment)
    .filter(Boolean);
}

/**
 * Returns true if `store` belongs to the target merchant category (`categoryId` / `categoryName`).
 * When neither `categoryId` nor `categoryName` is specified, every store matches.
 * When a category filter is specified, stores belonging to other categories
 * (or uncategorized stores from an unscoped response) are strictly excluded.
 */
export function doesEstablishmentMatchCategory(
  store: Pick<Establishment, 'categoryId' | 'categoryName'> | null | undefined,
  categoryId?: number | null,
  categoryName?: string | null
): boolean {
  const hasTargetId = typeof categoryId === 'number' && Number.isFinite(categoryId);
  const targetNorm = categoryName ? normalizeCategorySegment(categoryName) : '';
  if (!hasTargetId && !targetNorm) return true;
  if (!store) return false;

  const targetParts = categoryName ? splitCategorySegments(categoryName) : [];
  const storeNorm = store.categoryName ? normalizeCategorySegment(store.categoryName) : '';
  const storeParts = store.categoryName ? splitCategorySegments(store.categoryName) : [];

  if (hasTargetId && typeof store.categoryId === 'number' && Number.isFinite(store.categoryId)) {
    if (store.categoryId === categoryId) {
      if (!targetNorm || !storeNorm) return true;
      if (storeNorm === targetNorm) return true;
      if (storeParts.some((part) => targetParts.includes(part))) return true;
    }
  }

  if (targetNorm && storeNorm) {
    if (storeNorm === targetNorm) return true;
    if (targetParts.length > 1 && storeParts.length > 0 && storeParts.every((part) => targetParts.includes(part))) {
      return true;
    }
  }

  return false;
}

/**
 * GET /places/establishments. Without `q`, the stores nearest `near`; with it,
 * the stores matching it. With `categoryId`, only that merchant category's
 * stores, up to 20 (Home's category tiles, 2026-10-10). Throws, so the list can
 * show its error with Retry.
 */
export async function searchEstablishments(
  params: {
    q?: string;
    near?: { latitude: number; longitude: number } | null;
    photos?: boolean;
    categoryId?: number | null;
    categoryName?: string | null;
    /** The nearby list a page at a time: `limit` stores from `offset`. */
    offset?: number;
    limit?: number;
    /** "Find stores": the featured brands first, each marked (2026-10-14). */
    featured?: boolean;
  },
  signal?: AbortSignal,
  options: { maxAgeMs?: number } = {}
): Promise<EstablishmentResults> {
  if (params.near && !isWithinTacurongServiceArea(params.near)) {
    return {
      items: [],
      google: 'ok',
      hasMore: false,
      outsideServiceArea: true,
    };
  }

  if (params.q && !isPabiliSearchQuery(params.q)) {
    return {
      items: [],
      google: 'ok',
      hasMore: false,
    };
  }

  const cacheable = !params.q && Boolean(options.maxAgeMs);
  const page = params.offset || params.limit ? `:${params.offset ?? 0}:${params.limit ?? ''}` : '';
  const featured = !params.q && Boolean(params.featured);
  const key = `${nearbyKey(params.near, Boolean(params.photos), params.categoryId, featured)}${page}`;
  const cached = cacheable ? nearbyCache.get(key) : undefined;
  if (cached && Date.now() - cached.at < options.maxAgeMs!) return cached.results;

  const response = await apiClient.get('/places/establishments', {
    params: {
      ...(params.q ? { q: params.q } : {}),
      ...(params.near ? { lat: params.near.latitude, lng: params.near.longitude } : {}),
      ...(params.photos ? { photos: 1 } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.offset ? { offset: params.offset } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(featured ? { featured: 1 } : {}),
    },
    signal,
  });
  const data = response.data ?? {};
  const outsideServiceArea = data.outsideServiceArea === true;
  const rawItems: Establishment[] = outsideServiceArea || !Array.isArray(data.items) ? [] : data.items;
  const results: EstablishmentResults = {
    items: rawItems.filter(
      (item) =>
        isPabiliEstablishment(item) &&
        doesEstablishmentMatchCategory(item, params.categoryId, params.categoryName)
    ),
    google: data.google === 'ok' ? 'ok' : 'unavailable',
    hasMore: !outsideServiceArea && data.hasMore === true,
    outsideServiceArea,
  };
  // Every successful nearby answer refreshes the cache, whoever asked for it.
  if (!params.q) nearbyCache.set(key, { at: Date.now(), results });
  return results;
}

/**
 * The nearby (or category) list kept for these params, if younger than
 * `maxAgeMs`; pass Infinity for whatever is kept. No query searches: those are
 * never cached. Lets a list show its last answer on the first frame and
 * refresh behind it (2026-10-14), instead of a skeleton on every visit.
 */
export function getCachedEstablishments(
  params: {
    near?: { latitude: number; longitude: number } | null;
    photos?: boolean;
    categoryId?: number | null;
    offset?: number;
    limit?: number;
    featured?: boolean;
  },
  maxAgeMs: number
): EstablishmentResults | null {
  if (params.near && !isWithinTacurongServiceArea(params.near)) return null;
  const page = params.offset || params.limit ? `:${params.offset ?? 0}:${params.limit ?? ''}` : '';
  const key = `${nearbyKey(params.near, Boolean(params.photos), params.categoryId, Boolean(params.featured))}${page}`;
  const cached = nearbyCache.get(key);
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.results;
  return null;
}

/** The Popular Stores screen's sort settings; the server orders the same set each way. */
export type PopularSort = 'recommended' | 'rating' | 'distance' | 'reviews';

export interface PopularResults extends EstablishmentResults {
  /** Another page follows. False from servers before 2026-10-10, which sent one page of six. */
  hasMore: boolean;
}

/**
 * GET /places/establishments/popular: the Home tab's "Popular Stores", shops
 * Google considers popular near `near`, best rated first (server
 * lib/places/storeRanking.ts rankByRating), a page at a time. Kept with the
 * nearby list's cache, under its own key, so the Popular Stores screen opened
 * from Home shows the same first page without asking again.
 */
export async function fetchPopularEstablishments(
  params: {
    near?: { latitude: number; longitude: number } | null;
    photos?: boolean;
    categoryId?: number | null;
    categoryName?: string | null;
    offset?: number;
    limit?: number;
    sort?: PopularSort;
  },
  signal?: AbortSignal,
  options: { maxAgeMs?: number } = {}
): Promise<PopularResults> {
  if (params.near && !isWithinTacurongServiceArea(params.near)) {
    return {
      items: [],
      google: 'ok',
      hasMore: false,
      outsideServiceArea: true,
    };
  }

  const offset = params.offset ?? 0;
  const sort = params.sort ?? 'recommended';
  const page = offset === 0 && !params.limit && sort === 'recommended' ? '' : `:${sort}:${offset}:${params.limit ?? ''}`;
  const key = `popular:${nearbyKey(params.near, Boolean(params.photos), params.categoryId)}${page}`;
  const cached = options.maxAgeMs ? nearbyCache.get(key) : undefined;
  if (cached && Date.now() - cached.at < options.maxAgeMs!) return cached.results as PopularResults;

  const response = await apiClient.get('/places/establishments/popular', {
    params: {
      ...(params.near ? { lat: params.near.latitude, lng: params.near.longitude } : {}),
      ...(params.photos ? { photos: 1 } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(offset > 0 ? { offset } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(sort !== 'recommended' ? { sort } : {}),
    },
    signal,
  });
  const data = response.data ?? {};
  const outsideServiceArea = data.outsideServiceArea === true;
  const rawPopItems: Establishment[] = outsideServiceArea || !Array.isArray(data.items) ? [] : data.items;
  const results: PopularResults = {
    items: rawPopItems.filter(
      (item) =>
        isPabiliEstablishment(item) &&
        doesEstablishmentMatchCategory(item, params.categoryId, params.categoryName)
    ),
    google: data.google === 'ok' ? 'ok' : 'unavailable',
    hasMore: !outsideServiceArea && data.hasMore === true,
    outsideServiceArea,
  };
  nearbyCache.set(key, { at: Date.now(), results });
  return results;
}

export function getCachedPopularEstablishments(
  params: {
    near?: { latitude: number; longitude: number } | null;
    photos?: boolean;
    categoryId?: number | null;
    offset?: number;
    limit?: number;
    sort?: PopularSort;
  },
  maxAgeMs: number
): PopularResults | null {
  const offset = params.offset ?? 0;
  const sort = params.sort ?? 'recommended';
  const page = offset === 0 && !params.limit && sort === 'recommended' ? '' : `:${sort}:${offset}:${params.limit ?? ''}`;
  const key = `popular:${nearbyKey(params.near, Boolean(params.photos), params.categoryId)}${page}`;
  const cached = nearbyCache.get(key);
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.results as PopularResults;
  return null;
}

/** A stop of a past errand, as the customer's errand list sends it (an `errand_pinpoints` row). */
export interface PastErrandStop {
  storeName?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  placeId?: string | null;
  categoryId?: number | null;
  /** The category's name, where the payload flattened it (attachErrandNames). */
  storeCategory?: string | null;
  category?: { name?: string | null } | null;
}

/** Two stops this close with the same name are one shop: a re-pinned stop, or Google's copy of it. */
const SAME_STORE_METERS = 60;

/**
 * Normalizes a store name the same way the server's `normalizeStoreName` does:
 * strips comma-attached address suffixes, punctuation, and "Tacurong" /
 * "Tacurong City" / "Sultan Kudarat" branch suffixes so a Google Popular Store
 * ("Mercury Drug - Tacurong City") and a verified Catalogue Store ("Mercury Drug")
 * at the same spot match each other.
 */
function normalizeStoreNameForMatch(raw: string): string {
  const base = String(raw ?? '')
    .toLowerCase()
    .split(',')[0]
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stripped = base
    .replace(/\b(tacurong( city)?|sultan kudarat)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || base;
}

/** The same shop: the same name, ignoring case, punctuation and city suffix, in the same spot. */
export function isSameStore(
  a: Pick<Establishment, 'name' | 'latitude' | 'longitude'>,
  b: Pick<Establishment, 'name' | 'latitude' | 'longitude'>
): boolean {
  const nameA = normalizeStoreNameForMatch(a.name);
  const nameB = normalizeStoreNameForMatch(b.name);
  return nameA.length > 0 && nameA === nameB && haversineDistanceKm(a, b) * 1000 <= SAME_STORE_METERS;
}

/**
 * "Order again" (2026-10-10): a past errand's stops as stores the store search
 * opens with, already picked. The stops carry the shop's name, where it is,
 * its category and its Location Stores row, so nothing is searched again.
 *
 * A Location Store gets the key the server gives it, so the nearby list does
 * not list it a second time; any other stop is matched to the list by
 * isSameStore. Stops with no name or no position are left out, a shop pinned
 * twice counts once, and at most `limit` come back (one errand's three).
 */
export function establishmentsFromStops(
  stops: PastErrandStop[] | null | undefined,
  limit = 3
): Establishment[] {
  const stores: Establishment[] = [];
  for (const stop of Array.isArray(stops) ? stops : []) {
    if (stores.length >= limit) break;
    const name = String(stop?.storeName ?? '').trim();
    const latitude = Number(stop?.latitude);
    const longitude = Number(stop?.longitude);
    if (!name || stop?.latitude == null || stop?.longitude == null) continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (stores.some((store) => isSameStore(store, { name, latitude, longitude }))) continue;
    const placeId = stop.placeId ?? null;
    const store: Establishment = {
      key: placeId ? `catalogue:${placeId}` : `past:${stores.length}:${name}`,
      source: placeId ? 'catalogue' : 'google',
      name,
      address: '',
      latitude,
      longitude,
      placeId,
      googlePlaceId: null,
      categoryId: stop.categoryId ?? null,
      categoryName: stop.storeCategory ?? stop.category?.name ?? null,
      distanceMeters: null,
    };
    if (!isPabiliEstablishment(store)) continue;
    stores.push(store);
  }
  return stores;
}

/** Tests only: each test starts with no remembered nearby list. */
export function clearNearbyEstablishmentCache(): void {
  nearbyCache.clear();
}
