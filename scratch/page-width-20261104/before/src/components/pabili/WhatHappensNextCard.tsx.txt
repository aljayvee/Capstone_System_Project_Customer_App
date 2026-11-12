import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  Shadows,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalFontSizeMultipliers,
} from '../../config/theme';

/** The three steps after Send, shown beside the button that starts them. */
export default function WhatHappensNextCard() {
  const { colors, isDark } = useThemeColor();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
      <View style={[styles.halo, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFF0F5' }]}>
        <ShieldCheck size={20} color={colors.primary} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
          What happens next
        </Text>
        <Text style={[styles.body, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
          1. A dispatcher checks your list and sends it back with the delivery fee.{'\n'}
          2. You approve it and choose how to pay, in the chat.{'\n'}
          3. Your rider buys the items and keeps the store receipts.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  halo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.caption), marginBottom: 2 },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
  },
});
