import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, Spacing, BorderRadius, Shadows, FontFamily } from '../config/theme';

export interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
  unboxed?: boolean;
}

export default function SettingsSection({ title, children, unboxed = false }: SettingsSectionProps) {
  const { colors } = useThemeColor();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.container}>
      {title ? <Text accessibilityRole="header" maxFontSizeMultiplier={unboxed ? PortalFontSizeMultipliers.subheading : PortalFontSizeMultipliers.body} style={[unboxed ? styles.heading : styles.caption, { color: unboxed ? colors.textDark : colors.textGray }]}>{unboxed ? title : title.toUpperCase()}</Text> : null}
      <View style={unboxed ? undefined : [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
        {items.map((child, index) => (
          <React.Fragment key={index}>
            {child}
            {index < items.length - 1 && <View style={[styles.divider, unboxed && styles.unboxedDivider, { backgroundColor: colors.border }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.xl },
  heading: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    marginBottom: Spacing.sm,
  },
  unboxedDivider: { height: StyleSheet.hairlineWidth, marginLeft: 0 },
  caption: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  divider: { height: 1, marginLeft: Spacing.lg + 34 + Spacing.md },
});
