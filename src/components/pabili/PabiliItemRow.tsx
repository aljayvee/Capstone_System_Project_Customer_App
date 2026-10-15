import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { formatItemLabel } from '../../utils/format';
import type { DraftRow } from '../../services/pabiliDraft';
import {
  FontFamily,
  BorderRadius,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';

interface Props {
  row: DraftRow;
  testID?: string;
  /** Opens the name, unit and note editor. */
  onPress?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemove?: () => void;
}

/**
 * One listed item: quantity stepper, "Chicken · 5 kg", its note for the rider
 * underneath, remove.
 *
 * The stepper is the one place the count lives. The name shows the size but
 * never the count, which is what the old single screen got wrong: customers
 * typed "2 Coke" with the stepper on 1.
 */
export default function PabiliItemRow({ row, testID, onPress, onIncrement, onDecrement, onRemove }: Props) {
  const { colors, isDark } = useThemeColor();
  const label = formatItemLabel(row.name, row.size);

  return (
    <View
      style={[styles.row, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB', borderColor: colors.border }]}
      testID={testID}
    >
      {onIncrement && onDecrement ? (
        <View style={styles.qtyGroup}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={onDecrement}
            accessibilityLabel={`One fewer ${label}`}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID={testID ? `${testID}-minus` : undefined}
          >
            <Minus size={12} color={colors.textGray} strokeWidth={2.6} />
          </TouchableOpacity>
          <Text style={[styles.qtyValue, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            {row.quantity}
          </Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={onIncrement}
            accessibilityLabel={`One more ${label}`}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID={testID ? `${testID}-plus` : undefined}
          >
            <Plus size={12} color={colors.textGray} strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={[styles.qtyStatic, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
          {row.quantity}×
        </Text>
      )}

      <TouchableOpacity
        style={styles.nameCol}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityHint={onPress ? 'Edit the name, unit and note' : undefined}
      >
        <Text style={[styles.name, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
          {label}
        </Text>
        {row.notes ? (
          <Text style={[styles.hint, { color: colors.textGray }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            {`Note: ${row.notes}`}
          </Text>
        ) : null}
      </TouchableOpacity>

      {onRemove ? (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={onRemove}
          accessibilityLabel={`Remove ${label}`}
          hitSlop={PortalTouchTargets.compactHitSlop}
          testID={testID ? `${testID}-remove` : undefined}
        >
          <X size={13} color={colors.textLight} strokeWidth={2.4} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  qtyGroup: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  qtyBtn: { minWidth: 32, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body), minWidth: 20, textAlign: 'center' },
  qtyStatic: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body), minWidth: 28 },
  nameCol: { flex: 1 },
  name: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
  },
  hint: { fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.micro), marginTop: 2 },
  removeBtn: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
