import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ClipboardList, Wallet, CreditCard, Banknote, Smartphone, Landmark, CheckCircle2 } from 'lucide-react-native';
import { RootStackScreenProps, FinalErrand } from '../navigation/types';
import { saveCustomerLocation } from '../firebase/location';
import { apiClient } from '../services/apiClient';
import MapPreviewField from '../components/MapPreviewField';
import { useThemeColor } from '../hooks/useThemeColor';
import { useRateConfig } from '../hooks/useRateConfig';
import { fetchQuote, type FeeQuote } from '../services/quoteService';
import FeeBreakdownCard from '../components/FeeBreakdownCard';
import { FontFamily, FontSizes, FontWeights, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';

export default function CheckoutScreen({ route, navigation }: RootStackScreenProps<'Checkout'>) {
  const { user, errandPayload } = route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Test', lastName: 'User' },
    errandPayload: { selectedServices: ['Pabili'], pabiliCats: ['Grocery'], catItems: { Grocery: ['Item 1'] } },
  };

  const { colors, isDark } = useThemeColor();
  const { isTablet } = useResponsive();
  const { rateConfig, baseFee } = useRateConfig();

  const services = ['Pabili'];
  const latitude = errandPayload?.latitude || 6.671;
  const longitude = errandPayload?.longitude || 124.6644;

  const totalPurchaseAmount = errandPayload?.totalPurchaseAmount || 0;
  const storeCount = Math.max(1, errandPayload?.pabiliCats?.length || 1);

  const itemUnits = Object.values(errandPayload?.catItems ?? {}).reduce(
    (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
    0
  );

  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'GCash' | 'Bank Transfer'>('COD');
  const [quote, setQuote] = useState<FeeQuote | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuote({
      estimatedCost: totalPurchaseAmount,
      storeCount,
      itemUnits,
      isCod: paymentMethod === 'COD',
    }).then((result) => {
      if (!cancelled) setQuote(result);
    });
    return () => {
      cancelled = true;
    };
  }, [totalPurchaseAmount, storeCount, itemUnits, paymentMethod]);

  const fees = quote?.fees ?? null;
  const grandTotal = quote?.grandTotal ?? null;

  const handleSelectPayment = (method: 'COD' | 'GCash' | 'Bank Transfer') => {
    setPaymentMethod(method);
  };

  const handlePlaceErrand = async () => {
    const errandId = `PABILI-${Date.now().toString().slice(-6)}`;
    const finalErrand: FinalErrand = {
      errandId,
      services: ['Pabili'],
      payload: errandPayload,
      baseFee: fees?.baseFee ?? baseFee,
      distanceKm: 0,
      distanceFee: fees?.distanceFee ?? 0,
      commission: fees?.groceryFee ?? 0,
      subtotal: totalPurchaseAmount,
      grandTotal: grandTotal ?? 0,
      paymentMethod,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    try {
      await saveCustomerLocation(user.id, latitude, longitude, 'Tacurong City Delivery Location');
    } catch (e) {
      console.error('[Firebase RTDB] Location write warning:', e);
    }

    try {
      await apiClient.post('/errands/pabili', {
        errandId,
        customerId: user.id,
        customerName: `${user.firstName} ${user.lastName}`.trim(),
        pabiliCats: errandPayload.pabiliCats,
        catItems: errandPayload.catItems,
        totalPurchaseAmount,
        baseFee: fees?.baseFee ?? baseFee,
        distanceKm: 0,
        distanceFee: fees?.distanceFee ?? 0,
        commission: fees?.groceryFee ?? 0,
        grandTotal: grandTotal ?? 0,
        paymentMethod,
        deliveryAddress: errandPayload.deliveryAddress || 'Tacurong City',
        latitude,
        longitude,
      });
    } catch (err) {
      console.error('[MariaDB Backend] Error saving Pabili errand to errand_system_db:', err);
    }

    if (navigation?.navigate) {
      navigation.navigate('WaitingForDispatcher', {
        user,
        errandId,
        finalErrand,
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.headerTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>Confirm Your Errand</Text>
        <Text style={[styles.subTitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>Review pickup, fees, and payment details.</Text>

        {/* SUMMARY CARD */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
          <View style={styles.cardTitleRow}>
            <ClipboardList size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>Shopping List Summary</Text>
          </View>
          <Text style={[styles.summaryItem, { color: colors.textMedium }]} maxFontSizeMultiplier={1.2}>
            <Text style={[styles.boldText, { color: colors.textDark }]}>Service: </Text>
            {errandPayload?.selectedServices?.join(', ') || 'Pabili (Personal Shopper)'}
          </Text>
          {errandPayload?.pabiliCats && (
            <Text style={[styles.summaryItem, { color: colors.textMedium }]} maxFontSizeMultiplier={1.2}>
              <Text style={[styles.boldText, { color: colors.textDark }]}>Store Categories: </Text>
              {errandPayload.pabiliCats.join(', ')}
            </Text>
          )}
        </View>

        {/* DELIVERY LOCATION PREVIEW */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
          <View style={styles.cardTitleRow}>
            <MapPin size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>Delivery Location</Text>
          </View>
          <MapPreviewField
            testID="map-preview-field"
            center={{ latitude, longitude }}
            label="Delivery Location"
            addressText={errandPayload?.deliveryAddress || 'Tacurong City Delivery Location'}
          />
        </View>

        {/* FEE BREAKDOWN */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
          <View style={styles.cardTitleRow}>
            <Wallet size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>Fee Breakdown</Text>
          </View>
          <FeeBreakdownCard breakdown={quote} testIDPrefix="price" />
        </View>

        {/* PAYMENT METHOD */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
          <View style={styles.cardTitleRow}>
            <CreditCard size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>Select Payment Method</Text>
          </View>

          {[
            { id: 'COD', label: 'Cash on Delivery (COD)', icon: Banknote },
            { id: 'GCash', label: 'GCash / E-Wallet', icon: Smartphone },
            { id: 'Bank Transfer', label: 'Online Bank Transfer', icon: Landmark },
          ].map((item) => {
            const isSelected = paymentMethod === item.id;
            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                testID={`payment-option-${item.id}`}
                style={[
                  styles.paymentTile,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected
                      ? isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFF0F5'
                      : isDark ? 'rgba(255,255,255,0.03)' : colors.bgGray,
                  },
                ]}
                onPress={() => handleSelectPayment(item.id as any)}
              >
                <View style={styles.paymentRow}>
                  <IconComponent size={20} color={isSelected ? colors.primary : colors.textGray} />
                  <Text
                    style={[
                      styles.paymentText,
                      { color: isSelected ? colors.primary : colors.textDark },
                    ]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {item.label}
                  </Text>
                </View>
                {isSelected && <CheckCircle2 size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          testID="submit-errand-button"
          activeOpacity={0.85}
          style={[styles.submitBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
          onPress={handlePlaceErrand}
        >
          <Text style={styles.submitBtnText} maxFontSizeMultiplier={1.25}>Place Pabili Errand Now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl * 2,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.lg, 0.2),
    marginBottom: Spacing.xs,
  },
  subTitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginBottom: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
  },
  summaryItem: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginBottom: 6,
  },
  boldText: {
    fontFamily: FontFamily.bold,
  },
  paymentTile: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  paymentText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
  },
  submitBtn: {
    padding: moderateScale(11, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    minHeight: moderateScale(48, 0.2),
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
});
