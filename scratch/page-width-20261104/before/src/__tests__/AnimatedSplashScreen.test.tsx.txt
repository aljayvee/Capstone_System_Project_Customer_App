import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react-native';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';
import { ThemeProvider } from '../context/ThemeContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('AnimatedSplashScreen component', () => {
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('renders brand wordmark and tagline', async () => {
    const onComplete = jest.fn();
    const res: any = await render(
      <ThemeProvider>
        <AnimatedSplashScreen isAppReady={false} onAnimationComplete={onComplete} />
      </ThemeProvider>
    );

    expect(res.getByText('SUGO EXPRESS')).toBeTruthy();
    expect(res.getByText('Fast & Reliable Local Errands')).toBeTruthy();
    expect(res.getByText('Tacurong City Logistics')).toBeTruthy();
  });

  it('completes the animated dismissal workflow when app is ready', async () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    await render(
      <ThemeProvider>
        <AnimatedSplashScreen isAppReady={true} onAnimationComplete={onComplete} />
      </ThemeProvider>
    );

    // Advance 1400ms min perception threshold
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    // Advance 280ms exit animation
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('does not prematurely dismiss splash screen when isAppReady is false to prevent screen flash', async () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    await render(
      <ThemeProvider>
        <AnimatedSplashScreen isAppReady={false} onAnimationComplete={onComplete} />
      </ThemeProvider>
    );

    // Advance past 3500ms timeout
    await act(async () => {
      jest.advanceTimersByTime(3600);
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onFirstFrame when rendered to release blank system splash', async () => {
    const onFirstFrame = jest.fn();
    const res: any = await render(
      <ThemeProvider>
        <AnimatedSplashScreen
          isAppReady={false}
          onAnimationComplete={jest.fn()}
          onFirstFrame={onFirstFrame}
        />
      </ThemeProvider>
    );

    expect(onFirstFrame).not.toHaveBeenCalled();

    const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } };
    await act(async () => {
      fireEvent(res.getByTestId('animated-splash'), 'layout', layout);
      fireEvent(res.getByTestId('animated-splash'), 'layout', layout);
    });
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
  });
});
