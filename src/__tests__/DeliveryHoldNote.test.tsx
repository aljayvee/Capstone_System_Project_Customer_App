import React from 'react';
import { render } from '@testing-library/react-native';
import DeliveryHoldNote, { deliveryHoldOf } from '../components/DeliveryHoldNote';

/**
 * A bought order waiting for the same customer's other one, so the rider
 * brings both in one trip. The Track tab says why the rider with this order
 * is heading to a store instead of the door.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

describe('reading the hold the server sent', () => {
  it('returns the order it waits for', () => {
    expect(deliveryHoldOf({ deliveryHold: { errandId: 'ERR-2' } })).toEqual({ errandId: 'ERR-2' });
  });

  it('returns nothing when it is not held, or the payload does not say', () => {
    expect(deliveryHoldOf({ deliveryHold: null })).toBeNull();
    expect(deliveryHoldOf({})).toBeNull();
    expect(deliveryHoldOf({ deliveryHold: { errandId: '  ' } })).toBeNull();
    expect(deliveryHoldOf(null)).toBeNull();
  });
});

describe('DeliveryHoldNote', () => {
  it('tells the customer both orders come together', async () => {
    const view = (await render(<DeliveryHoldNote errand={{ id: 'ERR-1', deliveryHold: { errandId: 'ERR-2' } }} />)) as any;
    expect(view.getByTestId('delivery-hold-note')).toBeTruthy();
    expect(view.getByText(/is shopping for your other order, .+, first\. Both will arrive together in one trip\./)).toBeTruthy();
  });

  it('says nothing for an order that is not held', async () => {
    const view = (await render(<DeliveryHoldNote errand={{ id: 'ERR-1', deliveryHold: null }} />)) as any;
    expect(view.queryByTestId('delivery-hold-note')).toBeNull();
  });
});
