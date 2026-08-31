import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ErrandFormScreen from '../screens/ErrandFormScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({ data: { id: 'PABILI-TEST-123' } }),
    get: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('ErrandFormScreen', () => {
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
      <ErrandFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByTestId('pabili-section')).toBeTruthy();

    // Select 3 categories
    await fireEvent.press(res.getByTestId('category-card-Fast Food & Restaurant'));
    await fireEvent.press(res.getByTestId('category-card-Pharmacy & Health'));
    await fireEvent.press(res.getByTestId('category-card-Supermarket & Grocery'));

    // Attempt 4th category -> triggers limit error
    await fireEvent.press(res.getByTestId('category-card-Retail & General Merchandise'));
    expect(res.getByTestId('category-limit-error')).toBeTruthy();
  }, 15000);

  it('validates missing categories and continues to item entry with selected categories', async () => {
    const mockRoute: any = {
      params: {
        user: { id: 'u1', username: 'testuser' },
        selectedServices: ['Pabili'],
      },
    };

    const res: any = await render(
      <ErrandFormScreen navigation={mockNavigation} route={mockRoute} />
    );

    // With nothing selected the form refuses to advance. It does this by
    // disabling the button rather than by erroring after the press, so the
    // press must be a no-op and no banner should appear.
    const submit = res.getByTestId('submit-errand-form-button');
    expect(submit.props.accessibilityState?.disabled ?? submit.props.disabled).toBe(true);
    await fireEvent.press(submit);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(res.queryByTestId('validation-error-banner')).toBeNull();

    // Select category
    await fireEvent.press(res.getByTestId('category-card-Pharmacy & Health'));

    // Continue with a valid selection -> hands off to the item-entry screen
    await fireEvent.press(res.getByTestId('submit-errand-form-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'ErrandItems',
      expect.objectContaining({
        user: mockRoute.params.user,
        selectedCats: ['Pharmacy & Health'],
      })
    );
  });
});
