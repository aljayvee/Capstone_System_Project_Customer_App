import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, Spacing, BorderRadius, FontFamily } from '../config/theme';

export interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  badge?: string;
  chevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  unboxed?: boolean;
}

export default function SettingsRow({
  icon: Icon,
  label,
  subtitle,
  trailing,
  badge,
  chevron = false,
  destructive = false,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
  unboxed = false,
}: SettingsRowProps) {
  const { colors, isDark } = useThemeColor();

  const content = (
    <View style={[styles.row, unboxed && styles.unboxedRow]}>
      <View
        style={[
          styles.iconBadge,
          unboxed ? styles.unboxedIcon : {
            backgroundColor: destructive
              ? (isDark ? 'rgba(239, 68, 68, 0.15)' : colors.dangerBg)
              : (isDark ? 'rgba(255, 255, 255, 0.06)' : colors.bgGray),
          },
        ]}
      >
        <Icon size={unboxed ? 17 : 18} color={destructive ? colors.danger : unboxed ? colors.textGray : (isDark ? colors.textDark : colors.textMedium)} strokeWidth={unboxed ? 1.7 : 2.2} />
      </View>
      <View style={styles.textCol}>
        <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.label, unboxed && styles.unboxedLabel, { color: destructive ? colors.danger : colors.textDark }]}>{label}</Text>
        {subtitle ? (
          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.subtitle, unboxed && styles.unboxedSubtitle, { color: colors.textGray }]} numberOfLines={unboxed ? undefined : 2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badgeContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.bgGray }]}>
          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.badgeText, { color: colors.textDark }]}>{badge}</Text>
        </View>
      ) : null}
      {trailing}
      {chevron && !trailing ? (
        <ChevronRight size={16} color={colors.textLight} />
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={disabled ? styles.disabled : undefined}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 52,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textCol: { flex: 1 },
  unboxedRow: { paddingHorizontal: 0, paddingVertical: Spacing.lg, minHeight: 76 },
  unboxedIcon: { width: 24, height: 24, borderRadius: 0 },
  unboxedLabel: { fontFamily: FontFamily.medium },
  unboxedSubtitle: {
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
  },
  label: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'), fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  subtitle: { fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.caption), marginTop: 2, lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label') },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  badgeText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'),
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    letterSpacing: 0.2,
  },
  disabled: { opacity: 0.5 },
});

