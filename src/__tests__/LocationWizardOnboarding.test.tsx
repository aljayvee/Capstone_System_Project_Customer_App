import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LocationWizard from '../screens/location/LocationWizard';

describe('LocationWizard - Onboarding Step 2 Mount', () => {
  const onUseCurrentLocation = jest.fn();
  const onSave = jest.fn();
  const onCancel = jest.fn();

  const draftValues = {
    latitude: 6.6922,
    longitude: 124.6811,
    address: 'Poblacion, Tacurong City, Sultan Kudarat',
    label: 'Home',
    streetName: '',
    landmark: '',
    notes: '',
    isDefault: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mounts directly into Step 2 of 2 with pre-filled address and label', async () => {
    const res: any = await render(
      <LocationWizard
        initialValues={draftValues}
        initialStep={2}
        saving={false}
        gpsLoading={false}
        onUseCurrentLocation={onUseCurrentLocation}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    expect(res.getByText('Step 2 of 2')).toBeTruthy();
    expect(res.getByDisplayValue('Poblacion, Tacurong City, Sultan Kudarat')).toBeTruthy();
    expect(res.getByDisplayValue('Home')).toBeTruthy();

    expect(res.getByTestId('location-street-input')).toBeTruthy();
    expect(res.getByTestId('location-landmark-input')).toBeTruthy();
    expect(res.getByTestId('location-notes-input')).toBeTruthy();
    expect(res.getByTestId('location-save-button')).toBeTruthy();
  });

  it('allows filling Street Name, Landmark, and Notes and saving', async () => {
    const res: any = await render(
      <LocationWizard
        initialValues={draftValues}
        initialStep={2}
        saving={false}
        gpsLoading={false}
        onUseCurrentLocation={onUseCurrentLocation}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    await fireEvent.changeText(res.getByTestId('location-street-input'), 'Lapu-Lapu St.');
    await fireEvent.changeText(res.getByTestId('location-landmark-input'), 'Opposite City Hall');
    await fireEvent.changeText(res.getByTestId('location-notes-input'), 'Ring doorbell twice');

    await fireEvent.press(res.getByTestId('location-save-button'));

    expect(onSave).toHaveBeenCalledWith({
      label: 'Home',
      address: 'Poblacion, Tacurong City, Sultan Kudarat',
      streetName: 'Lapu-Lapu St.',
      landmark: 'Opposite City Hall',
      notes: 'Ring doorbell twice',
      latitude: 6.6922,
      longitude: 124.6811,
      isDefault: true,
    });
  });
});
