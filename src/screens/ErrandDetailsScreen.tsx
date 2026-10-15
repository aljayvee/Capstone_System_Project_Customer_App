import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MapPin,
  User,
  CreditCard,
  MessageCircle,
  ShoppingBag,
  Clock,
  Bike,
  AlertCircle,
  Headphones,
} from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  Spacing,
  BorderRadius,
  FontFamily,
  useResponsive,
  MAX_CONTENT_WIDTH,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import { formatErrandId } from '../utils/formatErrandId';
import { formatPaymentMethod, formatItemLabel } from '../utils/format';
import StatusBadge from '../components/StatusBadge';
import FeeBreakdownCard from '../components/FeeBreakdownCard';
import ErrandProofStrip from '../components/ErrandProofStrip';
import { apiClient } from '../services/apiClient';
import { mergeErrandDetails, paymentMethodOf, personnelLines } from '../utils/errandPersonnel';
import type { RootStackScreenProps } from '../navigation/types';

export default function ErrandDetailsScreen({
  route,
  navigation,
}: RootStackScreenProps<'ErrandDetails'>) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const { isTablet } = useResponsive();

  const routeParams = route.params || ({} as any);
  const user = routeParams.user;
  const initialErrand = routeParams.errand || null;
  const passedId = routeParams.errandId || initialErrand?.orderId || initialErrand?.id;

  const [errand, setErrand] = useState<any | null>(initialErrand);
  const [loading, setLoading] = useState<boolean>(!initialErrand && !!passedId);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  // Until the first fetch settles. The list's copy names no dispatcher, so that
  // line says "Checking..." rather than guessing.
  const [checking, setChecking] = useState<boolean>(!!passedId);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const rawId = String(errand?.orderId || errand?.id || passedId || '');
  const errandId = formatErrandId(rawId);

  // Fetch or refresh errand data
  const fetchErrandData = useCallback(async (showRefreshing = false) => {
    if (!rawId) return;
    if (showRefreshing) setRefreshing(true);
    try {
      setFetchError(null);
      const res = await apiClient.get(`/errands/${rawId}`);
      if (res.data) {
        // Merged, not replaced. This endpoint sends the rider and the payment
        // as relations where the list sent flat fields, and replacing one with
        // the other turned an assigned rider back into "Assigning" on refresh.
        setErrand((current: any) => mergeErrandDetails(current, res.data));
      }
    } catch (err: any) {
      // Rendered only while there is no errand on screen to fall back on.
      setFetchError('Unable to load errand details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setChecking(false);
    }
  }, [rawId]);

  // Fetched on open even with the list's copy in hand: that copy has no
  // dispatcher and no fee breakdown, so the screen would otherwise change shape
  // on the customer's first refresh.
  useEffect(() => {
    if (rawId) {
      fetchErrandData();
    }
  }, [rawId, fetchErrandData]);

  const handleRefresh = () => {
    fetchErrandData(true);
  };

  const grandTotal = Number(errand?.grandTotal ?? errand?.totalCost ?? 0).toFixed(2);
  const deliveryFee = Number(errand?.deliveryFee ?? 0).toFixed(2);
  const estimatedCost = Number(errand?.estimatedCost ?? 0).toFixed(2);
  const personnel = personnelLines(errand, checking);
  const paymentMethod = paymentMethodOf(errand);
  const ACTIVE_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];
  const isErrandActive = Boolean(errand?.status && ACTIVE_STATUSES.includes(String(errand.status).toUpperCase()));
  const isCancelled = errand?.status === 'CANCELLED';
  const isPendingOrAvailable = errand?.status === 'PENDING' || errand?.status === 'AVAILABLE';

  const formattedDate = errand?.createdAt
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
    navigation.navigate('CustomerChat', {
      user,
      errandId: rawId,
      initialStatus: errand?.status,
    });
  };

  const hairlineBorderColor = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
  const detailItems: any[] = Array.isArray(errand?.items) && errand.items.length > 0
    ? errand.items
    : Array.isArray(errand?.pabiliDetails)
    ? errand.pabiliDetails
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'left', 'right']}>
      {/* 1. CLEAN NAVIGATION HEADER */}
      <View style={[styles.navHeaderRow, { borderBottomColor: hairlineBorderColor, backgroundColor: colors.bgApp }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="errand-details-back-button"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>

        <View style={styles.navHeaderCenter}>
          <Text
            style={[styles.navTitle, { color: colors.textDark }]}
            numberOfLines={1}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
          >
            Errand {errandId}
          </Text>
          <Text
            style={[styles.navSubtitle, { color: colors.textLight }]}
            numberOfLines={1}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          >
            Transaction Summary
          </Text>
        </View>

        {/* Symmetric Spacer */}
        <View style={styles.headerSpacer} />
      </View>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textLight }]}>Loading errand summary...</Text>
        </View>
      ) : fetchError && !errand ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={32} color="#EF4444" strokeWidth={2} />
          <Text style={[styles.errorText, { color: colors.textDark }]}>{fetchError}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchErrandData()}
            activeOpacity={0.85}
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* SECTION 1: STATUS & DATE */}
          <View style={[styles.sectionRow, { borderBottomColor: hairlineBorderColor }]}>
            <View style={styles.statusRowTop}>
              <Text
                style={[styles.sectionLabel, { color: colors.textGray }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                Current Status
              </Text>
              {errand?.status && <StatusBadge status={errand.status} />}
            </View>

            <View style={styles.dateRow}>
              <Clock size={13} color={colors.textLight} />
              <Text
                style={[styles.dateText, { color: colors.textLight }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
              >
                {formattedDate}
              </Text>
            </View>
          </View>

          {/* SECTION 2: ITEMS REQUESTED */}
          <View style={[styles.sectionBlock, { borderBottomColor: hairlineBorderColor }]}>
            <View style={styles.sectionHeaderRow}>
              <ShoppingBag size={15} color={colors.primary} strokeWidth={2.2} />
              <Text
                style={[styles.sectionHeaderTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                Items Requested
              </Text>
            </View>

            {/* GET /errands/:id sends the list as pabiliDetails; `items` is the
                older shape some callers still pass in. Reading only `items` left
                this section empty for every errand opened from the server. */}
            {detailItems.length > 0 ? (
              <View style={styles.itemsListContainer}>
                {detailItems.map((item: any, idx: number) => {
                  const qty = Number(item.quantity) || 1;
                  const name = formatItemLabel(item.itemName || item.name || 'Item', item.size);
                  return (
                    <View key={String(idx)} style={styles.itemRow}>
                      <Text
                        style={[styles.itemQty, { color: colors.primary }]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                      >
                        {qty}×
                      </Text>
                      <Text
                        style={[styles.itemName, { color: colors.textDark }]}
                        numberOfLines={2}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                      >
                        {name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text
                style={[styles.bodyText, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                {errand?.categories || 'Pabili Shopping Request'}
              </Text>
            )}

            {errand?.notes ? (
              <Text
                style={[styles.notesText, { color: colors.textLight }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
              >
                Note: {errand.notes}
              </Text>
            ) : null}
          </View>

          {/* SECTION 3: DELIVERY DESTINATION */}
          <View style={[styles.sectionBlock, { borderBottomColor: hairlineBorderColor }]}>
            <View style={styles.sectionHeaderRow}>
              <MapPin size={15} color={colors.primary} strokeWidth={2.2} />
              <Text
                style={[styles.sectionHeaderTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                Delivery Destination
              </Text>
            </View>
            <Text
              style={[styles.bodyText, { color: colors.textMedium }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            >
              {errand?.deliveryAddress || 'Tacurong City, Sultan Kudarat'}
            </Text>
          </View>

          {/* SECTION 4: ASSIGNED PERSONNEL */}
          <View style={[styles.sectionBlock, { borderBottomColor: hairlineBorderColor }]}>
            <View style={styles.sectionHeaderRow}>
              <User size={15} color={colors.primary} strokeWidth={2.2} />
              <Text
                style={[styles.sectionHeaderTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                Assigned Personnel
              </Text>
            </View>
            <View style={styles.personnelList}>
              {([
                { key: 'dispatcher', label: 'Dispatcher', Icon: Headphones, line: personnel.dispatcher },
                { key: 'rider', label: 'Rider', Icon: Bike, line: personnel.rider },
              ] as const).map(({ key, label, Icon, line }) => (
                <View
                  key={key}
                  style={styles.personnelRow}
                  testID={`personnel-${key}`}
                  accessible
                  accessibilityLabel={`${label}: ${line.name ?? line.waiting}`}
                >
                  <Icon size={16} color={line.name ? colors.primary : colors.textLight} strokeWidth={2.2} />
                  <Text
                    style={[styles.personnelLabel, { color: colors.textGray }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.personnelText,
                      line.name
                        ? { color: colors.textDark, fontFamily: FontFamily.semibold }
                        : { color: colors.textLight },
                    ]}
                    numberOfLines={2}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                  >
                    {line.name ?? line.waiting}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* SECTION 5: PAYMENT & FEES */}
          <View style={[styles.sectionBlock, { borderBottomColor: hairlineBorderColor }]}>
            <View style={styles.sectionHeaderRow}>
              <CreditCard size={15} color={colors.primary} strokeWidth={2.2} />
              <Text
                style={[styles.sectionHeaderTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                Payment & Fees
              </Text>
            </View>

            <View style={styles.feeLine}>
              <Text
                style={[styles.feeLabel, { color: colors.textGray }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                Payment Method
              </Text>
              <Text
                style={[styles.feeValBold, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                {isCancelled
                  ? 'Voided (Not Charged)'
                  : isPendingOrAvailable || !paymentMethod || paymentMethod.toUpperCase() === 'PENDING'
                  ? 'Pending Selection'
                  : formatPaymentMethod(paymentMethod, 'full')}
              </Text>
            </View>

            {isCancelled ? (
              <View style={styles.cancelledNoteWrap}>
                <Text
                  style={styles.cancelledNoteText}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  This errand was cancelled. No delivery fees or item charges were collected.
                </Text>
              </View>
            ) : isPendingOrAvailable ? (
              <View style={styles.pendingFeeWrap}>
                <View style={styles.feeLine}>
                  <Text
                    style={[styles.feeLabel, { color: colors.textGray }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    Base Delivery Fare
                  </Text>
                  <Text
                    style={styles.pendingFareText}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    Pending Completion
                  </Text>
                </View>
                <Text
                  style={[styles.pendingNoteText, { color: colors.textLight }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  Note: The base delivery fare is finalized and applied once a rider accepts the errand and completes delivery.
                </Text>
              </View>
            ) : (
              <>
                {errand?.feeBreakdown ? (
                  <FeeBreakdownCard
                    breakdown={errand.feeBreakdown}
                    paymentPlan={(errand as any)?.paymentPlan ?? null}
                    testIDPrefix={`history-${errand.id ?? 'errand'}`}
                  />
                ) : (
                  <>
                    {Number(estimatedCost) > 0 && (
                      <View style={styles.feeLine}>
                        <Text
                          style={[styles.feeLabel, { color: colors.textGray }]}
                          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                        >
                          Estimated Items
                        </Text>
                        <Text
                          style={[styles.feeVal, { color: colors.textMedium }]}
                          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                        >
                          ₱{estimatedCost}
                        </Text>
                      </View>
                    )}

                    {Number(deliveryFee) > 0 && (
                      <View style={styles.feeLine}>
                        <Text
                          style={[styles.feeLabel, { color: colors.textGray }]}
                          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                        >
                          Delivery Fee
                        </Text>
                        <Text
                          style={[styles.feeVal, { color: colors.textMedium }]}
                          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                        >
                          ₱{deliveryFee}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.hairlineDivider, { backgroundColor: hairlineBorderColor }]} />

                    <View style={styles.totalLine}>
                      <Text
                        style={[styles.totalLabel, { color: colors.textDark }]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                      >
                        Total Fee(s)
                      </Text>
                      <Text
                        style={[styles.totalAmount, { color: colors.primary }]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                      >
                        ₱{grandTotal}
                      </Text>
                    </View>
                  </>
                )}

                {/* Delivery Proof Photos */}
                <View style={styles.proofStripWrap}>
                  <ErrandProofStrip errandId={String(errand?.id ?? rawId)} />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* 3. PINNED BOTTOM ACTION DOCK (THUMB ZONE) */}
      <View
        style={[
          styles.bottomActionDock,
          {
            backgroundColor: colors.card,
            borderTopColor: hairlineBorderColor,
            paddingBottom: Math.max(insets.bottom + Spacing.xs, Spacing.md),
          },
        ]}
      >
        {isErrandActive ? (
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
            onPress={handleOpenChat}
            accessibilityRole="button"
            accessibilityLabel="Open live chat with dispatcher"
            testID="open-live-chat-button"
          >
            <MessageCircle size={18} color="#FFFFFF" strokeWidth={2.2} />
            <Text
              style={styles.primaryActionBtnText}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            >
              Open Live Chat
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.secondaryActionBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray },
            ]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to errands"
          >
            <Text
              style={[styles.secondaryActionBtnText, { color: colors.textDark }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            >
              Back to Errands
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  navSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    marginTop: 1,
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  retryBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl + 20,
  },
  sectionRow: {
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  statusRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  sectionBlock: {
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  sectionHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption + 1),
    letterSpacing: 0.2,
  },
  bodyText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
  },
  notesText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    fontStyle: 'italic',
    marginTop: 6,
  },
  itemsListContainer: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQty: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    minWidth: 24,
  },
  itemName: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
  },
  personnelList: {
    gap: Spacing.sm,
  },
  personnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personnelLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    minWidth: 76,
  },
  personnelText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  feeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  feeVal: {
    fontFamily: FontFamily.mono,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  feeValBold: {
    fontFamily: FontFamily.monoBold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  hairlineDivider: {
    height: 1,
    marginVertical: Spacing.xs + 2,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  totalAmount: {
    fontFamily: FontFamily.monoBold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading + 1),
  },
  cancelledNoteWrap: {
    paddingVertical: Spacing.xs,
  },
  cancelledNoteText: {
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    color: '#DC2626',
    fontStyle: 'italic',
  },
  pendingFeeWrap: {
    paddingVertical: 4,
    gap: 4,
  },
  pendingFareText: {
    color: '#D97706',
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    fontFamily: FontFamily.semibold,
  },
  pendingNoteText: {
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    fontStyle: 'italic',
  },
  proofStripWrap: {
    marginTop: Spacing.sm,
  },
  bottomActionDock: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: BorderRadius.lg,
  },
  primaryActionBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  secondaryActionBtn: {
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
});
