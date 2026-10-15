import { Package, Pill, ShoppingBag, ShoppingCart, Store, Utensils } from 'lucide-react-native';
import { storeKind, type StoreKind } from '../utils/storeFit';

/**
 * A quick-add chip: the item and, apart from it, how big one is.
 *
 * These were single strings ("Rice (5kg)") until the size got its own column.
 * Split here, a chip goes onto the list already clean and never through the
 * typed-line rules, and the rider reads "Rice · 5 kg".
 */
export interface QuickSuggestion {
  name: string;
  size?: string;
}

const GROCERY: QuickSuggestion[] = [
  { name: 'Rice', size: '5 kg' },
  { name: 'Fresh Milk', size: '1 L' },
  { name: 'Eggs', size: '1 tray' },
  { name: 'Cooking Oil', size: '1 L' },
  { name: 'Refined Sugar', size: '1 kg' },
  { name: 'Canned Goods' },
];

const PHARMACY: QuickSuggestion[] = [
  { name: 'Paracetamol', size: '500 mg' },
  { name: '70% Isopropyl Alcohol', size: '500 mL' },
  { name: 'Vitamin C', size: '500 mg' },
  { name: 'Face Masks', size: '1 box' },
  { name: 'Bandage Strips' },
];

const BAKERY: QuickSuggestion[] = [
  { name: 'Pandesal', size: '10 pcs' },
  { name: 'Sliced Loaf Bread' },
  { name: 'Spanish Bread' },
  { name: 'Butter Toast' },
  { name: 'Ensaymada' },
];

const FOOD: QuickSuggestion[] = [
  { name: 'Burger & Fries Meal' },
  { name: 'Fried Chicken', size: '2 pcs' },
  { name: 'Rice Meal' },
  { name: 'Iced Beverage' },
  { name: 'Pancit / Noodles' },
];

const RETAIL: QuickSuggestion[] = [
  { name: 'Bond Paper', size: '1 ream' },
  { name: 'Ballpen Set' },
  { name: 'AA Batteries', size: '4 pcs' },
  { name: 'Notebooks' },
  { name: 'Disinfectant Wipes' },
];

const CONVENIENCE: QuickSuggestion[] = [
  { name: 'Bottled Water', size: '500 mL' },
  { name: 'Coke', size: '1.5 L' },
  { name: 'Instant Noodles' },
  { name: 'Bread', size: '1 loaf' },
  { name: 'Load Card' },
];

const BY_KIND: Partial<Record<StoreKind, QuickSuggestion[]>> = {
  grocery: GROCERY,
  convenience: CONVENIENCE,
  pharmacy: PHARMACY,
  bakery: BAKERY,
  food: FOOD,
  retail: RETAIL,
};

/**
 * Chips for a store, by the kind of store its name says it is.
 *
 * These used to be keyed by exact seeded names ("Bakery & Snacks", "Fast
 * Food & Restaurant"), and production's categories are named otherwise
 * ("Bread & Pastry", "Fast Food", "Restaurant", "Convenience Store"), so most
 * stores showed no chips. Owners can rename categories at any time; the kind
 * survives a rename.
 */
export function quickSuggestionsFor(category: string): QuickSuggestion[] {
  return BY_KIND[storeKind(category)] ?? [];
}

export function getCategoryIcon(category?: string) {
  const lower = String(category || '').toLowerCase();
  if (lower.includes('pharmacy') || lower.includes('health') || lower.includes('drug') || lower.includes('med')) return Pill;
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('dining') || lower.includes('eatery')) return Utensils;
  if (lower.includes('supermarket') || lower.includes('grocery') || lower.includes('market') || lower.includes('mart')) return ShoppingBag;
  if (lower.includes('bakery') || lower.includes('bread') || lower.includes('cake')) return Store;
  if (lower.includes('retail') || lower.includes('general') || lower.includes('hardware') || lower.includes('supplies')) return Package;
  return ShoppingCart;
}
