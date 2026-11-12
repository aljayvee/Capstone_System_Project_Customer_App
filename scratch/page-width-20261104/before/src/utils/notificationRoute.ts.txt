import type { CustomerNotification } from '../context/NotificationContext';
import { categoryOf, errandIdOf } from './notificationCategory';

/**
 * Where a notification takes the customer, decided once for both the list
 * and a tapped push (CustomerPortalScreen.handlePushTapped). The two used to
 * disagree: the list opened the track tab for most rows, a push opened the
 * chat for anything with an errand.
 *
 * - A chat, or "a dispatcher is handling your errand": the conversation.
 * - Delivery (on the way, almost there, held, minutes away): the live map,
 *   on that errand.
 * - Everything else about an order or its money (rider on the errand,
 *   delivered, cancelled, declined, fee, payment): the errand's details.
 * - No errand on the row (written before rows carried one): nowhere; the tap
 *   still marks it read.
 */
export type NotificationRoute =
  | { kind: 'chat'; errandId: string }
  | { kind: 'track'; errandId: string }
  | { kind: 'details'; errandId: string }
  | { kind: 'none' };

export function routeForNotification(
  n: Pick<CustomerNotification, 'type' | 'category' | 'errandId' | 'refKey'>
): NotificationRoute {
  const errandId = errandIdOf(n);
  if (!errandId) return { kind: 'none' };

  const type = String(n.type || '').toUpperCase();
  const category = categoryOf(n);
  if (category === 'CHAT' || type === 'ERRAND_ACCEPTED') return { kind: 'chat', errandId };
  if (category === 'DELIVERY') return { kind: 'track', errandId };
  return { kind: 'details', errandId };
}
