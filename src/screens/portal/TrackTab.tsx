import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Bike,
  Compass,
  MapPin,
  Store,
  User,
  ShoppingBag,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../../config/theme';
import StatusBadge from '../../components/StatusBadge';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import ErrandProgressStepper from '../../components/ErrandProgressStepper';
import { toCoordinate, DEFAULT_CENTER } from '../../utils/coords';
import { formatErrandId } from '../../utils/formatErrandId';
import { useRiderLiveLocation } from '../../hooks/useRiderLiveLocation';
import { useLiveRoute } from '../../hooks/useLiveRoute';
import { getErrandProgressStage } from '../../utils/errandProgress';

export interface TrackTabProps {
  user: any;
  navigation: any;
  activeErrands: any[];
}

export default function TrackTab({ user, navigation, activeErrands }: TrackTabProps) {
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, height: windowHeight, isTablet, isCompact, isTallAspect } = useResponsive();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const count = activeErrands.length;
  const safeIndex = Math.min(selectedIndex, Math.max(0, count - 1));
  const selectedErrand = activeErrands[safeIndex];

  // Rider live location for the active errand
  const {
    location: riderLocation,
    freshness: gpsFreshness,
    label: gpsLabel,
  } = useRiderLiveLocation(selectedErrand?.riderId ?? null);

  // Coordinates for the active errand
  const customerCoordinate =
    toCoordinate(selectedErrand?.deliveryLatitude, selectedErrand?.deliveryLongitude) ??
    toCoordinate(selectedErrand?.latitude, selectedErrand?.longitude) ??
    DEFAULT_CENTER;

  // Every stop on the errand, in the order the dispatcher pinned them.
  const pinpoints = (selectedErrand?.pinpoints ?? [])
    .map((p: any) => ({
      id: Number(p.id) || 0,
      storeName: String(p.storeName || 'Store'),
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      sequence: Number(p.sequence) || 1,
      arrivedAt: p.arrivedAt ?? null,
      departedAt: p.departedAt ?? null,
    }))
    .filter((p: any) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));

  const remainingStops = pinpoints.filter((p: any) => !p.departedAt);
  const waypoints = remainingStops
    .filter((p: any) => !p.arrivedAt)
    .map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));

  // Live GIS Driving Route
  const {
    coordinates: routeCoordinates,
    pickupLegCoordinates,
    deliveryLegCoordinates,
    distanceMeters,
    durationSeconds,
    degraded: routeDegraded,
  } = useLiveRoute(
    riderLocation,
    customerCoordinate,
    waypoints
  );

  // Progress stage
  const stage = selectedErrand
    ? getErrandProgressStage({
        status: selectedErrand.status,
        itemsPurchasedAt: selectedErrand.itemsPurchasedAt,
        pinpoints: selectedErrand.pinpoints,
        riderLocation,
        destination: customerCoordinate,
      })
    : { index: 0, label: 'Order Received' };

  const insets = useSafeAreaInsets();
  const bottomPanelHeight = isCompact
    ? moderateScale(310, 0.2)
    : isTallAspect
    ? moderateScale(420, 0.2)
    : moderateScale(365, 0.2);

  if (count === 0) {
    return (
      <View
        style={[
          styles.flex,
          {
            backgroundColor: colors.bgApp,
            paddingHorizontal: Spacing.xl,
            paddingTop: insets.top > 0 ? insets.top + Spacing.md : Spacing.lg,
            paddingBottom: Spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <View style={[styles.emptyContainer, { maxWidth: MAX_CONTENT_WIDTH }]}>
          <View
            style={[
              styles.emptyIconWrapper,
              { backgroundColor: isDark ? 'rgba(255, 77, 121, 0.1)' : '#FFF0F5' },
            ]}
          >
            <Compass size={40} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>All Caught Up!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.25}>
            You have no active errands in progress. Whenever you request a delivery or shopping errand, live GPS tracking and progress updates will appear right here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.bgApp }]}>
      {/* 1. Top Section: The Single Universal Live Map (Root level View, outside any ScrollView) */}
      <View style={styles.mapSection}>
        <LiveTrackingMap
          customerCoordinate={customerCoordinate}
          riderLocation={riderLocation}
          pinpoints={pinpoints}
          routeCoordinates={routeCoordinates}
          pickupLegCoordinates={pickupLegCoordinates}
          deliveryLegCoordinates={deliveryLegCoordinates}
          distanceMeters={distanceMeters}
          durationSeconds={durationSeconds}
          degraded={routeDegraded}
        />

        {/* Multi-Errand Tab Switcher Overlay (shown when > 1 active errand exists) */}
        {count > 1 && (
          <View style={styles.switcherOverlay}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.switcherScroll}
            >
              {activeErrands.map((errand, idx) => {
                const isSelected = idx === safeIndex;
                return (
                  <TouchableOpacity
                    key={errand.orderId}
                    activeOpacity={0.85}
                    onPress={() => setSelectedIndex(idx)}
                    style={[
                      styles.switcherTab,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : isDark
                          ? 'rgba(31, 41, 55, 0.92)'
                          : 'rgba(255, 255, 255, 0.95)',
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                      Shadows.soft,
                    ]}
                  >
                    <View
                      style={[
                        styles.switcherDot,
                        { backgroundColor: isSelected ? '#FFFFFF' : colors.primary },
                      ]}
                    />
                    <Text
                      style={[
                        styles.switcherText,
                        { color: isSelected ? '#FFFFFF' : colors.textDark },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      #{formatErrandId(errand.orderId)}
                      {errand.categories ? ` • ${errand.categories}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* 2. Bottom Section: Selected Errand Live Mission Control Panel */}
      <View
        style={[
          styles.bottomPanel,
          {
            height: bottomPanelHeight,
            backgroundColor: colors.card,
            borderTopColor: isDark ? colors.border : '#EDEFF2',
          },
          Shadows.liftedUp,
        ]}
      >
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={[styles.panelScrollContent, { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Row: ID, Category, Status Badge */}
          <View style={styles.cardHeader}>
            <View style={styles.headerLeftCol}>
              <View style={styles.idRow}>
                <Text style={[styles.cardTitle, { color: colors.textDark }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
                  #{formatErrandId(selectedErrand.orderId)}
                </Text>
                {selectedErrand.categories && (
                  <View
                    style={[
                      styles.categoryPill,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray },
                    ]}
                  >
                    <ShoppingBag size={11} color={colors.textMedium} strokeWidth={2.2} />
                    <Text
                      style={[styles.categoryText, { color: colors.textMedium }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      maxFontSizeMultiplier={1.15}
                    >
                      {selectedErrand.categories}
                    </Text>
                  </View>
                )}
              </View>

              {/* Psychological Reassurance: Live Signal Status */}
              <View style={styles.liveStatusRow}>
                <View
                  style={[
                    styles.livePulseDot,
                    {
                      backgroundColor:
                        gpsFreshness === 'LIVE'
                          ? colors.success
                          : gpsFreshness === 'STALE'
                            ? colors.warning
                            : colors.textGray,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.liveStatusText,
                    { color: gpsFreshness === 'LIVE' ? colors.success : colors.textGray },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {!riderLocation
                    ? 'Connecting with rider GPS...'
                    : gpsFreshness === 'LIVE'
                      ? 'Rider Live GPS Broadcast Active'
                      : gpsLabel}
                </Text>
              </View>

              {/* Approximate route note */}
              {routeDegraded && (
                <View style={styles.liveStatusRow}>
                  <View style={[styles.livePulseDot, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.liveStatusText, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
                    Showing an approximate route — road directions are unavailable right now
                  </Text>
                </View>
              )}
            </View>

            <StatusBadge status={selectedErrand.status} />
          </View>

          {/* Errand Live Stepper & Active Stage Spotlight */}
          <ErrandProgressStepper currentIndex={stage.index} subLabel={stage.subLabel} />

          {/* Structured Details Card (Chunked Information for low cognitive load) */}
          <View
            style={[
              styles.infoSection,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.bgGray,
                borderColor: isDark ? colors.border : '#F3F4F6',
              },
            ]}
          >
            {/* Assigned Rider */}
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIconWrapper,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EBF5FF' },
                ]}
              >
                <User size={15} color={isDark ? '#93C5FD' : '#2563EB'} strokeWidth={2.2} />
              </View>
              <View style={styles.infoContentCol}>
                <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={1.2}>Assigned Rider</Text>
                <View style={styles.riderNameRow}>
                  <Text style={[styles.infoValue, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
                    {selectedErrand.riderName || 'Assigning nearest rider...'}
                  </Text>
                  {selectedErrand.riderName && (
                    <ShieldCheck size={13} color={colors.success} strokeWidth={2.2} />
                  )}
                </View>
              </View>
            </View>

            {/* Store Stops */}
            {pinpoints.length > 0 && (
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIconWrapper,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFF7ED' },
                  ]}
                >
                  <Store size={15} color={isDark ? '#FDBA74' : '#EA580C'} strokeWidth={2.2} />
                </View>
                <View style={styles.infoContentCol}>
                  <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={1.2}>
                    Store {pinpoints.length > 1 ? `Stops (${pinpoints.length})` : 'Stop'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={1.25}>
                    {pinpoints.map((p: any) => p.storeName).join(' → ')}
                  </Text>
                </View>
              </View>
            )}

            {/* Destination Address */}
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <View
                style={[
                  styles.infoIconWrapper,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FDF2F8' },
                ]}
              >
                <MapPin size={15} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.infoContentCol}>
                <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={1.2}>Delivery Destination</Text>
                <Text style={[styles.infoValue, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={1.25}>
                  {selectedErrand.deliveryAddress || 'Tacurong City'}
                </Text>
              </View>
            </View>
          </View>

          {/* Financial Certainty Footer */}
          <View style={styles.footerRow}>
            <Text style={[styles.totalLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>Total Errand Fee</Text>
            <Text style={[styles.totalAmount, { color: colors.primary }]} maxFontSizeMultiplier={1.25}>
              ₱{Number(selectedErrand.grandTotal ?? selectedErrand.totalCost ?? 0).toFixed(2)}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rootContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyIconWrapper: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.lg, 0.35),
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.sm, 0.3),
    textAlign: 'center',
    lineHeight: moderateScale(20, 0.3),
  },
  mapSection: {
    flex: 1,
    position: 'relative',
  },
  switcherOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
  },
  switcherScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  switcherTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  switcherDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  switcherText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.3),
  },
  bottomPanel: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    padding: Spacing.md,
    paddingBottom: 110,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  headerLeftCol: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
    letterSpacing: -0.2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    flexShrink: 1,
    maxWidth: '65%',
  },
  categoryText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(9.5, 0.2),
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveStatusText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  infoSection: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginVertical: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingVertical: moderateScale(Spacing.sm, 0.2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  infoIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContentCol: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(9, 0.2),
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginTop: 1,
  },
  riderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
  },
  totalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
  },
  totalAmount: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.md + 1, 0.2),
  },
});
