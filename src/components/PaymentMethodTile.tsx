import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Banknote, Smartphone, Landmark, CreditCard } from 'lucide-react-native';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../config/theme';
import type { PaymentMethodDefinition, PaymentMethodId } from '../services/paymentMethodStrategy';

const ICONS: Record<PaymentMethodId, typeof Banknote> = {
  COD: Banknote,
  GCASH: Smartphone,
  BANK_TRANSFER: Landmark,
  CARD: CreditCard,
};

interface PaymentMethodTileProps {
  method: PaymentMethodDefinition;
  selected: boolean;
  onPress: () => void;
}

// Extracted from CheckoutScreen.tsx's inline payment tile JSX so the new
// chat-embedded modal doesn't carry a second copy of the same markup.
export const PaymentMethodTile: React.FC<PaymentMethodTileProps> = ({ method, selected, onPress }) => {
  const Icon = ICONS[method.id];
  const disabled = !method.available;

  return (
    <TouchableOpacity
      testID={`payment-option-${method.id}`}
      style={[styles.tile, selected && styles.tileSelected, disabled && styles.tileDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={styles.row}>
        <Icon size={16} color={disabled ? Colors.textLight : selected ? Colors.primary : Colors.textMedium} strokeWidth={2} />
        <Text style={[styles.text, selected && styles.textSelected, disabled && styles.textDisabled]}>{method.label}</Text>
      </View>
      {disabled && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Under Development</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: {
    backgroundColor: Colors.bgGray,
    padding: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  tileDisabled: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  text: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.textMedium },
  textSelected: { color: Colors.primary, fontWeight: FontWeights.bold },
  textDisabled: { color: Colors.textLight },
  badge: { backgroundColor: Colors.warningBg, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  badgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.warning },
});
