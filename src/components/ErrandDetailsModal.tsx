import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  X,
  MapPin,
  User,
  Calendar,
  CreditCard,
  MessageCircle,
  ShoppingBag,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, Spacing, BorderRadius, FontFamily, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { formatErrandId } from '../utils/formatErrandId';
import StatusBadge from './StatusBadge';
import FeeBreakdownCard from './FeeBreakdownCard';
import ErrandProofStrip from './ErrandProofStrip';

export interface ErrandDetailsModalProps {
  visible: boolean;
  errand: any | null;
  user: any;
  navigation: any;
  onClose: () => void;
}

export default function ErrandDetailsModal({
  visible,
  errand,
  user,
  navigation,
  onClose,
}: ErrandDetailsModalProps) {
  const { colors, isDark } = useThemeColor();

  if (!errand) return null;

  const errandId = formatErrandId(errand.orderId || errand.id);
  const rawId = String(errand.orderId || errand.id);
  const grandTotal = Number(errand.grandTotal ?? errand.totalCost ?? 0).toFixed(2);
  const deliveryFee = Number(errand.deliveryFee ?? 0).toFixed(2);
  const estimatedCost = Number(errand.estimatedCost ?? 0).toFixed(2);
  const riderName = errand.riderName ? String(errand.riderName).trim() : null;
  const isErrandActive = errand.status !== 'COMPLETED' && errand.status !== 'CANCELLED';

  const formattedDate = errand.createdAt
    ? new Date(errand.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Recently';

  const handleOpenChat = () => {
    onClose();
    if (errand.status === 'PENDING') {
      navigation.navigate('WaitingForDispatcher', { user, errandId: rawId });
    } else {
      navigation.navigate('CustomerChat', { user, errandId: rawId, initialStatus: errand.status });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                Shadows.liftedUp,
              ]}
            >
              {/* HEADER */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <Text style={[styles.headerTitle, { color: colors.textDark }]}>Errand #{errandId}</Text>
                  <Text style={[styles.headerSub, { color: colors.textGray }]}>Transaction Summary</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID="close-errand-details-button"
                >
                  <X size={18} color={colors.textDark} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
                {/* STATUS & DATE HERO */}
                <View
                  style={[
                    styles.statusHero,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.statusRow}>
                    <Text style={[styles.sectionLabel, { color: colors.textGray }]}>Current Status</Text>
                    <StatusBadge status={errand.status} />
                  </View>

                  <View style={styles.dateRow}>
                    <Clock size={13} color={colors.textLight} />
                    <Text style={[styles.dateText, { color: colors.textLight }]}>{formattedDate}</Text>
                  </View>
                </View>

                {/* ITEMS REQUESTED */}
                <View style={styles.detailSection}>
                  <View style={styles.sectionTitleRow}>
                    <ShoppingBag size={15} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Items Requested</Text>
                  </View>
                  <View
                    style={[
                      styles.infoBox,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.infoText, { color: colors.textDark }]}>
                      {errand.categories || 'Pabili Shopping Request'}
                    </Text>
                  </View>
                </View>

                {/* DELIVERY LOCATION */}
                <View style={styles.detailSection}>
                  <View style={styles.sectionTitleRow}>
                    <MapPin size={15} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Delivery Destination</Text>
                  </View>
                  <View
                    style={[
                      styles.infoBox,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.infoText, { color: colors.textMedium }]}>
                      {errand.deliveryAddress || 'Tacurong City, Sultan Kudarat'}
                    </Text>
                  </View>
                </View>

                {/* ASSIGNED PERSONNEL */}
                <View style={styles.detailSection}>
                  <View style={styles.sectionTitleRow}>
                    <User size={15} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Assigned Personnel</Text>
                  </View>
                  <View
                    style={[
                      styles.infoBox,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF', borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.infoText, { color: colors.textDark }]}>
                      {riderName ? `🏍️ Rider: ${riderName}` : '⏳ Rider: Dispatcher Assigning...'}
                    </Text>
                  </View>
                </View>

                {/* FEE & PAYMENT SUMMARY */}
                <View style={styles.detailSection}>
                  <View style={styles.sectionTitleRow}>
                    <CreditCard size={15} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Payment & Fees</Text>
                  </View>
                  <View
                    style={[
                      styles.feeCard,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.feeLine}>
                      <Text style={[styles.feeLabel, { color: colors.textGray }]}>Payment Method</Text>
                      <Text style={[styles.feeValBold, { color: colors.textDark }]}>
                        {errand.status === 'CANCELLED'
                          ? 'Voided (Not Charged)'
                          : errand.paymentMethod || 'Pending Verification'}
                      </Text>
                    </View>

                    {errand.status === 'CANCELLED' ? (
                      <View style={{ paddingVertical: 8 }}>
                        <Text style={{ fontSize: 12, color: '#DC2626', fontStyle: 'italic' }}>
                          This errand was cancelled. No delivery fees or item charges were collected.
                        </Text>
                      </View>
                    ) : (errand.status === 'PENDING' || errand.status === 'AVAILABLE') ? (
                      <View style={{ paddingVertical: 8, gap: 6 }}>
                        <View style={styles.feeLine}>
                          <Text style={[styles.feeLabel, { color: colors.textGray }]}>Base Delivery Fare</Text>
                          <Text style={{ color: '#D97706', fontSize: 12, fontFamily: FontFamily.semibold }}>
                            Pending Completion
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textLight, fontStyle: 'italic' }}>
                          Note: The base delivery fare is finalized and applied once a rider accepts the errand and completes delivery.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {/* The same itemised breakdown the customer saw at
                            checkout and in chat. This screen used to flatten it
                            to "Estimated Items" and "Delivery Fee", so the one
                            place a customer reviews a finished errand was the
                            one place the charges were not explained. */}
                        {errand.feeBreakdown ? (
                          <FeeBreakdownCard
                            breakdown={errand.feeBreakdown}
                            testIDPrefix={`history-${errand.id ?? 'errand'}`}
                          />
                        ) : (
                          <>
                            {Number(estimatedCost) > 0 && (
                              <View style={styles.feeLine}>
                                <Text style={[styles.feeLabel, { color: colors.textGray }]}>Estimated Items</Text>
                                <Text style={[styles.feeVal, { color: colors.textMedium }]}>₱{estimatedCost}</Text>
                              </View>
                            )}

                            {Number(deliveryFee) > 0 && (
                              <View style={styles.feeLine}>
                                <Text style={[styles.feeLabel, { color: colors.textGray }]}>Delivery Fee</Text>
                                <Text style={[styles.feeVal, { color: colors.textMedium }]}>₱{deliveryFee}</Text>
                              </View>
                            )}

                            <View style={[styles.divider, { backgroundColor: colors.border }]} />

                            <View style={styles.totalLine}>
                              <Text style={[styles.totalLabel, { color: colors.textDark }]}>Total Fee(s)</Text>
                              <Text style={[styles.totalAmount, { color: colors.primary }]}>₱{grandTotal}</Text>
                            </View>
                          </>
                        )}

                        {/* What the rider photographed. The errand list has
                            always promised "view past receipts" and there were
                            none to view — and a customer disputing a delivery
                            had a status word and nothing else. */}
                        <ErrandProofStrip errandId={String(errand.id ?? '')} />
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>

              {/* ACTION BUTTONS */}
              <View style={styles.footerRow}>
                {isErrandActive && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.chatActionBtn, { backgroundColor: colors.primary }]}
                    onPress={handleOpenChat}
                  >
                    <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.chatActionBtnText}>
                      {errand.status === 'PENDING' ? 'Waiting Status' : 'Open Live Chat'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.closeActionBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                      flex: isErrandActive ? 0.4 : 1,
                    },
                  ]}
                  onPress={onClose}
                >
                  <Text style={[styles.closeActionBtnText, { color: colors.textDark }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    maxHeight: '85%',
    alignSelf: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.md + 1, 0.35),
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.3),
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    marginVertical: Spacing.xs,
  },
  statusHero: {
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
  },
  detailSection: {
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  infoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  infoText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: 16,
  },
  feeCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  feeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  feeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  feeVal: {
    fontFamily: FontFamily.mono,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  feeValBold: {
    fontFamily: FontFamily.monoBold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  divider: {
    height: 1,
    marginVertical: 6,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
  },
  totalAmount: {
    fontFamily: FontFamily.monoBold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  chatActionBtn: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  chatActionBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  closeActionBtn: {
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
});
