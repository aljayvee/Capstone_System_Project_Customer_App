import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Bike,
  MapPin,
  Store,
  User,
  ShoppingBag,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  BorderRadius,
  FontSizes,
  Spacing,
  FontFamily,
  Shadows,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
import StatusBadge from '../../components/StatusBadge';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import RiderToStorePanel from '../../components/RiderToStorePanel';
import { useOsmTilesAvailable } from '../../config/mapTiles';
import { chosenMapFor, engineForMap, useMapChoice } from '../../config/mapChoice';
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
  focusedErrandId?: string;
  onScroll?: (event: any) => void;
}

export default function TrackTab({ user, navigation, activeErrands, focusedErrandId, onScroll }: TrackTabProps) {
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, height: windowHeight, isTablet, isCompact, isTallAspect } = useResponsive();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // If focusedErrandId is provided, switch selectedIndex to matching errand
  React.useEffect(() => {
    if (focusedErrandId && activeErrands?.length > 0) {
      const idx = activeErrands.findIndex(
        (e) => String(e.id || e.errandId) === String(focusedErrandId)
      );
      if (idx !== -1) {
        setSelectedIndex(idx);
      }
    }
  }, [focusedErrandId, activeErrands]);

  const count = activeErrands.length;
  const safeIndex = Math.min(selectedIndex, Math.max(0, count - 1));
  const selectedErrand = activeErrands[safeIndex];

  // Whether our OpenStreetMap tiles load, for when the rider's map is OSM.
  const osmTilesUp = useOsmTilesAvailable(true);

  // Rider live location for the active errand
  const {
    location: riderLocation,
    freshness: gpsFreshness,
    label: gpsLabel,
  } = useRiderLiveLocation(selectedErrand?.riderId ?? null, selectedErrand?.id ?? null);

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

  // The map this errand's tracking already settled on, if it has: every route
  // after the first is asked for on its roads.
  const errandKey = selectedErrand?.id ? String(selectedErrand.id) : null;
  const chosenMap = chosenMapFor(errandKey);

  // Live GIS Driving Route
  const {
    coordinates: routeCoordinates,
    pickupLegCoordinates,
    deliveryLegCoordinates,
    distanceMeters,
    durationSeconds,
    pickupDistanceMeters,
    pickupDurationSeconds,
    deliveryDistanceMeters,
    deliveryDurationSeconds,
    nextStopRoadMeters,
    degraded: routeDegraded,
    lineEngine: routeLineEngine,
    unroutable: routeUnroutable,
  } = useLiveRoute(riderLocation, customerCoordinate, waypoints, {
    // The route the rider is following, as the server decided it for them
    // (the fastest of OSRM and Google), reused for this errand so both apps
    // show the same line on the same map. Before a map is chosen nothing is
    // named, and the first answer's roads choose it; Google's roads only while
    // our OpenStreetMap tiles are not loading. After, the chosen map's roads,
    // and the hook takes no other engine's line for it.
    choose: 'fastest',
    errandId: errandKey ?? undefined,
    provider: chosenMap ? engineForMap(chosenMap) : osmTilesUp ? undefined : 'google',
  });

  // Progress stage
  const stage = selectedErrand
    ? getErrandProgressStage({
        status: selectedErrand.status,
        itemsPurchasedAt: selectedErrand.itemsPurchasedAt,
        pinpoints: selectedErrand.pinpoints,
        riderLocation,
        destination: customerCoordinate,
        nextStopRoadMeters,
      })
    : { index: 0, label: 'Order Received' };

  // The map only once the rider is bringing the order: everything bought, on
  // the way to the customer. Before that, ETA and distance to the store.
  const delivering = stage.index >= 3;
  // The same map as the rider's: the one whose roads their route was drawn on,
  // chosen once per errand. Null, and no map drawn, until the first route.
  const mapStyle = useMapChoice(errandKey, {
    lineEngine: routeLineEngine,
    routeFailed: routeDegraded,
    osmTilesUp,
    // This map's engine could not route at all: move to the other map, once.
    unroutable: routeUnroutable,
  });
  const nextStop = remainingStops.find((p: any) => !p.departedAt) ?? null;

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
          <Text style={[styles.emptyTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>All Caught Up!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            You have no active errands in progress.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.rootContainer, { backgroundColor: colors.bgApp }]}>
      {/* 1. Top Section: The Single Universal Live Map (Root level View, outside any ScrollView) */}
      <View style={styles.mapSection}>
        {delivering ? (
          <LiveTrackingMap
            customerCoordinate={customerCoordinate}
            riderLocation={riderLocation}
            pinpoints={pinpoints}
            routeCoordinates={routeCoordinates}
            pickupLegCoordinates={pickupLegCoordinates}
            deliveryLegCoordinates={deliveryLegCoordinates}
            distanceMeters={distanceMeters}
            durationSeconds={durationSeconds}
            pickupDistanceMeters={pickupDistanceMeters}
            pickupDurationSeconds={pickupDurationSeconds}
            deliveryDistanceMeters={deliveryDistanceMeters}
            deliveryDurationSeconds={deliveryDurationSeconds}
            degraded={routeDegraded}
            // Only ever the delivery run here: while the rider is shopping this
            // slot shows RiderToStorePanel instead of a map.
            phase="delivering"
            mapStyle={mapStyle}
            lineEngine={routeLineEngine}
          />
        ) : (
          <RiderToStorePanel
            storeName={nextStop?.storeName ?? null}
            storesLeft={remainingStops.length}
            etaSeconds={pickupDurationSeconds}
            distanceMeters={pickupDistanceMeters}
            atStore={Boolean(nextStop?.arrivedAt)}
            riderLocated={Boolean(riderLocation)}
          />
        )}

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
                    <Text
                      style={[
                        styles.switcherText,
                        { color: isSelected ? '#FFFFFF' : colors.textDark },
                      ]}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
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
          contentContainerStyle={[styles.panelScrollContent, { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%', paddingBottom: 80 + Math.max(insets.bottom, 16) + Spacing.md }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* Header Row: ID, Category, Status Badge */}
          <View style={styles.cardHeader}>
            <View style={styles.headerLeftCol}>
              <View style={styles.idRow}>
                <Text style={[styles.cardTitle, { color: colors.textDark }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
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
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
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
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
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
                  <Text style={[styles.liveStatusText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
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
                <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Assigned Rider</Text>
                <View style={styles.riderNameRow}>
                  <Text style={[styles.infoValue, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
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
                  <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                    Store {pinpoints.length > 1 ? `Stops (${pinpoints.length})` : 'Stop'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
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
                <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Delivery Destination</Text>
                <Text style={[styles.infoValue, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                  {selectedErrand.deliveryAddress || 'Tacurong City'}
                </Text>
              </View>
            </View>
          </View>

          {/* Financial Certainty Footer */}
          <View style={styles.footerRow}>
            <Text style={[styles.totalLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>Total Errand Fee</Text>
            <Text style={[styles.totalAmount, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
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
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.hero),
    lineHeight: getPortalLineHeight(PortalFontSizes.hero, 'heading'),
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
    textAlign: 'center',
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
    paddingVertical: 8,
    minHeight: PortalTouchTargets.compact,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  switcherText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
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
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
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
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
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
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
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
    paddingVertical: Spacing.sm + 2,
    minHeight: 48,
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
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
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
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
  },
  totalAmount: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.price),
    lineHeight: getPortalLineHeight(PortalFontSizes.price, 'heading'),
  },
});
