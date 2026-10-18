import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { formatPaymentMethod } from '../utils/format';

interface PaymentMethodChangeProps {
  change: { from: string; to: string };
  /** The payment row's own value style, so both lines match the row they sit in. */
  valueStyle: StyleProp<TextStyle>;
  /** For the method that was not used. */
  mutedColor: string;
  maxFontSizeMultiplier?: number;
}

/**
 * A payment method that changed at the door: what the customer chose, struck
 * through, above what they actually paid with.
 *
 * The struck line is kept rather than replaced, so a customer who picked GCash
 * can see the switch to cash was recorded, not that their choice was lost. A
 * screen reader does not announce a strikethrough, so the pair is read as one
 * sentence instead.
 */
export function PaymentMethodChange({
  change,
  valueStyle,
  mutedColor,
  maxFontSizeMultiplier,
}: PaymentMethodChangeProps) {
  const from = formatPaymentMethod(change.from, 'full');
  const to = formatPaymentMethod(change.to, 'full');

  return (
    <View
      style={styles.stack}
      accessible
      accessibilityLabel={`Payment method changed from ${from} to ${to}`}
      testID="payment-method-change"
    >
      <Text
        style={[valueStyle, styles.struck, { color: mutedColor }]}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        testID="payment-method-from"
      >
        {from}
      </Text>
      <Text style={valueStyle} maxFontSizeMultiplier={maxFontSizeMultiplier} testID="payment-method-to">
        {to}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'flex-end', flexShrink: 1 },
  struck: { textDecorationLine: 'line-through' },
});
