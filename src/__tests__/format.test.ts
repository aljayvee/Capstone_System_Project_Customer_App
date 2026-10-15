import { formatPaymentMethod, formatPeso, formatDuration, formatDistance } from '../utils/format';

describe('formatPaymentMethod', () => {
  describe('full variant', () => {
    it('normalizes GCash / PayMaya variations correctly', () => {
      expect(formatPaymentMethod('GCash / PayMaya', 'full')).toBe('GCash / PayMaya');
      expect(formatPaymentMethod('GCASH', 'full')).toBe('GCash / PayMaya');
      expect(formatPaymentMethod('gcash', 'full')).toBe('GCash / PayMaya');
      expect(formatPaymentMethod('PayMaya', 'full')).toBe('GCash / PayMaya');
      expect(formatPaymentMethod('GCash / PayMaya (50%)', 'full')).toBe('GCash / PayMaya');
    });

    it('normalizes Bank Transfer variations correctly', () => {
      expect(formatPaymentMethod('Bank Transfer', 'full')).toBe('Bank Transfer');
      expect(formatPaymentMethod('BANK_TRANSFER', 'full')).toBe('Bank Transfer');
      expect(formatPaymentMethod('bank transfer', 'full')).toBe('Bank Transfer');
    });

    it('normalizes Card variations correctly', () => {
      expect(formatPaymentMethod('CARD', 'full')).toBe('Debit/Credit Card');
      expect(formatPaymentMethod('Debit/Credit Card', 'full')).toBe('Debit/Credit Card');
      expect(formatPaymentMethod('Visa', 'full')).toBe('Debit/Credit Card');
      expect(formatPaymentMethod('Mastercard', 'full')).toBe('Debit/Credit Card');
    });

    it('normalizes Online variations correctly', () => {
      expect(formatPaymentMethod('ONLINE', 'full')).toBe('Paid Online');
      expect(formatPaymentMethod('Online', 'full')).toBe('Paid Online');
      expect(formatPaymentMethod('Paid Online', 'full')).toBe('Paid Online');
    });

    it('normalizes Cash / COD variations correctly', () => {
      expect(formatPaymentMethod('COD', 'full')).toBe('Cash on Delivery');
      expect(formatPaymentMethod('Cash on Delivery', 'full')).toBe('Cash on Delivery');
      expect(formatPaymentMethod('Cash', 'full')).toBe('Cash on Delivery');
    });

    it('handles null, undefined, empty, or pending values gracefully', () => {
      expect(formatPaymentMethod(null, 'full')).toBe('Pending Selection');
      expect(formatPaymentMethod(undefined, 'full')).toBe('Pending Selection');
      expect(formatPaymentMethod('', 'full')).toBe('Pending Selection');
      expect(formatPaymentMethod('PENDING', 'full')).toBe('Pending Selection');
      expect(formatPaymentMethod('pending', 'full')).toBe('Pending Selection');
      expect(formatPaymentMethod('UNSET', 'full')).toBe('Pending Selection');
    });
  });

  describe('short variant', () => {
    it('normalizes short labels for cards and lists', () => {
      expect(formatPaymentMethod('GCash / PayMaya', 'short')).toBe('GCash / PayMaya');
      expect(formatPaymentMethod('GCASH', 'short')).toBe('GCash / PayMaya');
      expect(formatPaymentMethod('Bank Transfer', 'short')).toBe('Bank Transfer');
      expect(formatPaymentMethod('CARD', 'short')).toBe('Card');
      expect(formatPaymentMethod('Debit/Credit Card', 'short')).toBe('Card');
      expect(formatPaymentMethod('ONLINE', 'short')).toBe('Online');
      expect(formatPaymentMethod('COD', 'short')).toBe('Cash');
      expect(formatPaymentMethod('Cash on Delivery', 'short')).toBe('Cash');
      expect(formatPaymentMethod(null, 'short')).toBe('Pending');
      expect(formatPaymentMethod(undefined, 'short')).toBe('Pending');
      expect(formatPaymentMethod('PENDING', 'short')).toBe('Pending');
      expect(formatPaymentMethod('pending', 'short')).toBe('Pending');
    });
  });
});

describe('formatPeso', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatPeso(200)).toBe('₱200');
    expect(formatPeso(1500)).toBe('₱1,500');
  });

  it('formats amounts with centavos up to 2 decimal places', () => {
    expect(formatPeso(99.5)).toBe('₱99.50');
    expect(formatPeso(1234.75)).toBe('₱1,234.75');
  });

  it('handles zero and non-finite numbers defensively', () => {
    expect(formatPeso(0)).toBe('₱0');
    expect(formatPeso(NaN)).toBe('₱0');
  });
});

describe('formatDuration and formatDistance', () => {
  it('formats durations under 1 hour in minutes', () => {
    expect(formatDuration(1800)).toBe('30 min');
  });

  it('formats durations over 1 hour in hours and minutes', () => {
    expect(formatDuration(4500)).toBe('1 hr 15 min');
  });

  it('formats distances under 1 km in meters', () => {
    expect(formatDistance(750)).toBe('750 m');
  });

  it('formats distances over 1 km in kilometers', () => {
    expect(formatDistance(2500)).toBe('2.5 km');
  });
});
