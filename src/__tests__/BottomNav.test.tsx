import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react-native';
import BottomNav, { type PortalTab } from '../components/BottomNav';

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: () => null,
}));

describe('BottomNav Component (Floating Liquid Frost Glass)', () => {
  const mockOnChange = jest.fn();
  const mockOnPabiliPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all 5 navigation tabs with proper testIDs and accessibility', async () => {
    const res: any = await render(
      <BottomNav
        active="home"
        onChange={mockOnChange}
        onPabiliPress={mockOnPabiliPress}
      />
    );

    expect(res.getByTestId('bottom-nav-home')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-errands')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-pabili')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-track')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-chat')).toBeTruthy();
  });

  it('calls onChange with correct tab when a standard tab is pressed', async () => {
    const res: any = await render(
      <BottomNav
        active="home"
        onChange={mockOnChange}
        onPabiliPress={mockOnPabiliPress}
      />
    );

    await fireEvent.press(res.getByTestId('bottom-nav-errands'));
    expect(mockOnChange).toHaveBeenCalledWith('errands');

    await fireEvent.press(res.getByTestId('bottom-nav-track'));
    expect(mockOnChange).toHaveBeenCalledWith('track');

    await fireEvent.press(res.getByTestId('bottom-nav-chat'));
    expect(mockOnChange).toHaveBeenCalledWith('chat');
  });

  it('calls onPabiliPress when center action disc is pressed', async () => {
    const res: any = await render(
      <BottomNav
        active="home"
        onChange={mockOnChange}
        onPabiliPress={mockOnPabiliPress}
      />
    );

    await fireEvent.press(res.getByTestId('bottom-nav-pabili'));
    expect(mockOnPabiliPress).toHaveBeenCalledTimes(1);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  // Search is a tab since 2026-10-14, so the bar stays; it used to fall back to Home.
  it('opens the Search tab when the center button is pressed without onPabiliPress', async () => {
    const res: any = await render(
      <BottomNav
        active="chat"
        onChange={mockOnChange}
      />
    );

    await fireEvent.press(res.getByTestId('bottom-nav-pabili'));
    expect(mockOnChange).toHaveBeenCalledWith('search');
  });

  it('marks Search as the open tab while Find stores is shown', async () => {
    const res: any = await render(<BottomNav active="search" onChange={mockOnChange} />);
    expect(res.getByTestId('bottom-nav-pabili').props.accessibilityState).toEqual({ selected: true });
    expect(res.getByTestId('bottom-nav-home').props.accessibilityState).toEqual({ selected: false });
  });

  it('renders tab text labels when labelsVisible is true', async () => {
    const res: any = await render(
      <BottomNav
        active="home"
        onChange={mockOnChange}
        labelsVisible={true}
      />
    );

    expect(res.getByTestId('bottom-nav-label-home')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-label-errands')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-label-pabili')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-label-pabili').props.children).toBe('Search');
    expect(res.getByTestId('bottom-nav-label-track')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-label-chat')).toBeTruthy();
  });

  it('renders correctly when labels are collapsed (labelsVisible is false)', async () => {
    const res: any = await render(
      <BottomNav
        active="errands"
        onChange={mockOnChange}
        labelsVisible={false}
      />
    );

    expect(res.getByTestId('bottom-nav-home')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-errands')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-pabili')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-track')).toBeTruthy();
    expect(res.getByTestId('bottom-nav-chat')).toBeTruthy();
  });

  it('sets pointerEvents="auto" on capsule when visible is true or default', async () => {
    const res: any = await render(
      <BottomNav
        active="home"
        onChange={mockOnChange}
        visible={true}
      />
    );

    const capsule = res.getByTestId('bottom-nav-capsule');
    expect(capsule.props.pointerEvents).toBe('auto');
  });

  it('sets pointerEvents="none" on capsule when visible is false (hiding state)', async () => {
    const res: any = await render(
      <BottomNav
        active="home"
        onChange={mockOnChange}
        visible={false}
      />
    );

    const capsule = res.getByTestId('bottom-nav-capsule');
    expect(capsule.props.pointerEvents).toBe('none');
  });
});

