import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Banknote, Smartphone, Landmark } from 'lucide-react-native';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import type { PaymentMethodDefinition, PaymentMethodId } from '../services/paymentMethodStrategy';

const ICONS: Record<PaymentMethodId, typeof Banknote> = {
  COD: Banknote,
  GCASH: Smartphone,
  BANK_TRANSFER: Landmark,
};

interface PaymentMethodTileProps {
  method: PaymentMethodDefinition;
  selected: boolean;
  /**
   * Whether the server currently offers this method — PaymentMode.status, not a
   * client-side opinion. Passed in rather than read off `method`, which used to
   * carry its own hardcoded copy and drifted from the catalogue.
   */
  available: boolean;
  onPress: () => void;
}

// Extracted from CheckoutScreen.tsx's inline payment tile JSX so the new
// chat-embedded modal doesn't carry a second copy of the same markup.
export const PaymentMethodTile: React.FC<PaymentMethodTileProps> = ({
  method,
  selected,
  available,
  onPress,
}) => {
  const { colors, isDark } = useThemeColor();
  const Icon = ICONS[method.id];
  const disabled = !available;

  return (
    <TouchableOpacity
      testID={`payment-option-${method.id}`}
      style={[
        styles.tile,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
          borderColor: colors.border,
        },
        selected && [
          styles.tileSelected,
          {
            backgroundColor: isDark ? 'rgba(246,36,89,0.15)' : colors.primaryLight,
            borderColor: colors.primary,
          },
        ],
        disabled && styles.tileDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={styles.row}>
        <Icon size={16} color={disabled ? colors.textLight : selected ? colors.primary : colors.textMedium} strokeWidth={2} />
        <View style={styles.labelColumn}>
          <Text
            style={[
              styles.text,
              { color: colors.textMedium },
              selected && [styles.textSelected, { color: colors.primary }],
              disabled && [styles.textDisabled, { color: colors.textLight }],
            ]}
          >
            {method.label}
          </Text>
          {method.hint && !disabled && (
            <Text style={[styles.hint, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
              {method.hint}
            </Text>
          )}
        </View>
      </View>
      {disabled && (
        <View style={[styles.badge, { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.badgeText, { color: colors.warning }]}>Unavailable</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: {
    padding: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelColumn: { flex: 1, gap: 2 },
  hint: { fontSize: FontSizes.xs, lineHeight: 15 },
  tileSelected: {},
  tileDisabled: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  text: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold },
  textSelected: { fontWeight: FontWeights.bold },
  textDisabled: {},
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  badgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
});
