import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  HelpCircle,
  X,
  Banknote,
  MapPin,
  Clock,
  ShieldCheck,
  PhoneCall,
  Sparkles,
} from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { useRateConfig } from '../hooks/useRateConfig';
import { BorderRadius, FontFamily, FontSizes, Spacing, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';

export interface CustomerHelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CustomerHelpModal({ visible, onClose }: CustomerHelpModalProps) {
  const { colors, isDark } = useThemeColor();
  const { baseFee, rateConfig } = useRateConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.bgGray }]}>
                <HelpCircle size={20} color={colors.textGray} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textDark }]}>Sugo Express Help</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textGray }]}>Customer Guide & FAQ</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="close-help-modal"
            >
              <X size={18} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. HOW IT WORKS */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={[styles.sectionHeading, { color: colors.textDark }]}>How Sugo Express Works</Text>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepDetails}>
                  <Text style={[styles.stepTitle, { color: colors.textDark }]}>Choose Category & List Items</Text>
                  <Text style={[styles.stepDesc, { color: colors.textGray }]}>
                    Select your store type (Groceries, Pharmacy, Food, etc.) and list the items you need bought.
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepDetails}>
                  <Text style={[styles.stepTitle, { color: colors.textDark }]}>Dispatcher Reviews & Assigns Rider</Text>
                  <Text style={[styles.stepDesc, { color: colors.textGray }]}>
                    A dispatcher confirms your order via in-app chat, calculates transparent rates, and assigns a verified rider.
                  </Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepDetails}>
                  <Text style={[styles.stepTitle, { color: colors.textDark }]}>Pay on Arrival (Cash on Delivery)</Text>
                  <Text style={[styles.stepDesc, { color: colors.textGray }]}>
                    Inspect your items upon arrival and pay the rider directly via Cash on Delivery.
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. DYNAMIC PRICING BREAKDOWN */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Banknote size={16} color="#10B981" />
                <Text style={[styles.sectionHeading, { color: colors.textDark }]}>Transparent Delivery Pricing</Text>
              </View>

              <View style={styles.pricingRow}>
                <Text style={[styles.pricingLabel, { color: colors.textMedium }]}>Base Delivery Fee (First 2.0 km)</Text>
                <Text style={[styles.pricingValue, { color: colors.primary }]}>₱{Number(baseFee).toFixed(2)}</Text>
              </View>

              <View style={styles.pricingRow}>
                <Text style={[styles.pricingLabel, { color: colors.textMedium }]}>Excess Distance Rate</Text>
                <Text style={[styles.pricingValue, { color: colors.textDark }]}>
                  ₱{Number(rateConfig?.perKmRate ?? 10).toFixed(2)} / km
                </Text>
              </View>

              <Text style={[styles.pricingNote, { color: colors.textLight }]}>
                * Item costs are reimbursed at actual store receipt value upon delivery.
              </Text>
            </View>

            {/* 3. COVERAGE & HOURS */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <MapPin size={16} color={colors.primary} />
                <Text style={[styles.sectionHeading, { color: colors.textDark }]}>Coverage & Service Hours</Text>
              </View>

              <View style={styles.infoRow}>
                <Clock size={14} color={colors.textGray} />
                <Text style={[styles.infoText, { color: colors.textMedium }]}>
                  Operating Daily: <Text style={{ fontFamily: FontFamily.bold, color: colors.textDark }}>7:00 AM – 9:00 PM</Text>
                </Text>
              </View>

              <View style={styles.infoRow}>
                <ShieldCheck size={14} color="#10B981" />
                <Text style={[styles.infoText, { color: colors.textMedium }]}>
                  Service Area: <Text style={{ fontFamily: FontFamily.bold, color: colors.textDark }}>Tacurong City & Immediate Vicinities</Text>
                </Text>
              </View>
            </View>

            {/* 4. DISPATCHER ASSISTANCE */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.08)' : '#FFEEF3', borderColor: colors.primary }]}>
              <View style={styles.sectionHeaderRow}>
                <PhoneCall size={16} color={colors.primary} />
                <Text style={[styles.sectionHeading, { color: colors.primary }]}>Need Order Assistance?</Text>
              </View>
              <Text style={[styles.supportDesc, { color: colors.textDark }]}>
                If you have questions about your active order or need urgent assistance, select your errand from the Messages & Support tab to chat in real-time with your assigned dispatcher.
              </Text>
            </View>
          </ScrollView>

          {/* Dismiss Button */}
          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.gotItButton, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.gotItButtonText}>Got It, Thanks!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
  },
  modalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  sectionHeading: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  stepNumberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(9.5, 0.2),
  },
  stepDetails: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginBottom: 2,
  },
  stepDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    lineHeight: 14,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  pricingLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  pricingValue: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  pricingNote: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(9.5, 0.2),
    marginTop: 4,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginBottom: 3,
  },
  infoText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  supportDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: 15,
  },
  modalFooter: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
  },
  gotItButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    minHeight: moderateScale(46, 0.2),
  },
  gotItButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    color: '#FFFFFF',
  },
});
