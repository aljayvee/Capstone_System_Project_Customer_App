import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OrderFormScreen from '../screens/OrderFormScreen';

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('OrderFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Pabili categories and enforces max 3 categories limit', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        selectedServices: ['Pabili'],
      },
    };

    const res: any = await render(
      <OrderFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByTestId('pabili-section')).toBeTruthy();

    // Select 3 categories
    await fireEvent.press(res.getByTestId('category-card-Retail Store'));
    await fireEvent.press(res.getByTestId('category-card-Restaurant'));
    await fireEvent.press(res.getByTestId('category-card-Pharmacy'));

    // Attempt 4th category -> triggers limit error
    await fireEvent.press(res.getByTestId('category-card-Bakery'));
    expect(res.getByTestId('category-limit-error')).toBeTruthy();
  });

  it('validates missing categories and submits valid Pabili items', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        selectedServices: ['Pabili'],
      },
    };

    const res: any = await render(
      <OrderFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Submit without selecting categories -> validation error
    await fireEvent.press(res.getByTestId('submit-order-form-button'));
    expect(res.getByTestId('validation-error-banner')).toBeTruthy();

    // Select category and enter item
    await fireEvent.press(res.getByTestId('category-card-Pharmacy'));
    await fireEvent.changeText(res.getByTestId('item-input-Pharmacy-0'), 'Paracetamol 500mg');

    // Submit valid form
    await fireEvent.press(res.getByTestId('submit-order-form-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Checkout',
      expect.objectContaining({
        user: mockRoute.params.user,
        orderPayload: expect.objectContaining({
          selectedServices: ['Pabili'],
          pabiliCats: ['Pharmacy'],
          catItems: { Pharmacy: ['Paracetamol 500mg'] },
        }),
      })
    );
  });
});
