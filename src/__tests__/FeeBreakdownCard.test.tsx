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

// ───────────────────────────────────────────────────────────────────────────
// THE 50% DOWNPAYMENT PLAN
//
// The grand total is the whole bill and stays the headline. What a customer
// needs is different: how much to send now, and how much cash to have at the
// door. A single total answers neither, and getting the first one wrong stalls
// their errand.
// ───────────────────────────────────────────────────────────────────────────

const plan = (over: Record<string, any> = {}): any => ({
  hasLedger: true,
  dueUpFront: 0,
  amountPaid: 0,
  balanceDue: 1120,
  state: 'AWAITING_BALANCE',
  ...over,
});

const drawWithPlan = async (p: any) =>
  await render(
    <FeeBreakdownCard
      breakdown={quote({ itemsSubtotal: 1000, grandTotal: 1120 } as any)}
      paymentPlan={p}
      testIDPrefix="price"
    />
  );

describe('paying at the door, on a GCash / PayMaya or Bank Transfer errand', () => {
  // Since 2026-10-08 there is no 50%: the whole bill is paid when the rider
  // arrives, like cash on delivery, and the rider photographs the transfer.
  it('shows nothing extra on an ordinary COD errand', async () => {
    // Almost every errand. A surface that ignores the plan must look exactly as
    // it did before the plan existed.
    const res: any = await drawWithPlan(null);
    expect(res.queryByTestId('price-payment-plan')).toBeNull();
  });

  it('asks for the whole bill at the door and nothing before it', async () => {
    const res: any = await drawWithPlan(plan());
    expect(res.getByText('Pay the rider at your door')).toBeTruthy();
    expect(res.getByTestId('price-balance-due').props.children).toContain('₱1,120');
    // No "send now" row of any kind, not even a ₱0.00 one.
    expect(res.queryByText(/send now/i)).toBeNull();
    expect(res.queryByText(/50%/)).toBeNull();
    expect(res.queryByTestId('price-amount-paid')).toBeNull();
  });

  it('counts a half already paid on an errand from before the change', async () => {
    // Paid under the old plan, so only the rest is owed at the door. Asking for
    // the whole bill again would have a customer pay twice.
    const res: any = await drawWithPlan(plan({ amountPaid: 500, balanceDue: 620 }));
    expect(res.getByText('Payment received')).toBeTruthy();
    expect(res.getByTestId('price-amount-paid').props.children).toContain('₱500');
    expect(res.getByTestId('price-balance-due').props.children).toContain('₱620');
  });

  it('says how to pay, and that cash is fine too', async () => {
    const res: any = await drawWithPlan(plan());
    const note = res.getByTestId('price-plan-note').props.children;
    expect(note).toMatch(/GCash, PayMaya or bank transfer/);
    expect(note).toMatch(/show them the confirmation/i);
    expect(note).toMatch(/or pay in cash/i);
    expect(note).not.toMatch(/Facebook Page/i);
  });

  it('thanks the customer once it is settled', async () => {
    const res: any = await drawWithPlan(plan({ amountPaid: 1120, balanceDue: 0, state: 'SETTLED' }));
    expect(res.getByTestId('price-plan-note').props.children).toMatch(/paid in full/i);
  });

  it('still shows the whole bill as the headline total', async () => {
    // The plan explains the total; it never replaces it.
    const res: any = await drawWithPlan(plan());
    expect(res.getByTestId('price-grand-total').props.children).toContain('₱1,120');
  });
});
