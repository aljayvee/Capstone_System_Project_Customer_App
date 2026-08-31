import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Receipt, Bike, MapPin, ChevronLeft } from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import MapPreviewField from '../components/MapPreviewField';
import { useThemeColor } from '../hooks/useThemeColor';
import { formatErrandId } from '../utils/formatErrandId';
import { FontFamily, FontSizes, FontWeights, Spacing, BorderRadius, Shadows } from '../config/theme';

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
      paymentMethod: 'COD',
      status: 'Errand Placed',
      createdAt: Date.now(),
    },
  };

  const { colors, isDark } = useThemeColor();
  const [currentStep, setCurrentStep] = useState(0);

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
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
          testID="nav-back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]}>Errand Confirmed</Text>
        <View style={styles.navRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* SUCCESS BANNER */}
        <View style={[styles.successCard, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5', borderColor: isDark ? '#059669' : '#A7F3D0' }]}>
          <View style={[styles.successBadge, { backgroundColor: '#10B981' }]}>
            <Check size={12} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.successBadgeText}>Success</Text>
          </View>
          <Text style={[styles.successTitle, { color: isDark ? '#34D399' : '#065F46' }]}>Errand Confirmed!</Text>
          <Text style={[styles.successSubtitle, { color: isDark ? '#A7F3D0' : '#047857' }]}>
            Your errand request has been transmitted to dispatch.
          </Text>
        </View>

        {/* DIGITAL RECEIPT */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]} testID="digital-receipt">
          <View style={styles.cardTitleRow}>
            <Receipt size={17} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]}>Digital Receipt</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]}>Errand ID:</Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]} testID="errand-id-text">
              {formatErrandId(finalErrand.errandId)}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]}>Services:</Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]}>{finalErrand.services.join(' / ')}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]}>Payment Method:</Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]}>{finalErrand.paymentMethod}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]}>Base Delivery Fee:</Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]}>₱{finalErrand.baseFee}.00</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={[styles.receiptLabel, { color: colors.textGray }]}>Distance Fee:</Text>
            <Text style={[styles.receiptVal, { color: colors.textDark }]}>₱{finalErrand.distanceFee}.00</Text>
          </View>

          {finalErrand.commission > 0 && (
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: colors.textGray }]}>Service Commission:</Text>
              <Text style={[styles.receiptVal, { color: colors.textDark }]}>₱{finalErrand.commission}.00</Text>
            </View>
          )}

          <View style={[styles.receiptRow, styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.primary }]}>Estimated Grand Total:*</Text>
            <Text style={[styles.totalVal, { color: colors.primary }]} testID="grand-total-text">
              ₱{finalErrand.grandTotal.toFixed(2)}
            </Text>
          </View>
          <Text style={[styles.totalFootnote, { color: colors.textGray }]}>
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
                      <Text style={[styles.stepNumber, { color: colors.textGray }]}>{idx + 1}</Text>
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
            <Text style={[styles.cardTitle, { color: colors.textDark }]}>Live Rider Location Map</Text>
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
          <Text style={styles.homeBtnText}>Back to Dashboard</Text>
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
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg,
    textAlign: 'center',
  },
  navRightPlaceholder: {
    width: 36,
  },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl * 2 },
  totalFootnote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs - 1,
    marginTop: 2,
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
    fontSize: FontSizes.xs,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xl,
    marginBottom: 2,
  },
  successSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
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
    fontSize: FontSizes.md,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
  },
  receiptVal: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  totalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  totalVal: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xl,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  stepNumber: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
  },
  stepText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
  },
  homeBtn: {
    padding: Spacing.md + 2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  homeBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.md,
  },
});
