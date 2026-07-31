import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CheckoutScreen from '../screens/CheckoutScreen';

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('CheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders price calculation breakdown and MapView component for Pabili', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        orderPayload: {
          selectedServices: ['Pabili'],
          pabiliCats: ['Pharmacy'],
          catItems: { Pharmacy: ['Medicine'] },
        },
      },
    };

    const res: any = await render(
      <CheckoutScreen navigation={mockNavigation} route={mockRoute} />
    );

    // MapView component rendering check
    expect(res.getByTestId('map-view')).toBeTruthy();

    // Price calculation breakdown checks
    expect(res.getByTestId('price-base-fee')).toBeTruthy();
    expect(res.getByText('₱70.00')).toBeTruthy();

    expect(res.getByTestId('price-distance-fee')).toBeTruthy();
    expect(res.getByText('₱8.00')).toBeTruthy();

    expect(res.getByTestId('price-grand-total')).toBeTruthy();
  });

  it('selects payment methods for Pabili order', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        orderPayload: {
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

  it('submits Pabili order and navigates to OrderConfirmationScreen', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        orderPayload: {
          selectedServices: ['Pabili'],
        },
      },
    };

    const res: any = await render(
      <CheckoutScreen navigation={mockNavigation} route={mockRoute} />
    );

    await fireEvent.press(res.getByTestId('submit-order-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'OrderConfirmation',
      expect.objectContaining({
        user: mockRoute.params.user,
        finalOrder: expect.objectContaining({
          services: ['Pabili'],
          baseFee: 70,
          distanceFee: 8,
        }),
      })
    );
  });
});
