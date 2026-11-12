import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Store } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontFamily,
  BorderRadius,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';

export type StoreMode = 'merchant' | 'location';

const OPTIONS: Array<{ mode: StoreMode; label: string; Icon: typeof Store }> = [
  { mode: 'merchant', label: 'Merchant', Icon: Store },
  { mode: 'location', label: 'Location', Icon: MapPin },
];

/**
 * Step 1's two ways to say where to shop: a kind of store (Merchant), and the
 * dispatcher picks the shop; or the actual shops (Location), which reach the
 * dispatcher already pinned.
 */
export default function StoreModeToggle({ mode, onChange }: { mode: StoreMode; onChange: (mode: StoreMode) => void }) {
  const { colors, isDark } = useThemeColor();
  return (
    <View
      style={[styles.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray, borderColor: colors.border }]}
      accessibilityRole="tablist"
      testID="store-mode-toggle"
    >
      {OPTIONS.map(({ mode: option, label, Icon }) => {
        const selected = mode === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.option, selected ? { backgroundColor: colors.primary } : null]}
            onPress={() => onChange(option)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            testID={`store-mode-${option}`}
          >
            <Icon size={16} color={selected ? '#FFFFFF' : colors.textGray} strokeWidth={2.2} />
            <Text
              style={[styles.label, { color: selected ? '#FFFFFF' : colors.textDark }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 14,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: PortalTouchTargets.compact,
    borderRadius: BorderRadius.sm,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.25),
  },
});
