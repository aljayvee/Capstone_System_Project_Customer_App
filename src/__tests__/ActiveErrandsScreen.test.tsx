import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../services/apiClient';
import ActiveErrandsScreen from '../screens/ActiveErrandsScreen';
import { estimatedFeeOf, isActiveErrand, pesos } from '../utils/activeErrands';

/**
 * Active Errands (2026-10-10), opened from Home's liquid glass button: one
 * active errand shows its details here, two or more show as cards, each with
 * the errand ID, the estimated fee, the status and a ">" to its details.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../hooks/useRateConfig', () => ({
  useRateConfig: () => ({ baseFee: 50 }),
}));

// The details screen has its own tests; here it only has to be the one shown.
jest.mock('../screens/ErrandDetailsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return (props: any) =>
    React.createElement(Text, { testID: 'errand-details' }, `Errand Details ${props.route.params.errandId}`);
});

const user = { id: 4, username: 'maria' };
const errand = (id: string, status: string, extra: object = {}) => ({ id, orderId: id, status, ...extra });

const navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const draw = (errands?: object[]) =>
  render(
    <ActiveErrandsScreen
      navigation={navigation as any}
      route={{ key: 'a', name: 'ActiveErrands', params: { user, errands } } as any}
    />
  );
const serverHas = (orders: object[]) => (apiClient.get as jest.Mock).mockResolvedValue({ data: { orders } });

beforeEach(() => jest.clearAllMocks());

describe('what counts as active, and its fee', () => {
  it('keeps errands waiting for a rider or under way, and nothing finished', () => {
    expect(['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT', 'pending'].every((status) => isActiveErrand({ status }))).toBe(true);
    expect(['DELIVERED', 'COMPLETED', 'CANCELLED', undefined].some((status) => isActiveErrand({ status }))).toBe(false);
  });

  it('shows the total once priced, else the estimate, else the base fee', () => {
    expect(estimatedFeeOf({ grandTotal: 315.5, totalCost: 300 }, 50)).toBe(315.5);
    expect(estimatedFeeOf({ grandTotal: 0, totalCost: 0, estimatedCost: 120 }, 50)).toBe(120);
    expect(estimatedFeeOf({ grandTotal: 0 }, 50)).toBe(50);
    expect(pesos(1234.5)).toBe('₱1,234.50');
  });
});

describe('the Active Errands screen', () => {
  it('lists two or more as cards: the errand ID first, then the estimated fee and the status', async () => {
    serverHas([
      errand('aaaa-0001', 'PENDING', { grandTotal: 0, totalCost: 0 }),
      errand('bbbb-0002', 'IN_TRANSIT', { grandTotal: 315.5 }),
      errand('cccc-0003', 'COMPLETED', { grandTotal: 99 }),
    ]);
    const res: any = await draw();

    expect(await res.findByTestId('active-errand-aaaa-0001')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith('/customers/4/transactions');
    expect(res.getByText('SGO-AA0001')).toBeTruthy();
    expect(res.getByText('SGO-BB0002')).toBeTruthy();
    // Finished errands are not here.
    expect(res.queryByTestId('active-errand-cccc-0003')).toBeNull();
    expect(res.getByTestId('active-errand-fee-aaaa-0001').props.children).toBe('₱50.00');
    expect(res.getByTestId('active-errand-fee-bbbb-0002').props.children).toBe('₱315.50');
    expect(res.getByText('Pending')).toBeTruthy();
    expect(res.getByText('In Transit')).toBeTruthy();
    // Heading before fee before status, on each card.
    const order = res
      .getAllByText(/^(SGO-BB0002|₱315\.50|In Transit)$/)
      .map((el: any) => ([] as unknown[]).concat(el.props.children).join(''));
    expect(order).toEqual(['SGO-BB0002', '₱315.50', 'In Transit']);
  });

  it('opens an errand\'s details from its ">" and from the card', async () => {
    serverHas([errand('aaaa-0001', 'PENDING'), errand('bbbb-0002', 'ASSIGNED')]);
    const res: any = await draw();

    await fireEvent.press(await res.findByTestId('active-errand-open-bbbb-0002'));
    expect(navigation.navigate).toHaveBeenCalledWith('ErrandDetails', {
      user,
      errand: expect.objectContaining({ orderId: 'bbbb-0002' }),
      errandId: 'bbbb-0002',
    });
    await fireEvent.press(res.getByTestId('active-errand-aaaa-0001'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('ErrandDetails', expect.objectContaining({ errandId: 'aaaa-0001' }));
  });

  it("shows a single active errand's details right here", async () => {
    serverHas([errand('aaaa-0001', 'ASSIGNED'), errand('cccc-0003', 'DELIVERED')]);
    const res: any = await draw();
    expect(await res.findByTestId('errand-details')).toBeTruthy();
    expect(res.getByText('Errand Details aaaa-0001')).toBeTruthy();
    expect(res.queryByTestId('active-errands-list')).toBeNull();
  });

  it("opens at once on Home's list, then follows what the server says", async () => {
    let answer: (value: unknown) => void = () => {};
    (apiClient.get as jest.Mock).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const res: any = await draw([errand('aaaa-0001', 'PENDING'), errand('bbbb-0002', 'PENDING')]);
    // Home's two, before the server answers.
    expect(res.getByTestId('active-errand-aaaa-0001')).toBeTruthy();

    answer({ data: { orders: [errand('aaaa-0001', 'PENDING'), errand('bbbb-0002', 'DELIVERED')] } });
    // One left: its details.
    expect(await res.findByTestId('errand-details')).toBeTruthy();
  });

  it('says when nothing is active any more, and offers the way back', async () => {
    serverHas([errand('cccc-0003', 'COMPLETED')]);
    const res: any = await draw();
    expect(await res.findByText('You have no active errands right now.')).toBeTruthy();
    await fireEvent.press(res.getByTestId('active-errands-empty-action'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('offers Try again when the errands cannot load', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
    const res: any = await draw();
    expect(await res.findByTestId('active-errands-error')).toBeTruthy();

    serverHas([errand('aaaa-0001', 'PENDING'), errand('bbbb-0002', 'PENDING')]);
    await fireEvent.press(res.getByTestId('active-errands-error-action'));
    expect(await res.findByTestId('active-errand-bbbb-0002')).toBeTruthy();
  });

  it('reads the errands again when it comes back into view', async () => {
    serverHas([errand('aaaa-0001', 'PENDING'), errand('bbbb-0002', 'PENDING')]);
    await draw();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));
    const listeners = Object.fromEntries((navigation.addListener as jest.Mock).mock.calls.map(([name, fn]) => [name, fn]));
    listeners.blur();
    listeners.focus();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  });
});
