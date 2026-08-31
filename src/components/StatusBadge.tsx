import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSizes, FontWeights, BorderRadius, scaledFontSize, FontFamily } from '../config/theme';

export default function StatusBadge({ status }: { status: string }) {
  const normStatus = String(status || 'PENDING').toUpperCase();

  let bg: string = Colors.warningBg;
  let color: string = Colors.warning;
  let label = normStatus;

  if (normStatus === 'DELIVERED' || normStatus === 'COMPLETED') {
    bg = Colors.successBg;
    color = Colors.success;
    label = 'Delivered';
  } else if (normStatus === 'IN_TRANSIT' || normStatus === 'IN ROUTE') {
    bg = Colors.infoBg;
    color = Colors.info;
    label = 'In Transit';
  } else if (normStatus === 'ASSIGNED') {
    bg = Colors.infoBg;
    color = Colors.info;
    label = 'Assigned';
  } else if (normStatus === 'PENDING' || normStatus === 'AVAILABLE') {
    bg = Colors.primaryLight;
    color = Colors.primaryDark;
    label = 'Pending';
  } else if (normStatus === 'CANCELLED') {
    bg = Colors.dangerBg;
    color = Colors.danger;
    label = 'Cancelled';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: scaledFontSize(9.5, 0.2),
    fontFamily: FontFamily.bold,
  },
});
