import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MapPreviewField from '../components/MapPreviewField';

describe('MapPreviewField', () => {
  it('renders a static placeholder with no MapView until tapped, then opens the modal map', async () => {
    const res: any = await render(
      <MapPreviewField
        testID="field"
        mapTestID="field-map"
        center={{ latitude: 6.671, longitude: 124.6644 }}
        label="Test location"
      />
    );

    expect(res.getByTestId('field')).toBeTruthy();
    expect(res.queryByTestId('field-map')).toBeNull();

    await fireEvent.press(res.getByTestId('field'));

    expect(res.getByTestId('field-map')).toBeTruthy();
  }, 15000);

  it('in read-only mode (editable=false), does not render save button and closes with Close button without saving', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const res: any = await render(
      <MapPreviewField
        editable={false}
        center={{ latitude: 6.671, longitude: 124.6644 }}
        label="Delivery Pin Location"
        controlled={{ visible: true, onClose }}
        onConfirm={onConfirm}
        confirmLabel="Save Pinpoint Location"
      />
    );

    // Should NOT show "Save Pinpoint Location" button
    expect(res.queryByText('Save Pinpoint Location')).toBeNull();
    // Should show "Close" button
    const closeBtn = res.getByText('Close');
    expect(closeBtn).toBeTruthy();

    await fireEvent.press(closeBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('in editable mode (editable=true), renders save button and calls onConfirm', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const res: any = await render(
      <MapPreviewField
        editable={true}
        center={{ latitude: 6.671, longitude: 124.6644 }}
        label="Update Delivery Pin"
        controlled={{ visible: true, onClose }}
        onConfirm={onConfirm}
        confirmLabel="Save Pinpoint Location"
      />
    );

    const saveBtn = res.getByText('Save Pinpoint Location');
    expect(saveBtn).toBeTruthy();

    await fireEvent.press(saveBtn);
    expect(onConfirm).toHaveBeenCalledWith({ latitude: 6.671, longitude: 124.6644 });
    expect(onClose).toHaveBeenCalled();
  });
});
