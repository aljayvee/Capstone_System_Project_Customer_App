import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, FontWeights, Spacing, BorderRadius, Shadows, FontFamily } from '../config/theme';

export interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export default function SettingsSection({ title, children }: SettingsSectionProps) {
  const { colors } = useThemeColor();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.caption, { color: colors.textGray }]}>{title.toUpperCase()}</Text> : null}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
        {items.map((child, index) => (
          <React.Fragment key={index}>
            {child}
            {index < items.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.xl },
  caption: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
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
