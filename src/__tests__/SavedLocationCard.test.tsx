import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import SavedLocationCard from '../screens/location/SavedLocationCard';
import type { SavedLocation } from '../screens/location/types';

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    colors: {
      card: '#FFFFFF',
      border: '#E2E8F0',
      primary: '#F62459',
      primaryLight: '#FFF0F3',
      textDark: '#0B132B',
      textGray: '#64748B',
      textMedium: '#334155',
      bgGray: '#F1F5F9',
      danger: '#EF4444',
      dangerBg: '#FEE2E2',
    },
    isDark: false,
  }),
}));

const NON_DEFAULT_LOC: SavedLocation = {
  id: 1,
  userId: 10,
  label: 'Office',
  address: 'National Highway, Tacurong City',
  streetName: 'Rizal Ave',
  landmark: 'Near City Hall',
  latitude: 6.691,
  longitude: 124.681,
  isDefault: false,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const DEFAULT_LOC: SavedLocation = {
  id: 2,
  userId: 10,
  label: 'Home',
  address: 'Purok 5, Poblacion, Tacurong City',
  streetName: 'Mabini St',
  landmark: 'Green gate',
  latitude: 6.695,
  longitude: 124.685,
  isDefault: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('SavedLocationCard Component', () => {
  it('calls onSetDefault when non-default card is tapped', async () => {
    const onSetDefault = jest.fn();

    const res: any = await render(
      <SavedLocationCard
        location={NON_DEFAULT_LOC}
        onSetDefault={onSetDefault}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    // Verify Default badge is NOT rendered
    expect(res.queryByText('Default')).toBeNull();

    // Tap the card content to make it default
    const cardSelect = res.getByTestId('saved-location-select-1');
    fireEvent.press(cardSelect);
    expect(onSetDefault).toHaveBeenCalledWith(NON_DEFAULT_LOC);
  });

  it('calls onEdit when edit button is pressed', async () => {
    const onEdit = jest.fn();

    const res: any = await render(
      <SavedLocationCard
        location={NON_DEFAULT_LOC}
        onSetDefault={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
      />
    );

    const editBtn = res.getByTestId('edit-location-1');
    fireEvent.press(editBtn);
    expect(onEdit).toHaveBeenCalledWith(NON_DEFAULT_LOC);
  });

  it('calls onDelete when delete button is pressed', async () => {
    const onDelete = jest.fn();

    const res: any = await render(
      <SavedLocationCard
        location={NON_DEFAULT_LOC}
        onSetDefault={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
      />
    );

    const deleteBtn = res.getByTestId('delete-location-1');
    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(NON_DEFAULT_LOC);
  });

  it('renders Default badge and does not call onSetDefault when already default', async () => {
    const onSetDefault = jest.fn();

    const res: any = await render(
      <SavedLocationCard
        location={DEFAULT_LOC}
        onSetDefault={onSetDefault}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    // Verify Default badge is rendered
    expect(res.getByTestId('saved-location-default-badge-2')).toBeTruthy();

    // Tap the card - should NOT trigger onSetDefault since it is already default
    const cardSelect = res.getByTestId('saved-location-select-2');
    fireEvent.press(cardSelect);
    expect(onSetDefault).not.toHaveBeenCalled();
  });
});
