import React from 'react';
import { render } from '@testing-library/react-native';
import FeeBreakdownCard from '../components/FeeBreakdownCard';
import type { FeeQuote } from '../services/quoteService';

const quote = (over: Partial<FeeQuote> = {}): FeeQuote =>
  ({
    fees: {
      baseFee: 67,
      distanceFee: 88,
      multiStoreFee: 0,
      groceryFee: 50,
      nonCodFee: 0,
      subtotal: 205,
    },
    itemsSubtotal: 5000,
    tip: 0,
    grandTotal: 5205,
    isFinal: true,
    ...over,
  }) as FeeQuote;

const draw = async (q: FeeQuote | null) =>
  await render(<FeeBreakdownCard breakdown={q} testIDPrefix="price" />);

describe('the fee breakdown a customer sees', () => {
  it('shows every charge that applies', async () => {
    const res: any = await draw(quote());
    expect(res.getByTestId('price-base-fee').props.children).toContain('₱67');
    expect(res.getByTestId('price-distance-fee').props.children).toContain('₱88');
    expect(res.getByTestId('price-grocery-fee').props.children).toContain('₱50');
    expect(res.getByTestId('price-fees-subtotal').props.children).toContain('₱205');
  });

  it('keeps centavos on item money that is not whole', async () => {
    // The fare rounds to whole pesos; a receipt total does not.
    const res: any = await draw(quote({ itemsSubtotal: 994.5 } as any));
    expect(res.getByTestId('price-items-subtotal').props.children).toContain('₱994.50');
  });

  it('hides charges that do not apply rather than showing zeroes', async () => {
    const res: any = await draw(quote());
    expect(res.queryByTestId('price-multi-store-fee')).toBeNull();
    expect(res.queryByTestId('price-non-cod-fee')).toBeNull();
  });

  it('keeps the item money visibly apart from the service fees', async () => {
    const res: any = await draw(quote());
    expect(res.getByTestId('price-items-subtotal').props.children).toContain('₱5,000');
    expect(res.getByTestId('price-fees-subtotal').props.children).toContain('₱205');
  });

  it("says the order was collected from extra stores for free", async () => {
    // The dispatcher split a one-category order across two shops.
    const res: any = await draw(quote({ absorbedStores: 1 }));
    const note = res.getByTestId('price-absorbed-stores');
    expect(note.props.children).toContain('2 stores');
    expect(note.props.children).toContain('no extra charge');
  });

  it('counts all the shops, not just the extra ones', async () => {
    const res: any = await draw(quote({ absorbedStores: 2 }));
    expect(res.getByTestId('price-absorbed-stores').props.children).toContain('3 stores');
  });

  it('says nothing on an ordinary errand', async () => {
    const res: any = await draw(quote({ absorbedStores: 0 }));
    expect(res.queryByTestId('price-absorbed-stores')).toBeNull();
  });

  it('says nothing when the server sent no such figure', async () => {
    // Older payloads, and any client reading an errand priced before this field.
    const res: any = await draw(quote());
    expect(res.queryByTestId('price-absorbed-stores')).toBeNull();
  });

  it('labels a fare priced before any route as an estimate', async () => {
    const res: any = await draw(quote({ isFinal: false }));
    expect(res.getByText(/Estimated Total/)).toBeTruthy();
  });

  it('labels a routed fare as final', async () => {
    const res: any = await draw(quote({ isFinal: true }));
    expect(res.getByText('Total')).toBeTruthy();
  });
});
