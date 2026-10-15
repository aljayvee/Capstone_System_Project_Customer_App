import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, MapPin, ShoppingBag, Store } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing } from '../config/theme';
import { formatDistance, formatDuration } from '../utils/format';

export interface RiderToStorePanelProps {
  /** The next store the rider is heading to, if known. */
  storeName?: string | null;
  /** How many stores are still to visit. */
  storesLeft: number;
  /** Road time and distance from the rider to the stores (the shopping run). */
  etaSeconds: number | null;
  distanceMeters: number | null;
  /** The rider is inside the store now, buying. */
  atStore: boolean;
  /** A rider has been assigned and their position is known. */
  riderLocated: boolean;
}

/**
 * What the Track tab shows while the rider is still shopping: where they are
 * heading, how long until they get there, and how far they are. No map.
 *
 * The map is for the rider coming to the customer. While the rider is riding
 * to a store, a map with a line to somewhere else only raised "why are they
 * going the other way?"; the two numbers are what the customer needs. The map
 * appears on its own once everything is bought (TrackTab), together with the
 * "on the way" push notification.
 */
export default function RiderToStorePanel({
  storeName,
  storesLeft,
  etaSeconds,
  distanceMeters,
  atStore,
  riderLocated,
}: RiderToStorePanelProps) {
  const { colors, isDark } = useThemeColor();
  const store = storeName?.trim() || 'the store';

  const headline = !riderLocated
    ? 'Waiting for your rider'
    : atStore
      ? `Your rider is buying your items at ${store}`
      : storesLeft > 1
        ? `Your rider is heading to ${store}, then ${storesLeft - 1} more ${storesLeft - 1 === 1 ? 'store' : 'stores'}`
        : `Your rider is heading to ${store}`;

  const showNumbers = riderLocated && !atStore && etaSeconds != null && distanceMeters != null;

  return (
    <View style={[styles.wrapper, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]} testID="rider-to-store-panel">
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
        <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(255,77,121,0.15)' : '#FFF0F5' }]}>
          {atStore ? (
            <ShoppingBag size={22} color={colors.primary} strokeWidth={2.2} />
          ) : (
            <Store size={22} color={colors.primary} strokeWidth={2.2} />
          )}
        </View>

        <Text style={[styles.headline, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
          {headline}
        </Text>

        {showNumbers && (
          <View style={styles.metricsRow}>
            <View style={[styles.metric, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
              <Clock size={14} color={colors.primary} strokeWidth={2.2} />
              <Text style={[styles.metricValue, { color: colors.textDark }]} maxFontSizeMultiplier={1.2} testID="store-eta">
                {formatDuration(etaSeconds!)}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                to the store
              </Text>
            </View>
            <View style={[styles.metric, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
              <MapPin size={14} color={colors.primary} strokeWidth={2.2} />
              <Text style={[styles.metricValue, { color: colors.textDark }]} maxFontSizeMultiplier={1.2} testID="store-distance">
                {formatDistance(distanceMeters!)}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                by road
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.note, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
          The live map opens when your rider is on the way to you. We will send you a notification then, even if
          the app is closed.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    lineHeight: FontSizes.lg * 1.3,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metric: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
  metricValue: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  note: {
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.45,
  },
});
