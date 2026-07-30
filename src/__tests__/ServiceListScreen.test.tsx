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

  it('renders available services list', async () => {
    const res: any = await render(
      <ServiceListScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(res.getByText('Select Errand Services')).toBeTruthy();
    expect(res.getByTestId('service-card-Pabili')).toBeTruthy();
    expect(res.getByTestId('service-card-Padala')).toBeTruthy();
    expect(res.getByTestId('service-card-Bills Payment')).toBeTruthy();
  });

  it('verifies selection limits (max 2 services)', async () => {
    const res: any = await render(
      <ServiceListScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Select Pabili
    await fireEvent.press(res.getByTestId('service-card-Pabili'));
    expect(res.getByTestId('selected-badge-Pabili')).toBeTruthy();

    // Select Padala
    await fireEvent.press(res.getByTestId('service-card-Padala'));
    expect(res.getByTestId('selected-badge-Padala')).toBeTruthy();

    // Try selecting 3rd service (Bills Payment)
    await fireEvent.press(res.getByTestId('service-card-Bills Payment'));

    // Should display selection limit error
    expect(res.getByTestId('selection-limit-error')).toBeTruthy();
    expect(res.getByText('You can select up to 2 services max.')).toBeTruthy();
  });

  it('navigates to OrderFormScreen when Continue is pressed', async () => {
    const res: any = await render(
      <ServiceListScreen navigation={mockNavigation} route={mockRoute} />
    );

    // Select Pabili
    await fireEvent.press(res.getByTestId('service-card-Pabili'));
    expect(res.getByTestId('summary-bar')).toBeTruthy();

    // Press continue
    await fireEvent.press(res.getByTestId('continue-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('OrderForm', {
      user: mockRoute.params.user,
      selectedServices: ['Pabili'],
    });
  });
});

