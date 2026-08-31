import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, scaledFontSize, moderateScale } from '../config/theme';
import { formatPeso } from '../utils/format';
import type { FeeQuote } from '../services/quoteService';

interface FeeBreakdownCardProps {
  /**
   * The server's breakdown, verbatim. Either `feeBreakdown` from an errand
   * payload or the result of a quote — they are the same shape by design.
   */
  breakdown: FeeQuote | null;
  /** Hidden on compact surfaces like a list row. */
  showNote?: boolean;
  testIDPrefix?: string;
}

/**
 * Renders a fee breakdown. Performs no arithmetic of its own.
 *
 * That restriction is the whole point. Every customer surface used to derive its
 * own figures — checkout from a hardcoded 2.5 km, the chat screen from a lone
 * `deliveryFee`, the confirmation screen from a literal 130 — so the price a
 * customer saw depended on which screen they happened to be looking at. One
 * component reading one server-built object is what stops that recurring.
 *
 * The only computed value here is the fee count used to decide whether the
 * subtotal row adds anything, which affects layout and not money.
 */
export default function FeeBreakdownCard({
  breakdown,
  showNote = true,
  testIDPrefix = 'fee',
}: FeeBreakdownCardProps) {
  const { colors } = useThemeColor();

  if (!breakdown) {
    return (
      <Text style={[styles.label, { color: colors.textGray }]} testID={`${testIDPrefix}-loading`} maxFontSizeMultiplier={1.25}>
        Calculating…
      </Text>
    );
  }

  const { fees } = breakdown;
  const peso = formatPeso;

  const row = (label: string, value: number, testID: string) => (
    <View style={styles.row} key={testID}>
      <Text style={[styles.label, { color: colors.textGray }]} maxFontSizeMultiplier={1.25}>{label}</Text>
      <Text style={[styles.value, { color: colors.textDark }]} testID={testID} maxFontSizeMultiplier={1.25}>
        {peso(value)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {row('Base Delivery Fee', fees.baseFee, `${testIDPrefix}-base-fee`)}
      {row('Distance Fee', fees.distanceFee, `${testIDPrefix}-distance-fee`)}
      {fees.multiStoreFee > 0 && row('Multi-Store Fee', fees.multiStoreFee, `${testIDPrefix}-multi-store-fee`)}
      {fees.groceryFee > 0 && row('Shopping Service Fee', fees.groceryFee, `${testIDPrefix}-grocery-fee`)}
      {fees.nonCodFee > 0 && row('Online Payment Fee', fees.nonCodFee, `${testIDPrefix}-non-cod-fee`)}

      {/* The dispatcher found the order needed more shops than the customer
          picked categories for. Said plainly, because a silent absence of a
          charge teaches nobody anything — and a customer who later sees a rider
          visit three stores should already know they were not billed for it. */}
      {(breakdown.absorbedStores ?? 0) > 0 && (
        <View style={styles.noteRow}>
          <Text
            style={[styles.note, styles.absorbedNote, { color: colors.success }]}
            testID={`${testIDPrefix}-absorbed-stores`}
            maxFontSizeMultiplier={1.2}
          >
            {`Collected from ${breakdown.absorbedStores! + 1} stores at no extra charge.`}
          </Text>
        </View>
      )}

      <View style={[styles.row, styles.divider, { borderTopColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>Service Fees Subtotal</Text>
        <Text style={[styles.value, { color: colors.textDark }]} testID={`${testIDPrefix}-fees-subtotal`} maxFontSizeMultiplier={1.25}>
          {peso(fees.subtotal)}
        </Text>
      </View>

      {/* Kept visibly apart from the fees. This is the customer's money for the
          goods, fronted by the company and carried by the rider — not a charge
          for service, and never folded into one. */}
      {breakdown.itemsSubtotal > 0 && (
        <View style={[styles.row, styles.divider, { borderTopColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>Items to be Purchased</Text>
          <Text style={[styles.value, { color: colors.textDark }]} testID={`${testIDPrefix}-items-subtotal`} maxFontSizeMultiplier={1.25}>
            {peso(breakdown.itemsSubtotal)}
          </Text>
        </View>
      )}

      {breakdown.tip > 0 && row('Tip', breakdown.tip, `${testIDPrefix}-tip`)}

      <View style={[styles.row, styles.divider, { borderTopColor: colors.border }]}>
        <Text style={[styles.totalLabel, { color: colors.primary }]} maxFontSizeMultiplier={1.25}>
          {breakdown.isFinal ? 'Total' : 'Estimated Total'}
        </Text>
        <Text style={[styles.totalValue, { color: colors.primary }]} testID={`${testIDPrefix}-grand-total`} maxFontSizeMultiplier={1.25}>
          {peso(breakdown.grandTotal)}
        </Text>
      </View>

      {showNote && !breakdown.isFinal && (
        <Text style={[styles.note, { color: colors.textGray }]} testID={`${testIDPrefix}-estimate-note`} maxFontSizeMultiplier={1.2}>
          This is an estimate. The distance fee is added once your dispatcher confirms the stores, and
          the item total is updated from the rider's receipt.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(2, 0.2),
    gap: Spacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    paddingTop: moderateScale(Spacing.xs + 2, 0.2),
    marginTop: moderateScale(Spacing.xs, 0.2),
  },
  label: { fontFamily: FontFamily.regular, fontSize: scaledFontSize(FontSizes.xs + 0.5, 0.2), flexShrink: 1 },
  value: { fontFamily: FontFamily.mono, fontSize: scaledFontSize(FontSizes.xs + 0.5, 0.2) },
  totalLabel: { fontFamily: FontFamily.bold, fontSize: scaledFontSize(FontSizes.sm + 1, 0.2) },
  totalValue: { fontFamily: FontFamily.monoBold, fontSize: scaledFontSize(FontSizes.sm + 1, 0.2) },
  note: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: moderateScale(14, 0.2),
    marginTop: Spacing.xs,
  },
  noteRow: { flexDirection: 'row' },
  absorbedNote: { fontFamily: FontFamily.semibold, marginTop: Spacing.xs },
});
