import { ref, update } from 'firebase/database';
import { database } from '../firebase/config';
import { saveCustomerLocation } from '../firebase/location';
import { apiClient } from './apiClient';
import { postOrderSubmitted, type OrderSummaryItem } from './chatSystemMessages';
import { allRows, type PabiliDraft, type PickedStore } from './pabiliDraft';
import type { DeliveryLocation } from '../hooks/useDefaultDeliveryLocation';

/** Every listed row, as the order's items. Pure, so the payload is tested without a network. */
export function draftItems(draft: PabiliDraft): OrderSummaryItem[] {
  return allRows(draft).map(({ category, row }) => ({
    storeCategory: category,
    itemName: row.name.trim(),
    quantity: row.quantity,
    size: row.size,
    notes: row.notes ?? null,
  }));
}

/** The errand's description and pickup columns: VARCHAR(191) on the server. */
const SHORT_TEXT_MAX = 191;

/** The stores picked in step 1's "Location" list, in visit order. Empty in merchant mode. */
export function pickedStores(draft: PabiliDraft): PickedStore[] {
  if (draft.mode !== 'location' || !draft.stores) return [];
  return draft.categories.map((key) => draft.stores![key]).filter((s): s is PickedStore => Boolean(s));
}

/** The POST /errands body for a draft, delivered to `location`. */
export function buildErrandPayload(draft: PabiliDraft, location: DeliveryLocation, customerId: string | number) {
  const categories = draft.categories;
  const stores = pickedStores(draft);
  // A real store reaches the server as a pin (`stores`), and its items name it
  // by position and carry its category, which the handling fee is decided from.
  const storeIndexOf = (key: string) => {
    const index = stores.findIndex((s) => s.key === key);
    return index >= 0 ? index : undefined;
  };
  return {
    customerId,
    category: 'Pabili',
    description: (stores.length > 0
      ? `Pabili Stores: ${stores.map((s) => s.name).join(', ')}`
      : `Pabili Store Categories: ${categories.join(', ')}`
    ).slice(0, SHORT_TEXT_MAX),
    pickupAddress: (stores.length > 0 ? stores.map((s) => s.name) : categories).join(', ').slice(0, SHORT_TEXT_MAX),
    deliveryAddress: location.address,
    deliveryLatitude: location.latitude,
    deliveryLongitude: location.longitude,
    // Copied onto the errand so the rider sees them at the door, even if the
    // customer edits this saved place afterwards.
    deliveryStreetName: location.streetName,
    deliveryLandmark: location.landmark,
    deliveryNotes: location.notes,
    estimatedCost: 0,
    tip: 0,
    storeCount: categories.length,
    ...(stores.length > 0
      ? {
          stores: stores.map((s) => ({
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
            placeId: s.placeId,
            categoryId: s.categoryId,
          })),
        }
      : {}),
    pabiliItems: draftItems(draft).map((item) => ({
      itemName: item.itemName,
      ...(storeIndexOf(item.storeCategory) !== undefined
        ? {
            // undefined, not null: a store the server could not classify has no
            // category, and the server's schema takes a string or nothing.
            storeCategory: draft.stores?.[item.storeCategory]?.categoryName ?? undefined,
            storeIndex: storeIndexOf(item.storeCategory),
          }
        : { storeCategory: item.storeCategory }),
      quantity: item.quantity,
      // Always sent apart from the name. The server folds it into the name
      // itself while rider phones still run a build that cannot show it
      // (ITEM_SIZE_STORAGE=fold), so this app never has to know.
      size: item.size ?? null,
      notes: item.notes ?? null,
      unitPrice: 0,
      estimatedSubtotal: 0,
    })),
  };
}

/**
 * Creates the errand and opens its chat with the order.
 *
 * Only the POST can fail the send. The chat line and the chat's metadata
 * narrate an errand that already exists, so they are awaited (to land before
 * the customer reaches the chat) but never allowed to throw.
 */
export async function submitPabili(
  draft: PabiliDraft,
  location: DeliveryLocation,
  userId: string | number
): Promise<string> {
  try {
    await saveCustomerLocation(userId, location.latitude, location.longitude, location.address);
  } catch (e) {
    console.warn('[Firebase RTDB] Location write warning:', e);
  }

  const response = await apiClient.post('/errands', buildErrandPayload(draft, location, userId));
  const created = response.data;
  const errandId = String(created?.id ?? `PABILI-${Date.now().toString().slice(-6)}`);

  // The chat used to start empty, so a dispatcher opening it saw nothing and
  // the customer had no visible record of what they had just asked for.
  await postOrderSubmitted(errandId, {
    items: draftItems(draft),
    deliveryAddress: location.address,
    categories: draft.categories,
    deliveryFee: Number(created?.deliveryFee ?? 0),
  });

  try {
    await update(ref(database, `chats/${errandId}/meta`), {
      categories: draft.categories,
      merchantCategories: draft.categories.join(', '),
      updatedAt: Date.now(),
    });
  } catch {
    // Metadata for the chat list. The errand is already created.
  }

  return errandId;
}
