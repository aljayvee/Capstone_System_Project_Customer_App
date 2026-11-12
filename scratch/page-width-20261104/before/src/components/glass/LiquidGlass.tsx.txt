import React, { type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColor } from '../../hooks/useThemeColor';

/**
 * How clear the glass is.
 *  - `frosted`: a strong blur under a milky tint. Content cards, where the text
 *    on the glass has to read over anything.
 *  - `liquid` (2026-10-11, the active errands button and the bottom bar in light
 *    mode): mostly clear. A light blur, a thin tint, a bright rim, a specular
 *    sheen from the top edge and a glow along the bottom edge where light bends
 *    through it, so the page shows through as through water, not frosted glass.
 */
export type GlassClarity = 'frosted' | 'liquid';

/** A clear rim reads as an edge on the grey page: white on top, a slate hairline below. */
export function glassRim(isDark: boolean, clarity: GlassClarity) {
  if (isDark) {
    return { borderColor: 'rgba(255, 255, 255, 0.14)', borderTopColor: 'rgba(255, 255, 255, 0.30)' };
  }
  return clarity === 'liquid'
    ? {
        borderColor: 'rgba(255, 255, 255, 0.80)',
        borderTopColor: 'rgba(255, 255, 255, 1)',
        borderBottomColor: 'rgba(15, 23, 42, 0.12)',
      }
    : { borderColor: 'rgba(15, 23, 42, 0.14)', borderTopColor: 'rgba(255, 255, 255, 0.95)' };
}

/**
 * The glass itself, behind a surface's content: blur, tint, top sheen and, for
 * liquid glass, the bottom glow. Fills its parent, which clips it to its corners.
 * Shared by LiquidGlass and the floating bottom bar, so the two always match.
 *
 * The blur is real on iOS. On Android it is real only with `blurTarget`, a ref
 * to a BlurTargetView holding what lies behind the glass (expo-blur's rule);
 * without one there is no blur pass and the tint is thicker, so what sits on
 * the glass still reads.
 */
export function GlassLayers({
  clarity = 'frosted',
  blurTarget,
  intensity,
  testID,
}: {
  clarity?: GlassClarity;
  blurTarget?: RefObject<View | null>;
  intensity?: number;
  testID?: string;
}) {
  const { isDark } = useThemeColor();
  const blurs = Platform.OS !== 'android' || Boolean(blurTarget);
  const liquid = clarity === 'liquid' && !isDark;

  const tint = isDark
    ? blurs
      ? 'rgba(20, 20, 22, 0.55)'
      : 'rgba(20, 20, 22, 0.90)'
    : liquid
    ? // Enough to keep labels on the glass legible over a store photo (2026-10-11:
      // at 0.22 / 0.50 the bottom bar's grey labels vanished on images).
      blurs
      ? 'rgba(255, 255, 255, 0.42)'
      : 'rgba(255, 255, 255, 0.78)'
    : blurs
    ? 'rgba(255, 255, 255, 0.55)'
    : 'rgba(255, 255, 255, 0.86)';

  return (
    <>
      {blurs ? (
        <BlurView
          intensity={intensity ?? (liquid ? 30 : 40)}
          // Android divides the intensity by this (4 by default): liquid glass at
          // 14 blurred by about 3, which left photos sharp behind the labels.
          blurReductionFactor={liquid ? 2 : undefined}
          tint={isDark ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTarget}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/* The tint: lighter when the blur is doing the work. */}
      <View
        pointerEvents="none"
        testID={testID ? `${testID}-tint` : 'liquid-glass-tint'}
        style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
      />
      {/* The specular sheen along the top edge. */}
      <LinearGradient
        pointerEvents="none"
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0)']
            : liquid
            ? ['rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0)']
            : ['rgba(255, 255, 255, 0.75)', 'rgba(255, 255, 255, 0)']
        }
        locations={liquid ? [0, 0.45] : [0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      {/* Liquid glass only: light gathering along the bottom edge, as through a lens. */}
      {liquid ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.38)']}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </>
  );
}

/**
 * A glass surface (2026-10-10), in the same recipe as the floating bottom bar
 * and Home's search bar: the glass (GlassLayers), a crisp rim with a bright top
 * edge, and a deep shadow so it holds its shape on the page.
 *
 * The shadow sits on an outer view and the clipping on an inner one: a view
 * that clips its corners on iOS also clips its own shadow.
 */
export function LiquidGlass({
  radius,
  style,
  contentStyle,
  blurTarget,
  intensity,
  elevated = true,
  clarity = 'frosted',
  children,
  testID,
}: {
  radius: number;
  /** The outer view: size, position, margins. */
  style?: StyleProp<ViewStyle>;
  /** The inner view the children sit in: padding, layout. */
  contentStyle?: StyleProp<ViewStyle>;
  blurTarget?: RefObject<View | null>;
  intensity?: number;
  /** The deep drop shadow of a floating surface. */
  elevated?: boolean;
  clarity?: GlassClarity;
  children?: React.ReactNode;
  testID?: string;
}) {
  const { isDark } = useThemeColor();

  return (
    <View
      style={[
        { borderRadius: radius },
        elevated && {
          shadowColor: isDark ? '#000000' : '#0F172A',
          shadowOpacity: isDark ? 0.45 : clarity === 'liquid' ? 0.12 : 0.16,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: isDark ? 14 : 12,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={[styles.clip, { borderRadius: radius }, glassRim(isDark, clarity)]}>
        <GlassLayers clarity={clarity} blurTarget={blurTarget} intensity={intensity} testID={testID} />
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
