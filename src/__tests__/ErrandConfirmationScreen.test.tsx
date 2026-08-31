import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ErrandConfirmationScreen from '../screens/ErrandConfirmationScreen';

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
};

describe('ErrandConfirmationScreen', () => {
  it('renders receipt summary, tracking stepper, and map preview', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        finalErrand: {
          errandId: 'SGO-889900',
          services: ['Pabili', 'Padala'],
          payload: {},
          baseFee: 70,
          distanceKm: 2.5,
          distanceFee: 10,
          commission: 50,
          subtotal: 0,
          grandTotal: 130,
          paymentMethod: 'GCash',
          status: 'Errand Placed',
          createdAt: Date.now(),
        },
      },
    };

    const res: any = await render(
      <ErrandConfirmationScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Digital receipt checks
    expect(res.getByTestId('digital-receipt')).toBeTruthy();
    expect(res.getByTestId('errand-id-text')).toBeTruthy();
    expect(res.getByText('SGO-889900')).toBeTruthy();
    expect(res.getByTestId('grand-total-text')).toBeTruthy();
    expect(res.getByText('₱130.00')).toBeTruthy();

    // Tracking stepper check
    expect(res.getByTestId('tracking-stepper')).toBeTruthy();
    expect(res.getByTestId('tracking-step-0')).toBeTruthy();

    // Map preview placeholder renders inline instead of a live MapView — a
    // MapView directly inside this ScrollView crashes on Android. The real
    // MapView only mounts inside MapPreviewField's own full-screen modal,
    // which is covered separately by MapPreviewField's own tests.
    expect(res.getByTestId('confirmation-map-preview-field')).toBeTruthy();

    // Back to dashboard press
    await fireEvent.press(res.getByTestId('back-to-dashboard-button'));
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'CustomerPortal', params: { user: mockRoute.params.user } }],
    });
  }, 15000);
});
