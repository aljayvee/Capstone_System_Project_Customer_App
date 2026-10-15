import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Receipt, Bike, MapPin, ChevronLeft } from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import { PAYMENT_METHODS } from '../services/paymentMethodStrategy';
import MapPreviewField from '../components/MapPreviewField';
import { formatErrandId } from '../utils/formatErrandId';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  FontFamily,
  FontSizes,
  FontWeights,
  Spacing,
  BorderRadius,
  Shadows,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';

export const TRACKING_STEPS = [
  'Errand Received',
  'Rider Assigned',
  'Traveling to Location',
  'Items Purchased / Picked Up',
  'In Route to Destination',
  'Delivered',
];

export default function ErrandConfirmationScreen({
  route,
  navigation,
}: RootStackScreenProps<'ErrandConfirmation'>) {
  const { user, finalErrand } = route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Test', lastName: 'User' },
    finalErrand: {
      errandId: 'SGO-123456',
      services: ['Pabili'],
      payload: { selectedServices: ['Pabili'] },
      // Zeroed on purpose. This is the fallback for a render with no route
      // params (tests, deep links) — it used to carry a plausible-looking price
      // built on the same hardcoded 2.5 km the checkout screen has since had
      // removed. A fake price that looks real is worse than an obvious zero.
      baseFee: 0,
      distanceKm: 0,
      distanceFee: 0,
      commission: 0,
      subtotal: 0,
      grandTotal: 0,
      paymentMethod: 'COD' as const,
      status: 'Errand Placed',
      createdAt: Date.now(),
    },
  };

  const { colors, isDark } = useThemeColor();
  const [currentStep, setCurrentStep] = useState(0);

  // Android Three-Key Navigation: Back button resets navigation to CustomerPortal
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'CustomerPortal', params: { user } }],
      });
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation, user]);

  // `finalErrand.paymentMethod` is the canonical id ("GCASH", not "GCash") —
  // resolve the label a customer actually reads rather than printing the id.
  const paymentMethodLabel =
    PAYMENT_METHODS.find((m) => m.id === finalErrand.paymentMethod)?.label ?? finalErrand.paymentMethod;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* ── NAV HEADER ──────────────────────────────────────────────────── */}
      <View
        style={[
          styles.navHeaderRow,
          { borderBottomColor: colors.border, backgroundColor: colors.bgApp },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'CustomerPortal', params: { user } }] })
          }
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="nav-back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          Errand Confirmed
        </Text>
        <View style={styles.navRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* SUCCESS BANNER */}
        <View style={[styles.successCard, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5', borderColor: isDark ? '#059669' : '#A7F3D0' }]}>
          <View style={[styles.successBadge, { backgroundColor: '#10B981' }]}>
            <Check size={12} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.successBadgeText} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Success</Text>
          </View>
          <Text style={[styles.successTitle, { color: isDark ? '#34D399' : '#065F46' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
            Errand Confirmed!
          </Text>
          <Text style={[styles.successSubtitle, { color: isDark ? '#A7F3D0' : '#047857' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            Your errand request has been transmitted to dispatch.
          </Text>
        </View>

        {/* DIGITAL RECEIPT */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]} testID="digital-receipt">
          <View style={styles.cardTitleRow}>
            <Receipt size={17} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
              Digital Receipt
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              Errand ID:
            </Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]} testID="errand-id-text" maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
              {formatErrandId(finalErrand.errandId)}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              Services:
            </Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
              {finalErrand.services.join(' / ')}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              Payment Method:
            </Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
              {paymentMethodLabel}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              Base Delivery Fee:
            </Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
              ₱{finalErrand.baseFee}.00
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              Distance Fee:
            </Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
              ₱{finalErrand.distanceFee}.00
            </Text>
          </View>

          {finalErrand.commission > 0 && (
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                Service Commission:
              </Text>
              <Text style={[styles.receiptVal, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                ₱{finalErrand.commission}.00
              </Text>
            </View>
          )}

          <View style={[styles.receiptRow, styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
              Estimated Grand Total:*
            </Text>
            <Text style={[styles.totalVal, { color: colors.primary }]} testID="grand-total-text" maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
              ₱{finalErrand.grandTotal.toFixed(2)}
            </Text>
          </View>
          <Text style={[styles.totalFootnote, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            * Final amount confirmed after item purchase. Paid via Cash on Delivery.
          </Text>

        </View>

        {/* TRACKING STEPPER */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]} testID="tracking-stepper">
          <View style={styles.cardTitleRow}>
            <Bike size={17} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]}>Errand Tracking Status</Text>
          </View>

          <View style={styles.stepperContainer}>
            {TRACKING_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStep;
              return (
                <View key={idx} style={styles.stepRow} testID={`tracking-step-${idx}`}>
                  <View
                    style={[
                      styles.stepCircle,
                      {
                        backgroundColor: isCompleted ? '#10B981' : (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'),
                      },
                    ]}
                  >
                    {isCompleted ? (
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Text style={[styles.stepNumber, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>{idx + 1}</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      {
                        color: isCompleted ? colors.textDark : colors.textGray,
                        fontFamily: isCompleted ? FontFamily.semibold : FontFamily.regular,
                      },
                    ]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                  >
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* MAP PREVIEW */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
          <View style={styles.cardTitleRow}>
            <MapPin size={17} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>Live Rider Location Map</Text>
          </View>
          <MapPreviewField
            testID="confirmation-map-preview-field"
            mapTestID="confirmation-map-view"
            center={{ latitude: 6.671, longitude: 124.6644 }}
            label="Rider location"
            markers={[
              { key: 'rider', coordinate: { latitude: 6.671, longitude: 124.6644 }, title: 'Rider Assigned Location' },
            ]}
          />
        </View>

        <TouchableOpacity
          testID="back-to-dashboard-button"
          activeOpacity={0.85}
          style={[styles.homeBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'CustomerPortal', params: { user } }],
            })
          }
        >
          <Text style={styles.homeBtnText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(17),
    lineHeight: getPortalLineHeight(17, 'heading'),
    textAlign: 'center',
  },
  navRightPlaceholder: {
    width: PortalTouchTargets.compact,
  },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl * 2 },
  totalFootnote: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.35),
    marginTop: 4,
    marginBottom: Spacing.xs,
  },

  successCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
  },
  successBadgeText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: 4,
  },
  successSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.40),
    textAlign: 'center',
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptLabel: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  receiptVal: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  totalRow: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  totalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
  },
  totalVal: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
  },
  stepperContainer: {
    marginTop: Spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  stepNumber: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  stepText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.35),
  },
  homeBtn: {
    paddingVertical: moderateScale(12, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    minHeight: PortalTouchTargets.buttonHeight,
  },
  homeBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 1.25),
  },
});
