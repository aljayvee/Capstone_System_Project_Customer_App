import { formatErrandId } from './formatErrandId';

/**
 * Extracts and formats the merchant store categories picked by the customer.
 * Prioritizes itemized store categories, pinpoint categories, custom metadata,
 * and description tags, replacing the generic "Pabili" label with the specific
 * categories picked by the customer.
 */
export function extractMerchantCategories(
  errand?: any,
  meta?: any,
  fallbackToId: boolean = false
): string {
  if (!errand && !meta) {
    return 'Merchant Categories';
  }

  // 1. Check meta categories from Firebase (stored during order submission)
  const metaCats = meta?.categories || meta?.order?.categories || meta?.merchantCategories;
  if (Array.isArray(metaCats) && metaCats.length > 0) {
    const valid = metaCats
      .map((c: any) => String(c || '').trim())
      .filter((c: string) => Boolean(c) && c.toLowerCase() !== 'pabili' && c.toLowerCase() !== 'general items');
    if (valid.length > 0) return Array.from(new Set(valid)).join(', ');
  } else if (typeof metaCats === 'string' && metaCats.trim()) {
    const trimmed = metaCats.trim();
    if (trimmed.toLowerCase() !== 'pabili' && trimmed.toLowerCase() !== 'general items') {
      return trimmed;
    }
  }

  // 2. Check errand.categories (array or string)
  const errandCats = errand?.categories;
  if (Array.isArray(errandCats) && errandCats.length > 0) {
    const valid = errandCats
      .map((c: any) => String(c || '').trim())
      .filter((c: string) => Boolean(c) && c.toLowerCase() !== 'pabili' && c.toLowerCase() !== 'general items');
    if (valid.length > 0) return Array.from(new Set(valid)).join(', ');
  } else if (typeof errandCats === 'string' && errandCats.trim()) {
    const trimmed = errandCats.trim();
    if (trimmed.toLowerCase() !== 'pabili' && trimmed.toLowerCase() !== 'general items') {
      return trimmed;
    }
  }

  // 3. Extract distinct storeCategory from pabiliDetails items
  if (Array.isArray(errand?.pabiliDetails) && errand.pabiliDetails.length > 0) {
    const cats = Array.from(
      new Set(
        errand.pabiliDetails
          .map((item: any) => String(item?.storeCategory || '').trim())
          .filter((c: string) => Boolean(c) && c.toLowerCase() !== 'pabili' && c.toLowerCase() !== 'general items')
      )
    );
    if (cats.length > 0) return cats.join(', ');
  }

  // 4. Extract distinct storeCategory from pinpoints
  if (Array.isArray(errand?.pinpoints) && errand.pinpoints.length > 0) {
    const cats = Array.from(
      new Set(
        errand.pinpoints
          .map((pin: any) => String(pin?.storeCategory || pin?.category?.name || pin?.storeName || '').trim())
          .filter((c: string) => Boolean(c) && c.toLowerCase() !== 'pabili')
      )
    );
    if (cats.length > 0) return cats.join(', ');
  }

  // 5. Extract from description (e.g., "Pabili Store Categories: Food & Restaurant, Pharmacy")
  if (errand?.description && typeof errand.description === 'string') {
    const match = errand.description.match(/Store Categories:\s*([^,\n]+(?:,\s*[^,\n]+)*)/i);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
  }

  // 6. Extract from pickupAddress if stored as category list
  if (errand?.pickupAddress && typeof errand.pickupAddress === 'string') {
    const trimmed = errand.pickupAddress.trim();
    if (
      trimmed &&
      trimmed.toLowerCase() !== 'pabili' &&
      !trimmed.toLowerCase().includes('http') &&
      !trimmed.toLowerCase().includes('poblacion') &&
      !trimmed.toLowerCase().includes('tacurong')
    ) {
      return trimmed;
    }
  }

  // 7. Check errand.category if it is a specific merchant category (e.g. "Food & Restaurant")
  if (errand?.category && String(errand.category).trim().toLowerCase() !== 'pabili') {
    return String(errand.category).trim();
  }

  if (fallbackToId && errand?.id) {
    return `Merchant Categories ${formatErrandId(errand.id)}`;
  }

  return 'Merchant Categories';
}
