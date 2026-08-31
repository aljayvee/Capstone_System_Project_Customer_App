import { useEffect, useState } from 'react';
import {
  fetchCategoryImageDataUri,
  clearCachedCategoryImage,
  BackendMerchantCategory,
} from '../services/merchantCategories';

/**
 * Resolves the owner-set photos (`store_cat_image`) for a list of merchant
 * categories into `{ [categoryId]: dataUri }`.
 *
 * Only categories the server says actually have a photo are fetched — the
 * category list carries `image` metadata precisely so the client can skip the
 * round trip for the rest. Each fetch is independently cached in AsyncStorage
 * by the photo's `updatedAt`, so in steady state this hook resolves from disk
 * without touching the network.
 *
 * Failures resolve to "absent" rather than to an error state: every consumer
 * has a built-in fallback image, and a category whose photo will not load must
 * still render a tile.
 */
export function useCategoryImages(categories: BackendMerchantCategory[]): Record<number, string> {
  const [imageMap, setImageMap] = useState<Record<number, string>>({});

  // A stable, content-derived key. Re-running on the array identity alone would
  // re-fetch on every parent render; this only changes when a photo is added,
  // replaced, or removed.
  const signature = categories
    .map((c) => `${c.id ?? c.name}:${c.image?.updatedAt ?? ''}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    const withImages = categories.filter(
      (c): c is BackendMerchantCategory & { id: number } =>
        typeof c.id === 'number' && Boolean(c.image?.updatedAt)
    );

    // Categories that lost their photo must not keep showing a stale one from
    // an earlier render, and their cache entry is now dead weight on disk.
    const withoutImages = categories.filter(
      (c): c is BackendMerchantCategory & { id: number } =>
        typeof c.id === 'number' && !c.image?.updatedAt
    );
    if (withoutImages.length > 0) {
      setImageMap((prev) => {
        const next = { ...prev };
        let changed = false;
        withoutImages.forEach((c) => {
          if (next[c.id] !== undefined) {
            delete next[c.id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      withoutImages.forEach((c) => void clearCachedCategoryImage(c.id));
    }

    if (withImages.length === 0) return;

    Promise.all(
      withImages.map(async (category) => {
        const uri = await fetchCategoryImageDataUri(category.id, category.image!.updatedAt);
        return uri ? ([category.id, uri] as const) : null;
      })
    ).then((results) => {
      if (cancelled) return;

      const resolved = results.filter((r): r is readonly [number, string] => r !== null);
      if (resolved.length === 0) return;

      setImageMap((prev) => {
        const next = { ...prev };
        resolved.forEach(([id, uri]) => {
          next[id] = uri;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // `categories` is intentionally excluded: `signature` is its content-stable
    // projection, and depending on the array identity would loop on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return imageMap;
}
