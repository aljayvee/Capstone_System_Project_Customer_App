import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('OrderConfirmationScreen', () => {
  it('renders receipt summary, tracking stepper, and map preview', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        finalOrder: {
          orderId: 'SGO-889900',
          services: ['Pabili', 'Padala'],
          payload: {},
          baseFee: 70,
          distanceKm: 2.5,
          distanceFee: 10,
          commission: 50,
          subtotal: 0,
          grandTotal: 130,
          paymentMethod: 'GCash',
          status: 'Order Placed',
          createdAt: Date.now(),
        },
      },
    };

    const res: any = await render(
      <OrderConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Digital receipt checks
    expect(res.getByTestId('digital-receipt')).toBeTruthy();
    expect(res.getByTestId('order-id-text')).toBeTruthy();
    expect(res.getByText('SGO-889900')).toBeTruthy();
    expect(res.getByTestId('grand-total-text')).toBeTruthy();
    expect(res.getByText('₱130.00')).toBeTruthy();

    // Tracking stepper check
    expect(res.getByTestId('tracking-stepper')).toBeTruthy();
    expect(res.getByTestId('tracking-step-0')).toBeTruthy();

    // Map preview check
    expect(res.getByTestId('confirmation-map-view')).toBeTruthy();

    // Back to dashboard press
    await fireEvent.press(res.getByTestId('back-to-dashboard-button'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomerPortal', {
      user: mockRoute.params.user,
    });
  });
});

