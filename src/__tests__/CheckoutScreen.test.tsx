import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CheckoutScreen from '../screens/CheckoutScreen';
import { fetchQuote } from '../services/quoteService';

// Pricing is the server's job now. This screen used to compute its own total
// from a hardcoded 2.5 km — which is exactly what these tests were pinning in
// place — so the quote is mocked and the assertions check that the screen
// RENDERS what it was given, not that it can do arithmetic.
jest.mock('../services/quoteService', () => ({
  fetchQuote: jest.fn(),
}));

const mockedFetchQuote = fetchQuote as jest.MockedFunction<typeof fetchQuote>;

const QUOTE = {
  fees: {
    baseFee: 70,
    distanceFee: 0,
    multiStoreFee: 30,
    groceryFee: 50,
    nonCodFee: 0,
    subtotal: 150,
  },
  itemsSubtotal: 500,
  tip: 0,
  grandTotal: 650,
  isFinal: false,
};

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('CheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchQuote.mockResolvedValue(QUOTE);
  });

  it('renders price calculation breakdown and MapView component for Pabili', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        errandPayload: {
          selectedServices: ['Pabili'],
          pabiliCats: ['Pharmacy'],
          catItems: { Pharmacy: ['Medicine'] },
        },
      },
    };

    const res: any = await render(
      <CheckoutScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Map preview placeholder renders inline instead of a live MapView — a
    // MapView directly inside this ScrollView crashes on Android. The real
    // MapView only mounts inside MapPreviewField's own full-screen modal,
    // which is covered separately by MapPreviewField's own tests.
    expect(res.getByTestId('map-preview-field')).toBeTruthy();

    // Every component the server returned is shown — the old screen omitted
    // multi-store and non-COD entirely, so a customer could not see what they
    // were being charged for.
    await waitFor(() => expect(res.getByTestId('price-base-fee')).toBeTruthy());
    expect(res.getByTestId('price-base-fee').props.children as unknown as string).toBe('₱70');
    expect(res.getByTestId('price-distance-fee').props.children as unknown as string).toBe('₱0');
    expect(res.getByTestId('price-multi-store-fee').props.children as unknown as string).toBe('₱30');
    expect(res.getByTestId('price-grocery-fee').props.children as unknown as string).toBe('₱50');

    // Fees and items are separate lines and separate subtotals: the item money
    // is the customer's, fronted by the company, and is not a service charge.
    expect(res.getByTestId('price-fees-subtotal').props.children as unknown as string).toBe('₱150');
    expect(res.getByTestId('price-items-subtotal').props.children as unknown as string).toBe('₱500');
    expect(res.getByTestId('price-grand-total').props.children as unknown as string).toBe('₱650');

    // A pre-creation quote has no routed distance, so it must be labelled.
    expect(res.getByTestId('price-estimate-note')).toBeTruthy();
  });

  it('shows no price at all rather than a wrong one when the quote fails', async () => {
    // The honest failure mode for money: a customer must never be shown a total
    // the server did not produce.
    mockedFetchQuote.mockResolvedValue(null);

    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        errandPayload: { selectedServices: ['Pabili'], pabiliCats: ['Grocery'], catItems: { Grocery: ['Rice'] } },
      },
    };

    const res: any = await render(<CheckoutScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => expect(res.getByTestId('price-loading')).toBeTruthy());
    expect(res.queryByTestId('price-grand-total')).toBeNull();
  });

  it('re-quotes when the payment method changes', async () => {
    // Non-COD carries a handling fee, so the price genuinely moves.
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        errandPayload: { selectedServices: ['Pabili'], pabiliCats: ['Grocery'], catItems: { Grocery: ['Rice'] } },
      },
    };

    const res: any = await render(<CheckoutScreen navigation={mockNavigation} route={mockRoute} />);
    await waitFor(() => expect(mockedFetchQuote).toHaveBeenCalledWith(expect.objectContaining({ isCod: true })));

    await fireEvent.press(res.getByTestId('payment-option-GCash'));
    await waitFor(() => expect(mockedFetchQuote).toHaveBeenCalledWith(expect.objectContaining({ isCod: false })));
  });

  it('selects payment methods for Pabili errand', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        errandPayload: {
          selectedServices: ['Pabili'],
          pabiliCats: ['Grocery'],
          catItems: { Grocery: ['Rice'] },
        },
      },
    };

    const res: any = await render(
      <CheckoutScreen navigation={mockNavigation} route={mockRoute} />
    );

    await fireEvent.press(res.getByTestId('payment-option-GCash'));
    await fireEvent.press(res.getByTestId('payment-option-COD'));
  });

  it('submits Pabili errand and navigates to ErrandConfirmationScreen', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        errandPayload: {
          selectedServices: ['Pabili'],
        },
      },
    };

    const res: any = await render(
      <CheckoutScreen navigation={mockNavigation} route={mockRoute} />
    );

    await fireEvent.press(res.getByTestId('submit-errand-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'WaitingForDispatcher',
      expect.objectContaining({
        user: mockRoute.params.user,
        finalErrand: expect.objectContaining({
          services: ['Pabili'],
          baseFee: 70,
          // 0, not the 8 this used to assert. That figure came from a hardcoded
          // 2.5 km baked into the screen; there is no route to measure until the
          // dispatcher pins stores, so the distance fee is genuinely nil here and
          // is applied when the errand is repriced.
          distanceFee: 0,
          distanceKm: 0,
          grandTotal: 650,
        }),
      })
    );
  });
});
