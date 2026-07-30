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

  it('renders price calculation breakdown and MapView component', async () => {
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
    expect(res.getByText('₱10.00')).toBeTruthy(); // Math.floor(2.5) * 5 = 10

    expect(res.getByTestId('price-grand-total')).toBeTruthy();
  });

  it('tests COD restriction for Bills Payment > ₱3000', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        orderPayload: {
          selectedServices: ['Bills Payment'],
          billsInfo: {
            biller: 'Electric Co',
            accountNo: 'ELE-12345',
            amount: 4500, // > 3000
          },
        },
      },
    };

    const res: any = await render(
      <CheckoutScreen navigation={mockNavigation} route={mockRoute} />
    );

    // COD warning displayed
    expect(res.getByTestId('cod-disabled-warning')).toBeTruthy();
    expect(
      res.getByText('⚠️ Cash on Delivery (COD) is unavailable for bills > ₱3,000.')
    ).toBeTruthy();

    // Attempt pressing COD
    await fireEvent.press(res.getByTestId('payment-option-COD'));

    // Select GCash instead
    await fireEvent.press(res.getByTestId('payment-option-GCash'));
  });

  it('submits order and navigates to OrderConfirmationScreen', async () => {
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
          distanceFee: 10,
        }),
      })
    );
  });
});

