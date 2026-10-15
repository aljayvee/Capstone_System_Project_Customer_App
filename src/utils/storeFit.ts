/**
 * Whether an item listed under one store is plausibly bought there.
 *
 * The server's item model says which kind of store usually sells an item. A
 * different answer is not always a mistake: a supermarket also sells bread and
 * household goods, and a drugstore sells toiletries. Asking "Are you sure?"
 * about those would teach customers to ignore the question, so only a store
 * that does not stock that kind of thing at all is questioned.
 *
 * Kinds are read from the category name by keyword, the same way the store
 * icons are (constants/pabili.ts), because owners can rename categories. A
 * category no keyword recognises is never questioned: there is no basis to.
 */

export type StoreKind = 'grocery' | 'convenience' | 'pharmacy' | 'food' | 'bakery' | 'retail' | 'other';

/**
 * Production's categories on 2026-10-06: Fast Food, Restaurant, Pharmacy,
 * Supermarket & Grocery, Convenience Store, Retail & General Merchandise,
 * Bread & Pastry. The seed names ("Pharmacy & Health", "Bakery & Snacks")
 * read the same.
 */
export function storeKind(category: string): StoreKind {
  const lower = String(category || '').toLowerCase();
  if (/pharma|health|drug|medic/.test(lower)) return 'pharmacy';
  if (/bake|bread|pastr|cake/.test(lower)) return 'bakery';
  if (/convenience|sari|7-?eleven/.test(lower)) return 'convenience';
  if (/food|restaurant|dining|eatery/.test(lower)) return 'food';
  if (/supermarket|grocer|market|mart/.test(lower)) return 'grocery';
  if (/retail|general|hardware|merchandise|supplies/.test(lower)) return 'retail';
  return 'other';
}

/**
 * Kinds of store that also stock another kind's items. A supermarket has a
 * bakery, household goods and everything a convenience store sells; a
 * drugstore sells toiletries and drinks; a convenience store sells bread,
 * snacks and toiletries.
 */
const ALSO_STOCKS: Record<StoreKind, StoreKind[]> = {
  grocery: ['bakery', 'retail', 'convenience'],
  convenience: ['grocery', 'bakery', 'retail'],
  pharmacy: ['retail', 'convenience'],
  // Production's item model files siopao, Delight and bottled drinks under
  // Convenience Store (Siopao 0.98, strong), yet Chowking and every bakery
  // sell them. Asked "Are you sure?" about those, customers learn to ignore
  // the question; a load card at Jollibee going unasked is the smaller loss,
  // and the dispatcher still reads the list.
  food: ['convenience'],
  bakery: ['convenience'],
  retail: [],
  other: [],
};

/** True when `item`, usually sold at `usualStore`, is unlikely to be found at `listedStore`. */
export function isStoreMismatch(listedStore: string, usualStore: string): boolean {
  if (listedStore.trim().toLowerCase() === usualStore.trim().toLowerCase()) return false;
  const listed = storeKind(listedStore);
  const usual = storeKind(usualStore);
  if (listed === 'other' || usual === 'other' || listed === usual) return false;
  return !ALSO_STOCKS[listed].includes(usual);
}
