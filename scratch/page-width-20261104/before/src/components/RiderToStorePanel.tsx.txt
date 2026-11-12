import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, MapPin } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { Spacing, FontFamily, PortalFontSizes } from '../config/theme';
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
  const { colors } = useThemeColor();
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
    <View style={[styles.wrapper, { backgroundColor: colors.bgApp }]} testID="rider-to-store-panel">
      <View style={styles.card}>
        <Text style={[styles.headline, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
          {headline}
        </Text>

        {showNumbers && (
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Clock size={17} color={colors.textGray} strokeWidth={1.8} />
              <Text style={[styles.metricValue, { color: colors.textDark }]} maxFontSizeMultiplier={1.2} testID="store-eta">
                {formatDuration(etaSeconds!)}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                to the store
              </Text>
            </View>
            <View style={styles.metric}>
              <MapPin size={17} color={colors.textGray} strokeWidth={1.8} />
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
          The live map opens when your rider is on the way to you. We will notify you then.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  card: {
    gap: Spacing.lg,
  },
  headline: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.subheading,
    lineHeight: 23,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metric: {
    flex: 1,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  metricValue: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.title,
    lineHeight: 26,
    marginTop: 4,
  },
  metricLabel: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: 19,
  },
  note: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: 19,
  },
});
