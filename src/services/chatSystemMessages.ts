import { push, ref } from 'firebase/database';
import { database } from '../firebase/config';

/**
 * Automated messages that narrate an errand's progress inside its chat.
 *
 * The chat used to begin empty and stay silent until a human typed. Everything
 * that actually happened to the request — submitted, picked up for review,
 * accepted, declined — occurred somewhere else, so the customer watched a
 * spinner while the conversation that was supposedly about their errand
 * contained no mention of it.
 *
 * These messages make the chat the record. A customer scrolling back can see
 * what they asked for, when someone looked at it, who took it on, and why it
 * ended if it did — without having to have been watching at the time.
 *
 * Written from the client rather than the server because this project keeps
 * chat entirely in Firebase RTDB and the server has no Firebase SDK; every
 * existing message is written by whichever client performed the action, and
 * these follow the same rule. The durable record of a decline lives in
 * `errand_decline_reasons` on the server regardless, so a failed chat write
 * loses the announcement, never the fact.
 */

/** Distinguishes automated messages from anything a person typed. */
export type SystemMessageKind =
  | 'order_submitted'
  | 'under_review'
  | 'accepted'
  | 'declined';

export interface OrderSummaryItem {
  storeCategory: string;
  itemName: string;
  quantity: number;
}

interface SystemMessageBase {
  senderId: 'system';
  senderName: 'Sugo';
  role: 'system';
  type: 'system';
  systemKind: SystemMessageKind;
  text: string;
  timestamp: number;
}

async function postSystemMessage(
  errandId: string,
  message: Omit<SystemMessageBase, 'senderId' | 'senderName' | 'role' | 'type' | 'timestamp'> &
    Record<string, unknown>
): Promise<void> {
  try {
    await push(ref(database, `chats/${errandId}/messages`), {
      senderId: 'system',
      senderName: 'Sugo',
      role: 'system',
      type: 'system',
      timestamp: Date.now(),
      ...message,
    });
  } catch (err) {
    // Never surfaced to the customer and never rethrown. These messages narrate
    // an action that has already succeeded on the server; failing the action
    // because its announcement could not be written would be strictly worse
    // than a chat that is missing one line.
    console.warn(`[chatSystemMessages] Could not post ${message.systemKind}:`, err);
  }
}

/**
 * The structured order, posted the moment the customer sends it.
 *
 * Carries the items as data as well as text so the chat can render a proper
 * receipt card, and so the dispatcher opening the conversation sees exactly
 * what was requested without switching to another panel. The text is written to
 * stand alone, because any client that does not know the `system` type still
 * renders `text` and must remain readable.
 */
export function postOrderSubmitted(
  errandId: string,
  params: {
    items: OrderSummaryItem[];
    deliveryAddress: string;
    categories: string[];
    deliveryFee: number;
  }
): Promise<void> {
  const { items, deliveryAddress, categories, deliveryFee } = params;
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

  const lines = items.map((i) => `• ${i.quantity} × ${i.itemName}  (${i.storeCategory})`);
  const text = [
    'ERRAND REQUEST',
    '',
    `Stores: ${categories.join(', ') || 'Pabili'}`,
    `Deliver to: ${deliveryAddress}`,
    '',
    `Items (${totalUnits}):`,
    ...lines,
    '',
    `Delivery fee so far: ₱${Number(deliveryFee || 0).toFixed(2)}`,
    'Waiting for a dispatcher to review this request.',
  ].join('\n');

  return postSystemMessage(errandId, {
    systemKind: 'order_submitted',
    text,
    order: { items, deliveryAddress, categories, deliveryFee, totalUnits },
  });
}

/** Posted when a dispatcher opens the request to look at it. */
export function postUnderReview(errandId: string, dispatcherName?: string): Promise<void> {
  return postSystemMessage(errandId, {
    systemKind: 'under_review',
    text: dispatcherName
      ? `${dispatcherName} is reviewing your request now — checking the stores and working out the fee.`
      : 'A dispatcher is reviewing your request now — checking the stores and working out the fee.',
    dispatcherName: dispatcherName || null,
  });
}

/** Posted when a dispatcher accepts. Written in the dispatcher's own voice,
 *  because from here on the customer is talking to a person, not a system. */
export function postAccepted(errandId: string, dispatcherName: string): Promise<void> {
  return postSystemMessage(errandId, {
    systemKind: 'accepted',
    text:
      `Hi! I'm ${dispatcherName}, your dispatcher. I've reviewed your order and it's good to go. ` +
      `I'll confirm what's available at the store and the final total before anything is bought, ` +
      `then assign a rider. Message me here if you need to change anything.`,
    dispatcherName,
  });
}

/** Posted when a dispatcher declines, carrying the reason. */
export function postDeclined(
  errandId: string,
  reason: string,
  dispatcherName?: string
): Promise<void> {
  return postSystemMessage(errandId, {
    systemKind: 'declined',
    text:
      `This errand was cancelled by ${dispatcherName || 'the dispatcher'}.\n\n` +
      `Reason: ${reason}\n\n` +
      `Nothing has been charged. You can place a new errand any time.`,
    reason,
    dispatcherName: dispatcherName || null,
  });
}
