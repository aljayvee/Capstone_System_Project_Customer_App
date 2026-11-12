import React from 'react';
import { AccessibilityInfo, AppState, AppStateStatus, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import KuyaSugoMascot from '../components/KuyaSugoMascot';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Image: (props: any) => React.createElement(View, props) };
});
jest.mock('../../assets/mascot/kuya-sugo-chibi-hello.webp', () => 101);
jest.mock('../../assets/mascot/kuya-sugo-chibi-hello-wave.png', () => 102);
jest.mock('../../assets/mascot/kuya-sugo-story.webp', () => 103);
jest.mock('../../assets/mascot/kuya-sugo-story-thumbs-up.png', () => 104);

const mockFocusListeners: Record<string, () => void> = {};
const mockNavigation = {
  isFocused: () => true,
  addListener: (name: string, listener: () => void) => {
    mockFocusListeners[name] = listener;
    return jest.fn();
  },
};
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));

describe('KuyaSugoMascot playback', () => {
  let appListener: (state: AppStateStatus) => void;
  let motionListener: (enabled: boolean) => void;
  beforeEach(() => {
    AppState.currentState = 'active';
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: string, listener: unknown) => {
      motionListener = listener as (enabled: boolean) => void;
      return { remove: jest.fn() };
    }) as unknown as typeof AccessibilityInfo.addEventListener);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appListener = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps the still portrait until the motion preference is known', async () => {
    let resolvePreference: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(resolve => { resolvePreference = resolve; }));
    const view = await render(<KuyaSugoMascot />);
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(102);
    await act(() => resolvePreference(false));
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(101);
  });

  it('uses the still portrait when reduced motion is requested', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const view = await render(<KuyaSugoMascot />);
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(false);
    await act(() => motionListener(false));
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true);
    await act(() => motionListener(true));
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(102);
  });

  it('stops playback when the screen blurs or the app is backgrounded', async () => {
    const view = await render(<KuyaSugoMascot />);
    await waitFor(() => expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true));
    await act(() => mockFocusListeners.blur());
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(false);
    await act(() => mockFocusListeners.focus());
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true);
    await act(() => appListener('background'));
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(102);
    await act(() => appListener('active'));
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true);
  });

  it('falls back to a local still if the animated asset cannot be decoded', async () => {
    const view = await render(<KuyaSugoMascot />);
    await waitFor(() => expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(101));
    await fireEvent(view.getByTestId('kuya-sugo-mascot'), 'error', { error: 'decode failed' });
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(102);
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(false);
  });

  it('replays wave action when tapped', async () => {
    const onPress = jest.fn();
    const view = await render(<KuyaSugoMascot action="wave" interactive onPress={onPress} />);
    await waitFor(() => expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true));
    await act(() => fireEvent.press(view.getByTestId('kuya-sugo-mascot')));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true);
  });

  it('plays the delivery story across a full-width lane with no tap target', async () => {
    const view = await render(<KuyaSugoMascot action="delivery" height={100} />);
    await waitFor(() => expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(103));
    expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true);
    expect(StyleSheet.flatten(view.getByTestId('kuya-sugo-lane').props.style)).toMatchObject({ width: '100%', height: 100 });
    expect(view.queryByRole('button')).toBeNull();
  });

  it('leaves the lane empty until the motion preference is known, so the still never flashes first', async () => {
    let resolvePreference: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(resolve => { resolvePreference = resolve; }));
    const view = await render(<KuyaSugoMascot action="delivery" />);
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBeNull();
    await act(() => resolvePreference(false));
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(103);
  });

  it('shows the thumbs-up still for reduced motion and while the screen is away', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const view = await render(<KuyaSugoMascot action="delivery" />);
    await waitFor(() => expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(104));
    await act(() => motionListener(false));
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(103);
    await act(() => mockFocusListeners.blur());
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(104);
    await act(() => mockFocusListeners.focus());
    expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(103);
  });

  it('keeps the wave clip for every other action', async () => {
    const view = await render(<KuyaSugoMascot action="greeting" height={140} />);
    await waitFor(() => expect(view.getByTestId('kuya-sugo-mascot').props.source).toBe(101));
    expect(StyleSheet.flatten(view.getByRole('button').props.style)).toMatchObject({ height: 140, width: 120 });
  });

  it('throttles rapid consecutive taps to prevent visual churn', async () => {
    const onPress = jest.fn();
    const view = await render(<KuyaSugoMascot action="wave" interactive onPress={onPress} />);
    await waitFor(() => expect(view.getByTestId('kuya-sugo-mascot').props.autoplay).toBe(true));
    await act(() => {
      fireEvent.press(view.getByTestId('kuya-sugo-mascot'));
      fireEvent.press(view.getByTestId('kuya-sugo-mascot'));
      fireEvent.press(view.getByTestId('kuya-sugo-mascot'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
