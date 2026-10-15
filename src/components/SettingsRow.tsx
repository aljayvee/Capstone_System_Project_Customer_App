import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, Spacing, BorderRadius, FontFamily } from '../config/theme';

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
}: SettingsRowProps) {
  const { colors, isDark } = useThemeColor();

  const content = (
    <View style={styles.row}>
      <View
        style={[
          styles.iconBadge,
          {
            backgroundColor: destructive
              ? (isDark ? 'rgba(239, 68, 68, 0.15)' : colors.dangerBg)
              : (isDark ? 'rgba(255, 255, 255, 0.06)' : colors.bgGray),
          },
        ]}
      >
        <Icon size={18} color={destructive ? colors.danger : (isDark ? colors.textDark : colors.textMedium)} strokeWidth={2.2} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: destructive ? colors.danger : colors.textDark }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textGray }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badgeContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.bgGray }]}>
          <Text style={[styles.badgeText, { color: colors.textDark }]}>{badge}</Text>
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
  label: { fontFamily: FontFamily.semibold, fontSize: FontSizes.md },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, marginTop: 2, lineHeight: 16 },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  badgeText: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  disabled: { opacity: 0.5 },
});

