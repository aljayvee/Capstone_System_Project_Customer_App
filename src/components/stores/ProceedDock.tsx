import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../../config/theme';

/** "Proceed with this store (1)", "Proceed with these stores (2)". */
export function proceedLabel(count: number): string {
  return count === 1 ? 'Proceed with this store (1)' : `Proceed with these stores (${count})`;
}

/**
 * The bar along the bottom of the two screens where up to 3 stores are picked,
 * Find stores and Popular Stores (2026-10-10): nothing until a store is picked,
 * then one button that goes on to the Shopping list with them.
 *
 * Pads for the phone's navigation bar itself (`insets.bottom`), so the screen
 * around it leaves the bottom edge to it.
 */
export function ProceedDock({
  count,
  onProceed,
  testID,
  onLayout,
  bottomPadding,
}: {
  count: number;
  onProceed: () => void;
  /** The button's test id. */
  testID: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * Room under the button, in place of the phone's navigation bar: Find
   * stores as a tab (2026-10-14) keeps it clear of the floating bottom bar.
   */
  bottomPadding?: number;
}) {
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  if (count <= 0) return null;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.dock,
        {
          backgroundColor: colors.bgAppTranslucent,
          borderTopColor: colors.border,
          paddingBottom: bottomPadding ?? (insets.bottom > 0 ? insets.bottom : Spacing.md),
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onProceed}
        accessibilityRole="button"
        testID={testID}
      >
        <Text style={styles.buttonText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
          {proceedLabel(count)}
        </Text>
        <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 1.25),
  },
});
