import React, { type RefObject } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bike } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { LiquidGlass } from '../glass/LiquidGlass';
import { FontFamily, Spacing } from '../../config/theme';

/** The floating bottom bar's height (components/BottomNav.tsx floatingCapsule). */
const BOTTOM_NAV_HEIGHT = 68;
const SIZE = 60;

/**
 * Home's way to the customer's active errands (2026-10-10; a card at the top of
 * Home before): a round liquid glass button floating above the bottom bar's
 * right end, with how many errands are active on it. It opens Active Errands.
 * Home leaves it out when nothing is active.
 *
 * `blurTarget` is Home's content, so the glass blurs what scrolls under it on
 * Android too (components/glass/LiquidGlass.tsx).
 */
export function ActiveErrandsFab({
  count,
  onPress,
  blurTarget,
}: {
  count: number;
  onPress: () => void;
  blurTarget?: RefObject<View | null>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColor();
  if (count <= 0) return null;
  const label = `${count} active ${count === 1 ? 'errand' : 'errands'}`;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.slot, { bottom: Math.max(insets.bottom, 12) + BOTTOM_NAV_HEIGHT + 14 }]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Open your active errands`}
        testID="active-errands-fab"
      >
        {/* Liquid, not frosted, glass (2026-10-11): the page shows through. */}
        <LiquidGlass radius={SIZE / 2} blurTarget={blurTarget} clarity="liquid" contentStyle={styles.face}>
          <Bike size={26} color={colors.primary} strokeWidth={2.3} />
        </LiquidGlass>
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.bgApp }]} testID="active-errands-fab-count">
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.1}>
            {count > 9 ? '9+' : String(count)}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    right: Spacing.md + 2,
    zIndex: 50,
  },
  face: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A status count on an action dome: the one place a full circle belongs.
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
  },
});
