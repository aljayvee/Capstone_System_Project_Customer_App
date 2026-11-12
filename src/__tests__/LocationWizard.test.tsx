import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// Step 2 of saving a place: street name, landmark and notes for the rider,
// alongside the label and address. These pin what reaches the save call.

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    // Every colour the wizard asks for; the values are irrelevant here.
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: false,
  }),
}));

// Step 1 is a map. It is not what these tests are about, so it is replaced by
// a single Next button that hands over no reverse-geocoded address.
jest.mock('../screens/location/WizardStepPin', () => {
  const { TouchableOpacity: Touchable, Text: Label } = require('react-native');
  return ({ onNext }: { onNext: (address: string | null) => void }) => (
    <Touchable testID="mock-step1-next" onPress={() => onNext(null)}>
      <Label>Next</Label>
    </Touchable>
  );
});

import LocationWizard from '../screens/location/LocationWizard';
import type { SavedLocation } from '../screens/location/types';

const PIN = { latitude: 6.69, longitude: 124.68 };

const SAVED: SavedLocation = {
  id: 3,
  userId: 42,
  label: 'Home',
  address: 'Purok 5, Poblacion',
  streetName: 'Rizal Street',
  landmark: 'Blue gate beside the chapel',
  notes: 'Call when outside',
  ...PIN,
  isDefault: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

async function openStep2(initialValues: SavedLocation | null) {
  const onSave = jest.fn();
  const res: any = await render(
    <LocationWizard
      initialValues={initialValues}
      saving={false}
      gpsLoading={false}
      onUseCurrentLocation={async () => PIN}
      onSave={onSave}
      onCancel={jest.fn()}
    />
  );
  await fireEvent.press(res.getByTestId('mock-step1-next'));
  return { ...res, onSave };
}

describe('LocationWizard step 2 details', () => {
  it('offers street name, landmark and notes fields', async () => {
    const { getByTestId } = await openStep2(SAVED);
    expect(getByTestId('location-street-input')).toBeTruthy();
    expect(getByTestId('location-landmark-input')).toBeTruthy();
    expect(getByTestId('location-notes-input')).toBeTruthy();
  });

  it('prefills them when editing a saved place', async () => {
    const { getByTestId } = await openStep2(SAVED);
    expect(getByTestId('location-street-input').props.value).toBe('Rizal Street');
    expect(getByTestId('location-landmark-input').props.value).toBe('Blue gate beside the chapel');
    expect(getByTestId('location-notes-input').props.value).toBe('Call when outside');
  });

  it('saves them trimmed, and sends a blank one as null', async () => {
    const { getByTestId, onSave } = await openStep2({
      ...SAVED,
      streetName: null,
      landmark: null,
      notes: null,
    });

    await fireEvent.changeText(getByTestId('location-street-input'), '  Bonifacio Street ');
    await fireEvent.changeText(getByTestId('location-landmark-input'), 'Across the water station');
    await fireEvent.changeText(getByTestId('location-notes-input'), '   ');
    await fireEvent.press(getByTestId('location-save-button'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Home',
        address: 'Purok 5, Poblacion',
        streetName: 'Bonifacio Street',
        landmark: 'Across the water station',
        notes: null,
      })
    );
  });

  it('lets an edit clear a detail again', async () => {
    const { getByTestId, onSave } = await openStep2(SAVED);
    await fireEvent.changeText(getByTestId('location-landmark-input'), '');
    await fireEvent.press(getByTestId('location-save-button'));

    const payload = onSave.mock.calls[0][0];
    expect(payload.landmark).toBeNull();
    // Untouched fields are re-sent as they were, not dropped.
    expect(payload.streetName).toBe('Rizal Street');
    expect(payload.notes).toBe('Call when outside');
  });

  it('saves a place with none of them filled in', async () => {
    const { getByTestId, onSave } = await openStep2({
      ...SAVED,
      streetName: null,
      landmark: null,
      notes: null,
    });
    await fireEvent.press(getByTestId('location-save-button'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ streetName: null, landmark: null, notes: null })
    );
  });
});

describe('LocationWizard and Android back', () => {
  it('leaves Back to a screen in front of Saved Locations, and steps back while in front', async () => {
    // A chat opened from a push sits on top of Saved Locations while this
    // listener stays registered and is asked first. It used to step the hidden
    // wizard back (or drop the draft) and leave the chat open (2026-11-06).
    const { BackHandler } = require('react-native');
    const nav = require('@react-navigation/native');
    let inFront = false;
    const navSpy = jest.spyOn(nav, 'useNavigation').mockReturnValue({ isFocused: () => inFront });
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    try {
      const onCancel = jest.fn();
      const res: any = await render(
        <LocationWizard
          initialValues={SAVED}
          saving={false}
          gpsLoading={false}
          onUseCurrentLocation={async () => PIN}
          onSave={jest.fn()}
          onCancel={onCancel}
        />
      );
      await fireEvent.press(res.getByTestId('mock-step1-next'));
      expect(res.getByTestId('location-street-input')).toBeTruthy();
      const handler = () => (spy.mock.calls.filter((args: any[]) => args[0] === 'hardwareBackPress').at(-1)![1] as () => boolean)();

      let handled: boolean | undefined;
      await act(async () => {
        handled = handler();
      });
      expect(handled).toBe(false);
      expect(res.getByTestId('location-street-input')).toBeTruthy(); // still on step 2
      expect(onCancel).not.toHaveBeenCalled();

      inFront = true;
      await act(async () => {
        handled = handler();
      });
      expect(handled).toBe(true);
      expect(res.queryByTestId('location-street-input')).toBeNull(); // back to step 1
    } finally {
      spy.mockRestore();
      navSpy.mockRestore();
    }
  });
});
