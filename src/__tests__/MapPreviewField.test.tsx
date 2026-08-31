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
});
