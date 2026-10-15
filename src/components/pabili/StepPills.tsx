import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontFamily,
  BorderRadius,
  Spacing,
  PortalFontSizes,
  scaledPortalFontSize,
  PortalFontSizeMultipliers,
} from '../../config/theme';

/**
 * Stores, then List items, then Review. Moved out of ErrandItemsScreen when the
 * list became three screens, so each one shows where the customer is. Step 1 is
 * the store search screen (2026-10-10).
 */
export default function StepPills({ step, storeCount }: { step: 1 | 2 | 3; storeCount: number }) {
  const { colors, isDark } = useThemeColor();

  const done = (label: string, key: string) => (
    <View
      key={key}
      style={[
        styles.pillDone,
        {
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
          borderColor: isDark ? '#059669' : '#A7F3D0',
        },
      ]}
    >
      <Check size={11} color="#10B981" strokeWidth={3} />
      <Text style={[styles.textDone, { color: isDark ? '#34D399' : '#065F46' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
        {label}
      </Text>
    </View>
  );

  const active = (n: number, label: string) => (
    <View style={[styles.pillActive, { backgroundColor: colors.primary }]}>
      <View style={styles.numCircle}>
        <Text style={styles.numActive} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>{n}</Text>
      </View>
      <Text style={styles.textActive} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>{label}</Text>
    </View>
  );

  const todo = (n: number, label: string) => (
    <View style={[styles.pillTodo, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
      <Text style={[styles.numTodo, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>{n}</Text>
      <Text style={[styles.textTodo, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>{label}</Text>
    </View>
  );

  const line = (key: string) => <View key={key} style={[styles.line, { backgroundColor: colors.border }]} />;

  return (
    <View style={styles.row}>
      {step === 1 ? active(1, 'Stores') : done(`Stores (${storeCount})`, 'stores')}
      {line('l1')}
      {step === 2 ? active(2, 'List items') : step === 1 ? todo(2, 'List items') : done('List items', 'items')}
      {line('l2')}
      {step === 3 ? active(3, 'Review') : todo(3, 'Review')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  pillDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  textDone: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
  line: { flex: 1, height: 1, marginHorizontal: 4 },
  pillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  numCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numActive: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.micro), color: '#F62459' },
  textActive: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.caption), color: '#FFFFFF' },
  pillTodo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  numTodo: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
  textTodo: { fontFamily: FontFamily.medium, fontSize: scaledPortalFontSize(PortalFontSizes.caption) },
});
