import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  MapPin,
  X,
  Navigation,
  Clock,
  Store,
  User,
  ShoppingBag,
  Maximize2,
  Phone,
  ShieldCheck,
} from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows, scaledFontSize, moderateScale } from '../config/theme';
import StatusBadge from './StatusBadge';
import LiveTrackingMap from './LiveTrackingMap';
import ErrandProgressStepper from './ErrandProgressStepper';
import { toCoordinate, DEFAULT_CENTER } from '../utils/coords';
import { formatErrandId } from '../utils/formatErrandId';
import { formatDuration, formatDistance } from '../utils/format';
import { useRiderLiveLocation } from '../hooks/useRiderLiveLocation';
import { useErrandEta } from '../hooks/useErrandEta';
import { toEtaWindow, formatEtaWindow, formatEtaBreakdown } from '../utils/eta';
import { formatDelayNotice } from '../hooks/useErrandEta';
import { useLiveRoute } from '../hooks/useLiveRoute';
import { getErrandProgressStage } from '../utils/errandProgress';

export interface ErrandTrackCardProps {
  errand: any;
}

export default function ErrandTrackCard({ errand }: ErrandTrackCardProps) {
  const { colors, isDark } = useThemeColor();
  const [isMapOpen, setIsMapOpen] = useState(false);
  const {
    location: riderLocation,
    freshness: gpsFreshness,
    label: gpsLabel,
  } = useRiderLiveLocation(errand?.riderId ?? null);

  const { telemetry: etaTelemetry, delayNotice } = useErrandEta(errand?.id ?? null);

  const customerCoordinate =
    toCoordinate(errand?.deliveryLatitude, errand?.deliveryLongitude) ??
    toCoordinate(errand?.latitude, errand?.longitude) ??
    DEFAULT_CENTER;

  const pinpoints = (errand?.pinpoints ?? [])
    .map((p: any) => ({
      id: Number(p.id) || 0,
      storeName: String(p.storeName || 'Store'),
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      sequence: Number(p.sequence) || 1,
      arrivedAt: p.arrivedAt ?? null,
      departedAt: p.departedAt ?? null,
      geofenceRadiusMeters: p.geofenceRadiusMeters ?? null,
    }))
    .filter((p: any) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));

  const waypoints = pinpoints
    .filter((p: any) => !p.departedAt && !p.arrivedAt)
    .map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));

  const {
    coordinates: routeCoordinates,
    pickupLegCoordinates,
    deliveryLegCoordinates,
    distanceMeters,
    durationSeconds,
  } = useLiveRoute(
    riderLocation,
    customerCoordinate,
    waypoints
  );

  const stage = getErrandProgressStage({
    status: errand.status,
    itemsPurchasedAt: errand.itemsPurchasedAt,
    pinpoints: errand.pinpoints,
    riderLocation,
    destination: customerCoordinate,
  });

  const etaWindow = toEtaWindow(errand?.etaLowAt, errand?.etaHighAt);
  const etaText = formatEtaWindow(etaWindow) ?? (durationSeconds != null ? formatDuration(durationSeconds) : null);
  const etaBreakdown = etaWindow
    ? formatEtaBreakdown(etaTelemetry?.travelSeconds, etaTelemetry?.dwellLowSeconds, etaTelemetry?.remainingStopCount)
    : null;
  const hasEta = etaText != null;
  const delayNoticeText = formatDelayNotice(delayNotice);
  const isDelivered = String(errand?.status || '').toUpperCase() === 'DELIVERED';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: isDark ? colors.border : '#EDEFF2' },
        Shadows.soft,
      ]}
      testID={`track-card-${errand.orderId}`}
    >
      {/* 1. Header: Errand ID, Live GPS Signal & Status Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeftCol}>
          <View style={styles.idRow}>
            <Text style={[styles.cardTitle, { color: colors.textDark }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
              #{formatErrandId(errand.orderId)}
            </Text>
            {errand.categories && (
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
                  {errand.categories}
                </Text>
              </View>
            )}
          </View>

          {/* Psychological reassurance signal: live GPS status */}
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
                ? 'Waiting for rider signal...'
                : gpsFreshness === 'LIVE'
                  ? 'Live GPS Active'
                  : gpsLabel}
            </Text>
          </View>
        </View>

        <StatusBadge status={errand.status} />
      </View>

      {/* 2. Visual Progress Stepper & Spotlight */}
      <ErrandProgressStepper currentIndex={stage.index} subLabel={stage.subLabel} />

      {/* 3. Interactive Live Map Preview Hero Card */}
      {!isDelivered && (
        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.mapHeroCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#F0FDF4',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#DCFCE7',
            },
          ]}
          onPress={() => setIsMapOpen(true)}
          testID={`view-live-map-${errand.orderId}`}
        >
          <View style={styles.mapHeroHeader}>
            <View style={styles.mapHeroTitleGroup}>
              <View
                style={[
                  styles.mapHeroIconBadge,
                  { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#D1FAE5' },
                ]}
              >
                <Navigation size={16} color={isDark ? '#34D399' : '#059669'} strokeWidth={2.4} />
              </View>
              <View>
                <Text style={[styles.mapHeroTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>Live Route Tracking</Text>
                <Text style={[styles.mapHeroSub, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                  {riderLocation && gpsFreshness === 'LIVE'
                    ? 'Tap to view live turn-by-turn map'
                    : 'View errand path & destinations'}
                </Text>
              </View>
            </View>

            <View style={[styles.expandBtn, { backgroundColor: colors.primary }]}>
              <Maximize2 size={13} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </View>

          {/* Dynamic ETA & Distance Chips */}
          <View style={styles.metricsRow}>
            {hasEta ? (
              <>
                <View
                  style={[
                    styles.metricChip,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' },
                  ]}
                >
                  <Clock size={12} color={colors.primary} strokeWidth={2.2} />
                  <Text style={[styles.metricChipText, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                    ETA: {etaText}
                  </Text>
                </View>
                <View
                  style={[
                    styles.metricChip,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' },
                  ]}
                >
                  <MapPin size={12} color={colors.primary} strokeWidth={2.2} />
                  <Text style={[styles.metricChipText, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                    {distanceMeters != null ? `${formatDistance(distanceMeters)} away` : 'Distance pending'}
                  </Text>
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.metricChip,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' },
                ]}
              >
                <Navigation size={12} color={colors.textGray} strokeWidth={2} />
                <Text style={[styles.metricChipText, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                  Calculating GIS driving route...
                </Text>
              </View>
            )}
          </View>

          {etaBreakdown ? (
            <Text style={[styles.etaNoteText, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>{etaBreakdown}</Text>
          ) : null}

          {delayNoticeText ? (
            <View style={[styles.delayNotice, { backgroundColor: isDark ? 'rgba(245,158,11,0.14)' : '#FFFBEB' }]}>
              <Clock size={12} color="#B45309" strokeWidth={2.2} />
              <Text style={[styles.delayNoticeText, { color: '#92400E' }]} maxFontSizeMultiplier={1.15}>{delayNoticeText}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      )}

      {/* 4. Structured Information Section (Chunked for Low Cognitive Load) */}
      <View
        style={[
          styles.infoSection,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.bgGray,
            borderColor: isDark ? colors.border : '#F3F4F6',
          },
        ]}
      >
        {/* Assigned Rider Row */}
        <View style={styles.infoRow}>
          <View style={[styles.infoIconWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EBF5FF' }]}>
            <User size={15} color={isDark ? '#93C5FD' : '#2563EB'} strokeWidth={2.2} />
          </View>
          <View style={styles.infoContentCol}>
            <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={1.2}>Assigned Rider</Text>
            <View style={styles.riderNameRow}>
              <Text style={[styles.infoValue, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
                {errand.riderName || 'Assigning nearest rider...'}
              </Text>
              {errand.riderName && (
                <ShieldCheck size={13} color={colors.success} strokeWidth={2.2} />
              )}
            </View>
          </View>
        </View>

        {/* Store / Stops Row */}
        {pinpoints.length > 0 && (
          <View style={styles.infoRow}>
            <View style={[styles.infoIconWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFF7ED' }]}>
              <Store size={15} color={isDark ? '#FDBA74' : '#EA580C'} strokeWidth={2.2} />
            </View>
            <View style={styles.infoContentCol}>
              <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={1.2}>
                Store {pinpoints.length > 1 ? `Stops (${pinpoints.length})` : 'Stop'}
              </Text>
              <Text style={[styles.infoValue, { color: colors.textDark }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
                {pinpoints.map((p: any) => p.storeName).join(' → ')}
              </Text>
            </View>
          </View>
        )}

        {/* Destination Address Row */}
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <View style={[styles.infoIconWrapper, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FDF2F8' }]}>
            <MapPin size={15} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.infoContentCol}>
            <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={1.2}>Delivery Destination</Text>
            <Text style={[styles.infoValue, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={1.25}>
              {errand.deliveryAddress || 'Tacurong City'}
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Financial Certainty Footer */}
      <View style={styles.footerRow}>
        <Text style={[styles.totalLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>Total Errand Fee</Text>
        <Text style={[styles.totalAmount, { color: colors.primary }]} maxFontSizeMultiplier={1.25}>
          ₱{Number(errand.grandTotal ?? errand.totalCost ?? 0).toFixed(2)}
        </Text>
      </View>

      {/* 6. Full Screen Interactive Live GPS Map Modal */}
      <Modal visible={isMapOpen} animationType="slide" transparent={false} onRequestClose={() => setIsMapOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.bgApp }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
                Errand #{formatErrandId(errand.orderId)}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                Live Route & Real-Time GPS
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsMapOpen(false)}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
              testID="close-live-map"
            >
              <X size={20} color={colors.textDark} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalMapWrapper}>
            {isMapOpen && (
              <LiveTrackingMap
                customerCoordinate={customerCoordinate}
                riderLocation={riderLocation}
                pinpoints={pinpoints}
                routeCoordinates={routeCoordinates}
                pickupLegCoordinates={pickupLegCoordinates}
                deliveryLegCoordinates={deliveryLegCoordinates}
                distanceMeters={distanceMeters}
                durationSeconds={durationSeconds}
                phase={stage.index >= 3 ? 'delivering' : 'shopping'}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
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
    gap: 6,
    marginTop: 2,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveStatusText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.xs, 0.3),
  },
  mapHeroCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  mapHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapHeroTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  mapHeroIconBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHeroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.3),
  },
  mapHeroSub: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.3),
  },
  expandBtn: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  metricChipText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.3),
  },
  etaNoteText: {
    fontSize: scaledFontSize(11, 0.3),
    marginTop: 6,
    marginLeft: 2,
  },
  delayNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  delayNoticeText: {
    flex: 1,
    fontSize: scaledFontSize(11.5, 0.3),
    lineHeight: moderateScale(16, 0.3),
  },
  infoSection: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: moderateScale(Spacing.sm, 0.3),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  infoIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContentCol: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.3),
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.3),
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
    paddingTop: Spacing.xs,
  },
  totalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.sm, 0.3),
  },
  totalAmount: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.lg, 0.35),
  },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: scaledFontSize(FontSizes.md, 0.35), fontFamily: FontFamily.bold },
  modalSubtitle: { fontSize: scaledFontSize(FontSizes.xs, 0.3), fontFamily: FontFamily.regular, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMapWrapper: { flex: 1 },
});
