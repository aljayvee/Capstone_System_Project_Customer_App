import type { CustomerNotification, NotificationCategory } from '../context/NotificationContext';

/**
 * What each notification is about, and whether it waits on the customer.
 *
 * The server sends `category` and `needsYou` on every row since 2026-10-21
 * (C:\Capstone_Server\server\src\services\notificationCatalog.ts,
 * CUSTOMER_NOTIFICATIONS). This copy of the same table is for rows written
 * before that, and for a server that has not shipped it yet. Keep the two in step.
 */
const TABLE: Record<string, { category: NotificationCategory; needsYou: boolean }> = {
  ERRAND_ACCEPTED: { category: 'ORDER', needsYou: false },
  RIDER_ASSIGNED: { category: 'ORDER', needsYou: false },
  ERRAND_DECLINED: { category: 'ORDER', needsYou: true },
  ERRAND_CANCELLED: { category: 'ORDER', needsYou: true },
  ERRAND_DELIVERED: { category: 'ORDER', needsYou: false },
  RIDER_ON_THE_WAY: { category: 'DELIVERY', needsYou: false },
  DELIVERY_HELD: { category: 'DELIVERY', needsYou: false },
  RIDER_NEARBY: { category: 'DELIVERY', needsYou: true },
  RIDER_ETA_REMINDER: { category: 'DELIVERY', needsYou: false },
  FEE_UPDATED: { category: 'PAYMENT', needsYou: true },
  PAYMENT_CONFIRMED: { category: 'PAYMENT', needsYou: false },
  EXTRA_CHARGE_RESOLVED: { category: 'PAYMENT', needsYou: false },
  PAYMENT_REFUNDED: { category: 'PAYMENT', needsYou: false },
  CHAT_MESSAGE: { category: 'CHAT', needsYou: true },
};

const CATEGORIES: NotificationCategory[] = ['ORDER', 'DELIVERY', 'PAYMENT', 'CHAT'];

export function categoryOf(n: Pick<CustomerNotification, 'type' | 'category'>): NotificationCategory {
  if (n.category && CATEGORIES.includes(n.category)) return n.category;
  const type = String(n.type || '').toUpperCase();
  if (TABLE[type]) return TABLE[type].category;
  if (type.includes('CHAT') || type.includes('MESSAGE')) return 'CHAT';
  if (type.includes('FEE') || type.includes('PAYMENT') || type.includes('REFUND')) return 'PAYMENT';
  if (type.includes('NEARBY') || type.includes('DELIVERY') || type.includes('ON_THE_WAY')) return 'DELIVERY';
  return 'ORDER';
}

/** Waits on the customer, and only while unread: once seen, it stops asking. */
export function needsYou(n: Pick<CustomerNotification, 'type' | 'needsYou' | 'isRead'>): boolean {
  if (n.isRead) return false;
  if (typeof n.needsYou === 'boolean') return n.needsYou;
  return TABLE[String(n.type || '').toUpperCase()]?.needsYou ?? false;
}

/** The errand a row opens: the server's errandId, else its `errand:<id>` refKey. */
export function errandIdOf(n: Pick<CustomerNotification, 'errandId' | 'refKey'>): string | null {
  if (n.errandId) return String(n.errandId);
  const ref = n.refKey ?? '';
  return ref.startsWith('errand:') && ref.length > 7 ? ref.slice(7) : null;
}

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  ORDER: 'Order',
  DELIVERY: 'Delivery',
  PAYMENT: 'Payment',
  CHAT: 'Chat',
};
