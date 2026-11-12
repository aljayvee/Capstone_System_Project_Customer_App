import { routeForNotification } from '../utils/notificationRoute';
import { categoryOf, errandIdOf, needsYou } from '../utils/notificationCategory';

describe('routeForNotification', () => {
  it.each([
    ['CHAT_MESSAGE', 'chat'],
    ['ERRAND_ACCEPTED', 'chat'],
    ['RIDER_ON_THE_WAY', 'track'],
    ['RIDER_NEARBY', 'track'],
    ['DELIVERY_HELD', 'track'],
    ['RIDER_ETA_REMINDER', 'track'],
    ['RIDER_ASSIGNED', 'details'],
    ['ERRAND_DELIVERED', 'details'],
    ['ERRAND_CANCELLED', 'details'],
    ['ERRAND_DECLINED', 'details'],
    ['FEE_UPDATED', 'details'],
    ['PAYMENT_CONFIRMED', 'details'],
    ['PAYMENT_REFUNDED', 'details'],
  ])('%s goes to %s', (type, kind) => {
    expect(routeForNotification({ type, errandId: 'e-1' })).toEqual({ kind, errandId: 'e-1' });
  });

  it('reads the errand from refKey when errandId is absent', () => {
    expect(routeForNotification({ type: 'ERRAND_DELIVERED', refKey: 'errand:e-7' })).toEqual({ kind: 'details', errandId: 'e-7' });
  });

  it('goes nowhere without an errand', () => {
    expect(routeForNotification({ type: 'FEE_UPDATED' })).toEqual({ kind: 'none' });
  });
});

describe('notificationCategory', () => {
  it('trusts the server category, else derives it from the type', () => {
    expect(categoryOf({ type: 'ANYTHING', category: 'PAYMENT' })).toBe('PAYMENT');
    expect(categoryOf({ type: 'RIDER_NEARBY' })).toBe('DELIVERY');
    expect(categoryOf({ type: 'SOMETHING_UNKNOWN' })).toBe('ORDER');
  });

  it('needs the customer only while unread', () => {
    expect(needsYou({ type: 'FEE_UPDATED', isRead: false })).toBe(true);
    expect(needsYou({ type: 'FEE_UPDATED', isRead: true })).toBe(false);
    expect(needsYou({ type: 'ERRAND_ACCEPTED', isRead: false })).toBe(false);
  });

  it('finds the errand id', () => {
    expect(errandIdOf({ refKey: 'errand:abc' })).toBe('abc');
    expect(errandIdOf({ refKey: 'rider:3' })).toBeNull();
  });
});
