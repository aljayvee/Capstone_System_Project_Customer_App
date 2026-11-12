import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ErrandDetailsScreen from '../screens/ErrandDetailsScreen';
import { apiClient } from '../services/apiClient';
import { paymentMethodChangeOf } from '../utils/errandPersonnel';

/**
 * Chose GCash/PayMaya, paid the rider cash at the door ("They're paying cash
 * instead"). The Transaction Summary keeps the choice, struck through, above
 * Cash on Delivery, so the customer sees the switch was recorded rather than
 * their choice going missing.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(() => Promise.resolve({ data: null })) },
}));

jest.mock('../components/FeeBreakdownCard', () => () => null);
jest.mock('../components/ErrandProofStrip', () => () => null);

const getMock = apiClient.get as jest.Mock;
const navigation: any = { goBack: jest.fn(), navigate: jest.fn() };
const user = { id: 1, username: 'johndoe', firstName: 'John', lastName: 'Doe' };

const change = { from: 'GCash / PayMaya', to: 'Cash on Delivery' };

/** As My Errands passes it: /customers/:id/transactions. */
const listCopy = {
  id: 'ERR-CASH',
  orderId: 'ERR-CASH',
  status: 'DELIVERED',
  paymentMethod: 'Cash on Delivery',
  paymentMethodChange: change,
  totalCost: 560,
  grandTotal: 560,
  categories: 'Rice',
  createdAt: new Date().toISOString(),
};

/** As GET /errands/:id sends it. */
const serverCopy = {
  id: 'ERR-CASH',
  status: 'DELIVERED',
  paymentSelection: { paymentMode: { name: 'GCash / PayMaya' } },
  paymentMode: { name: 'Cash on Delivery' },
  paymentMethodChange: change,
  totalCost: 560,
  pabiliDetails: [{ itemName: 'Rice', quantity: 1 }],
  createdAt: listCopy.createdAt,
};

const show = (errand: any) =>
  render(
    <ErrandDetailsScreen
      route={{
        key: 'ErrandDetails-cash',
        name: 'ErrandDetails',
        params: { user, errand, errandId: errand.id },
      } as any}
      navigation={navigation}
    />
  ) as any;

beforeEach(() => {
  getMock.mockReset();
});

describe('reading the change from either API shape', () => {
  it('returns the change the server sent', () => {
    expect(paymentMethodChangeOf(listCopy)).toEqual(change);
    expect(paymentMethodChangeOf(serverCopy)).toEqual(change);
  });

  it('returns nothing when there was no change, or only half of one', () => {
    expect(paymentMethodChangeOf({ paymentMethodChange: null })).toBeNull();
    expect(paymentMethodChangeOf({ paymentMethodChange: { from: 'GCash / PayMaya' } })).toBeNull();
    expect(paymentMethodChangeOf({})).toBeNull();
    expect(paymentMethodChangeOf(null)).toBeNull();
  });
});

describe('the Transaction Summary payment method', () => {
  it('strikes through the chosen method and shows Cash on Delivery', async () => {
    getMock.mockResolvedValue({ data: serverCopy });
    const res = await show(listCopy);

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/errands/ERR-CASH'));
    const from = res.getByTestId('payment-method-from');
    const to = res.getByTestId('payment-method-to');

    expect(from.props.children).toBe('GCash / PayMaya');
    expect(to.props.children).toBe('Cash on Delivery');
    const struck = [from.props.style].flat(Infinity).find((s: any) => s?.textDecorationLine);
    expect(struck.textDecorationLine).toBe('line-through');
    expect(res.getByLabelText('Payment method changed from GCash / PayMaya to Cash on Delivery')).toBeTruthy();
  });

  it('keeps the change through a refresh that lands without the list copy', async () => {
    getMock.mockResolvedValue({ data: serverCopy });
    const res = await show({ ...serverCopy, orderId: 'ERR-CASH' });

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(res.getByTestId('payment-method-change')).toBeTruthy();
  });

  it('shows a plain method when the customer paid the way they chose', async () => {
    const paidAsChosen = {
      ...serverCopy,
      paymentMode: { name: 'GCash / PayMaya' },
      paymentMethodChange: null,
    };
    getMock.mockResolvedValue({ data: paidAsChosen });
    const res = await show({ ...listCopy, paymentMethod: 'GCash / PayMaya', paymentMethodChange: null });

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(res.queryByTestId('payment-method-change')).toBeNull();
    expect(res.getByText('GCash / PayMaya')).toBeTruthy();
  });

  it('still says voided on a cancelled errand', async () => {
    const cancelled = { ...serverCopy, status: 'CANCELLED' };
    getMock.mockResolvedValue({ data: cancelled });
    const res = await show({ ...listCopy, status: 'CANCELLED' });

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(res.queryByTestId('payment-method-change')).toBeNull();
    expect(res.getByText('Voided (Not Charged)')).toBeTruthy();
  });
});
