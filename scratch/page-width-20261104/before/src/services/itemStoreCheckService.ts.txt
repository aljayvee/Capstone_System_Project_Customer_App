import { apiClient } from './apiClient';

export interface UsualStore {
  /** The kind of store that usually sells it, or null when the model could not say. */
  usualStore: string | null;
  /** True only when the model is well above its threshold. Only these are acted on. */
  strong: boolean;
}

/**
 * Which kind of store usually sells each item. POST /errands/item-stores.
 *
 * Index-aligned with `names`. Null when the server could not be asked (offline,
 * rate-limited, or a server without the route): the list then simply goes
 * unchecked, which is how every list went before this existed.
 */
export async function checkItemStores(names: string[]): Promise<UsualStore[] | null> {
  if (names.length === 0) return [];
  try {
    const response = await apiClient.post('/errands/item-stores', { names: names.map((n) => n.slice(0, 120)) }, { timeout: 8000 });
    const results = response.data?.results;
    if (!Array.isArray(results) || results.length !== names.length) return null;
    return results.map((r: { category?: string | null; strong?: boolean }) => ({
      usualStore: r?.category ? String(r.category) : null,
      strong: Boolean(r?.strong),
    }));
  } catch {
    return null;
  }
}
