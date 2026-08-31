import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, FontWeights, Spacing, BorderRadius, FontFamily } from '../config/theme';

export interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  trailing?: React.ReactNode;
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
              : (isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight),
          },
        ]}
      >
        <Icon size={18} color={destructive ? colors.danger : colors.primary} strokeWidth={2.2} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: destructive ? colors.danger : colors.textDark }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textGray }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
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
  disabled: { opacity: 0.5 },
});
