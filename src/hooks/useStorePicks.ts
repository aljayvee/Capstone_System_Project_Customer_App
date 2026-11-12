import { useCallback, useMemo, useState } from 'react';
import { isSameStore, type Establishment } from '../services/establishments';
import { showAppAlert } from '../services/alertModal';
import { getStoresAllowed, useStoresAllowed } from '../services/storeLimit';

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
 * Merchant Category's screen: a tap picks a store or unpicks it, and one past
 * the owner's store limit (services/storeLimit.ts) is refused with the reason, in an alert and in `limitError` for the screen
 * to show inline. Deduplicates across `google:<placeId>` and `catalogue:<uuid>`
 * using `isSameStore` and preserves verified `placeId` when a catalogue match exists.
 */
export function useStorePicks(initial: Establishment[] = [], cataloguePool: Establishment[] = []) {
  const maxStores = useStoresAllowed();
  const [rawPicked, setRawPicked] = useState<Establishment[]>(() => initial.slice(0, getStoresAllowed()));
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
      if (picked.length >= maxStores) {
        const message = `You can pick up to ${maxStores} ${maxStores === 1 ? 'store' : 'stores'} for a single errand.`;
        setLimitError(message);
        showAppAlert({ title: `Store Limit (Max ${maxStores})`, message, variant: 'warning' });
        return;
      }
      const merged = withCataloguePlaceId(store, cataloguePool);
      setRawPicked([...rawPicked, merged]);
    },
    [picked, rawPicked, cataloguePool, maxStores]
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

  return { picked, toggle, isPicked, limitError, maxStores };
}
