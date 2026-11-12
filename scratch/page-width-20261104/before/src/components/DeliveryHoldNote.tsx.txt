import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Hourglass } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { formatErrandId } from '../utils/formatErrandId';
import { FontFamily, Spacing, BorderRadius } from '../config/theme';
import { PortalFontSizes, PortalFontSizeMultipliers, scaledPortalFontSize } from '../config/portalTypography';

/**
 * The order the server says is held (`deliveryHold`): bought, and waiting
 * while the same rider shops this customer's other order to the same address,
 * so both arrive in one trip. Null when it is not held, or the payload does
 * not say.
 */
export function deliveryHoldOf(errand: any): { errandId: string } | null {
  const hold = errand && typeof errand === 'object' ? errand.deliveryHold : null;
  const errandId = hold && typeof hold.errandId === 'string' ? hold.errandId.trim() : '';
  return errandId ? { errandId } : null;
}

interface DeliveryHoldNoteProps {
  errand: any;
}

/**
 * Why the rider with this order is heading to a store instead of the door.
 * Without it the customer watches their order "on the way" move away from
 * them; with it, they know both orders come together.
 */
export default function DeliveryHoldNote({ errand }: DeliveryHoldNoteProps) {
  const { colors } = useThemeColor();
  const hold = deliveryHoldOf(errand);
  if (!hold) return null;

  return (
    <View
      style={[styles.note, { backgroundColor: colors.infoBg, borderColor: colors.info }]}
      accessibilityRole="text"
      testID="delivery-hold-note"
    >
      <Hourglass size={16} color={colors.info} strokeWidth={2} />
      <Text
        style={[styles.text, { color: colors.textDark }]}
        maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
      >
        Your rider has this order and is shopping for your other order, {formatErrandId(hold.errandId)}, first.
        Both will arrive together in one trip.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
});
