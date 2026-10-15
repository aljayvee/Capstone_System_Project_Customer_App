import { useCallback, useMemo, useState } from 'react';
import { isSameStore, type Establishment } from '../services/establishments';
import { showAppAlert } from '../services/alertModal';

/** One errand, at most this many stores: the rider visits them in one trip. */
export const MAX_PICKED_STORES = 3;

export function matchesPickedStore(a: Establishment, b: Establishment): boolean {
  if (a.key === b.key) return true;
  if (a.placeId && b.placeId && a.placeId === b.placeId) return true;
  if (a.googlePlaceId && b.googlePlaceId && a.googlePlaceId === b.googlePlaceId) return true;
  return isSameStore(a, b);
}

export function withCataloguePlaceId(store: Establishment, pool: Establishment[]): Establishment {
  if (store.placeId) return store;
  const match = pool.find((candidate) => candidate.placeId && matchesPickedStore(candidate, store));
  if (!match) return store;
  return {
    ...store,
    placeId: match.placeId,
    categoryId: store.categoryId ?? match.categoryId,
    categoryName: store.categoryName ?? match.categoryName,
  };
}

/**
 * The stores picked on Find stores, Popular Stores, Nearby Stores, or a
 * Merchant Category's screen: a tap picks a store or unpicks it, and a fourth
 * is refused with the reason, in an alert and in `limitError` for the screen
 * to show inline. Deduplicates across `google:<placeId>` and `catalogue:<uuid>`
 * using `isSameStore` and preserves verified `placeId` when a catalogue match exists.
 */
export function useStorePicks(initial: Establishment[] = [], cataloguePool: Establishment[] = []) {
  const [rawPicked, setRawPicked] = useState<Establishment[]>(() => initial.slice(0, MAX_PICKED_STORES));
  const [limitError, setLimitError] = useState<string | null>(null);

  const picked = useMemo(
    () => rawPicked.map((s) => withCataloguePlaceId(s, cataloguePool)),
    [rawPicked, cataloguePool]
  );

  // Decided outside a state updater: the alert must show once, and React may
  // run an updater twice.
  const toggle = useCallback(
    (store: Establishment) => {
      setLimitError(null);
      const existing = picked.find((s) => matchesPickedStore(s, store));
      if (existing) {
        setRawPicked(rawPicked.filter((s) => !matchesPickedStore(withCataloguePlaceId(s, cataloguePool), store)));
        return;
      }
      if (store.isOpen === false) {
        return;
      }
      if (picked.length >= MAX_PICKED_STORES) {
        const message = `You can pick up to ${MAX_PICKED_STORES} stores for a single errand.`;
        setLimitError(message);
        showAppAlert({ title: `Store Limit (Max ${MAX_PICKED_STORES})`, message, variant: 'warning' });
        return;
      }
      const merged = withCataloguePlaceId(store, cataloguePool);
      setRawPicked([...rawPicked, merged]);
    },
    [picked, rawPicked, cataloguePool]
  );

  const isPicked = useCallback(
    (storeOrKey: string | Establishment) => {
      if (typeof storeOrKey === 'string') {
        if (picked.some((s) => s.key === storeOrKey)) return true;
        const candidate = cataloguePool.find((c) => c.key === storeOrKey);
        return candidate ? picked.some((s) => matchesPickedStore(s, candidate)) : false;
      }
      return picked.some((s) => matchesPickedStore(s, storeOrKey));
    },
    [picked, cataloguePool]
  );

  return { picked, toggle, isPicked, limitError };
}
