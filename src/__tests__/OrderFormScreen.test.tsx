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

  it('tests Pabili category selection limit (max 3 categories)', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'test' },
        selectedServices: ['Pabili'],
      },
    };

    const res: any = await render(
      <OrderFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Select 3 categories
    await fireEvent.press(res.getByTestId('category-card-Retail Store'));
    await fireEvent.press(res.getByTestId('category-card-Restaurant'));
    await fireEvent.press(res.getByTestId('category-card-Pharmacy'));

    // Select 4th category
    await fireEvent.press(res.getByTestId('category-card-Cafés'));

    expect(res.getByTestId('category-limit-error')).toBeTruthy();
    expect(res.getByText('You can select up to 3 categories only.')).toBeTruthy();
  });

  it('tests form validation state updates when missing fields', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'test' },
        selectedServices: ['Pabili'],
      },
    };

    const res: any = await render(
      <OrderFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Press proceed without selecting category
    await fireEvent.press(res.getByTestId('submit-order-form-button'));

    expect(res.getByTestId('validation-error-text')).toBeTruthy();
    expect(res.getByText('Please select at least one Pabili category.')).toBeTruthy();
  });

  it('tests Padala and Bills Payment input fields and successful validation submission', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'test' },
        selectedServices: ['Padala', 'Bills Payment'],
      },
    };

    const res: any = await render(
      <OrderFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Fill Padala fields
    await fireEvent.changeText(res.getByTestId('padala-item-input'), 'Legal Documents');
    await fireEvent.changeText(res.getByTestId('padala-receiver-phone-input'), '09171234567');

    // Fill Bills fields
    await fireEvent.changeText(res.getByTestId('bills-biller-input'), 'Water District');
    await fireEvent.changeText(res.getByTestId('bills-account-input'), 'ACC-998877');
    await fireEvent.changeText(res.getByTestId('bills-amount-input'), '1500');

    // Submit form
    await fireEvent.press(res.getByTestId('submit-order-form-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Checkout', {
      user: mockRoute.params.user,
      orderPayload: {
        selectedServices: ['Padala', 'Bills Payment'],
        padalaInfo: {
          item: 'Legal Documents',
          sender: 'Current Location',
          receiver: '',
          receiverPhone: '09171234567',
        },
        billsInfo: {
          biller: 'Water District',
          accountNo: 'ACC-998877',
          amount: 1500,
        },
      },
    });
  });
});

