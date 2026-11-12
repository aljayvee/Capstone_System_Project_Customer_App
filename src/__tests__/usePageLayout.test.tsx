import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { renderHook } from '@testing-library/react-native';
import { usePageLayout } from '../hooks/usePageLayout';

// Expo rewrites RN imports to this module, so mock the shared implementation.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const dimensions = require('react-native/Libraries/Utilities/useWindowDimensions').default as jest.Mock;

const metrics = {
  frame: { x: 0, y: 0, width: 360, height: 800 },
  insets: { left: 9, right: 21, top: 24, bottom: 16 },
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
);

describe('page layout style ownership', () => {
  afterEach(() => jest.clearAllMocks());

  it('positions a phone frame inside asymmetric safe areas and gives nested content only a gutter', async () => {
    dimensions.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
    const { result } = await renderHook(() => usePageLayout(), { wrapper });
    expect(result.current.frameStyle).toMatchObject({ width: 330, marginLeft: 9, marginRight: 21 });
    expect(result.current.gutterStyle).toEqual({ paddingHorizontal: 12 });
    expect(result.current.contentWidth).toBe(306);
    expect(result.current.insetStyle).toEqual({ paddingLeft: 21, paddingRight: 33 });
    expect(result.current.bleedStyle).toEqual({ marginHorizontal: -12 });
  });

  it('does not consume safe areas again inside a horizontal SafeAreaView', async () => {
    dimensions.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
    const { result } = await renderHook(() => usePageLayout({ horizontalSafeAreaApplied: true }), { wrapper });
    expect(result.current.frameStyle).toMatchObject({ width: 330, marginLeft: 0, marginRight: 0 });
    expect(result.current.contentWidth).toBe(306);
    expect(result.current.safeAreaFrameStyle).toEqual({ width: '100%', maxWidth: '100%', alignSelf: 'stretch' });
    expect(result.current.insetStyle).toEqual({ paddingLeft: 12, paddingRight: 12 });
  });

  it('removes phone overrides when the viewport becomes a tablet', async () => {
    dimensions.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
    const { result, rerender } = await renderHook(() => usePageLayout({ tabletGutter: 24 }), { wrapper });
    expect(result.current.gutterStyle).toBeDefined();
    dimensions.mockReturnValue({ width: 800, height: 1024, scale: 2, fontScale: 1 });
    await rerender(undefined);
    expect(result.current.frameWidth).toBe(580);
    expect(result.current.contentWidth).toBe(532);
    for (const key of ['frameStyle', 'gutterStyle', 'safeAreaFrameStyle', 'insetStyle', 'bleedStyle', 'contentStyle'] as const) {
      expect(result.current[key]).toBeUndefined();
    }
  });
});
