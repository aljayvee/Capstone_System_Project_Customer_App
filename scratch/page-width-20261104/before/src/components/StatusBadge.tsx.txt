import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, BorderRadius, FontFamily } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';

export default function StatusBadge({ status, readable = false }: { status: string; readable?: boolean }) {
  const { colors } = useThemeColor();
  const normStatus = String(status || 'PENDING').toUpperCase();

  let bg: string = colors.warningBg;
  let color: string = colors.warning;
  let label = normStatus;

  if (normStatus === 'DELIVERED' || normStatus === 'COMPLETED') {
    bg = colors.successBg;
    color = colors.success;
    label = 'Delivered';
  } else if (normStatus === 'IN_TRANSIT' || normStatus === 'IN ROUTE') {
    bg = colors.infoBg;
    color = colors.info;
    label = 'In Transit';
  } else if (normStatus === 'ASSIGNED') {
    bg = colors.infoBg;
    color = colors.info;
    label = 'Assigned';
  } else if (normStatus === 'PENDING' || normStatus === 'AVAILABLE') {
    bg = readable ? colors.warningBg : colors.primaryLight;
    color = readable ? colors.warning : colors.primaryDark;
    label = 'Pending';
  } else if (normStatus === 'CANCELLED') {
    bg = colors.dangerBg;
    color = colors.danger;
    label = 'Cancelled';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, readable && { fontSize: scaledPortalFontSize(PortalFontSizes.caption), lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label') }, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  text: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'),
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    fontFamily: FontFamily.bold,
  },
});
