import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableBentoMosaic, {
  STORAGE_KEY_BENTO_ORDER,
} from '../components/DraggableBentoMosaic';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

const mockCategories = [
  { id: 1, name: 'Supermarket & Grocery', status: 'Active' },
  { id: 2, name: 'Pharmacy & Health', status: 'Active' },
  { id: 3, name: 'Bakery & Pastries', status: 'Active' },
  { id: 4, name: 'Food & Restaurant', status: 'Active' },
  { id: 5, name: 'Retail & General Merchandise', status: 'Active' },
];

const mockCategoryImages = {
  1: 'https://images.unsplash.com/photo-1542838132-92c53300491e',
  2: 'https://images.unsplash.com/photo-1585435557343-3b092031a831',
  3: 'https://images.unsplash.com/photo-1509440159596-0249088772ff',
  4: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
  5: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da',
};

const mockColors = {
  primary: '#F62459',
  card: '#FFFFFF',
  textDark: '#0B132B',
  textGray: '#64748B',
  border: '#E2E8F0',
};

describe('DraggableBentoMosaic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 5 category tiles and See More button correctly', async () => {
    const onTilePress = jest.fn();
    const onSeeMorePress = jest.fn();

    const res: any = await render(
      <DraggableBentoMosaic
        categories={mockCategories}
        categoryImages={mockCategoryImages}
        pairSlotWidth={160}
        contentWidth={330}
        colors={mockColors}
        isDark={false}
        onTilePress={onTilePress}
        onSeeMorePress={onSeeMorePress}
      />
    );

    expect(res.getByTestId('category-btn-malls')).toBeTruthy();
    expect(res.getByTestId('category-btn-pharmacy')).toBeTruthy();
    expect(res.getByTestId('category-btn-bakery')).toBeTruthy();
    expect(res.getByTestId('category-btn-restaurant')).toBeTruthy();
    expect(res.getByTestId('category-btn-retail')).toBeTruthy();
    expect(res.getByTestId('category-btn-see_more')).toBeTruthy();
  });

  it('triggers onTilePress when a category tile is tapped', async () => {
    const onTilePress = jest.fn();
    const onSeeMorePress = jest.fn();

    const res: any = await render(
      <DraggableBentoMosaic
        categories={mockCategories}
        categoryImages={mockCategoryImages}
        pairSlotWidth={160}
        contentWidth={330}
        colors={mockColors}
        isDark={false}
        onTilePress={onTilePress}
        onSeeMorePress={onSeeMorePress}
      />
    );

    await fireEvent.press(res.getByTestId('category-btn-pharmacy'));
    expect(onTilePress).toHaveBeenCalledTimes(1);
    expect(onTilePress).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pharmacy',
        categoryParam: 'Pharmacy & Health',
      })
    );
  });

  it('triggers onSeeMorePress when See More tile is tapped', async () => {
    const onTilePress = jest.fn();
    const onSeeMorePress = jest.fn();

    const res: any = await render(
      <DraggableBentoMosaic
        categories={mockCategories}
        categoryImages={mockCategoryImages}
        pairSlotWidth={160}
        contentWidth={330}
        colors={mockColors}
        isDark={false}
        onTilePress={onTilePress}
        onSeeMorePress={onSeeMorePress}
      />
    );

    await fireEvent.press(res.getByTestId('category-btn-see_more'));
    expect(onSeeMorePress).toHaveBeenCalledTimes(1);
  });

  it('loads saved custom order from AsyncStorage on mount and displays reset button', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(['pharmacy', 'bakery', 'restaurant', 'malls', 'retail'])
    );

    const res: any = await render(
      <DraggableBentoMosaic
        categories={mockCategories}
        categoryImages={mockCategoryImages}
        pairSlotWidth={160}
        contentWidth={330}
        colors={mockColors}
        isDark={false}
        onTilePress={jest.fn()}
        onSeeMorePress={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(res.getByText('Personalized layout')).toBeTruthy();
      expect(res.getByText('Reset')).toBeTruthy();
    });

    // Tap reset button
    await fireEvent.press(res.getByText('Reset'));

    await waitFor(() => {
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY_BENTO_ORDER);
      expect(res.queryByText('Personalized layout')).toBeNull();
    });
  });

  it('activates drag mode on long press and locks parent scroll', async () => {
    const onScrollLockChange = jest.fn();

    const res: any = await render(
      <DraggableBentoMosaic
        categories={mockCategories}
        categoryImages={mockCategoryImages}
        pairSlotWidth={160}
        contentWidth={330}
        colors={mockColors}
        isDark={false}
        onTilePress={jest.fn()}
        onSeeMorePress={jest.fn()}
        onScrollLockChange={onScrollLockChange}
      />
    );

    await fireEvent(res.getByTestId('category-btn-malls'), 'longPress', {
      nativeEvent: { pageX: 50, pageY: 100 },
    });

    await waitFor(() => {
      expect(onScrollLockChange).toHaveBeenCalledWith(true);
      expect(res.getByText(/Dragging Malls & Grocery/)).toBeTruthy();
    });
  });
});
