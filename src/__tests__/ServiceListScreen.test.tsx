import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ServiceListScreen from '../screens/ServiceListScreen';

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

const mockRoute: any = {
  params: {
    user: { id: 'u1', username: 'test', firstName: 'Test', lastName: 'User' },
  },
};

describe('ServiceListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Pabili service card', async () => {
    const res: any = await render(
      <ServiceListScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Select Errand Service')).toBeTruthy();
    expect(res.getByTestId('service-card-Pabili')).toBeTruthy();
    expect(res.getByTestId('selected-badge-Pabili')).toBeTruthy();
  });

  it('navigates to OrderFormScreen when Continue is pressed', async () => {
    const res: any = await render(
      <ServiceListScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByTestId('summary-bar')).toBeTruthy();

    await fireEvent.press(res.getByTestId('continue-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OrderForm', {
      user: mockRoute.params.user,
      selectedServices: ['Pabili'],
    });
  });
});
