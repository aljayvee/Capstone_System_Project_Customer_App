import React from 'react';
import { StyleSheet, View } from 'react-native';
import ShimmerWave from './ShimmerWave';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, Spacing, Shadows, MAX_CONTENT_WIDTH, useResponsive } from '../config/theme';

/**
 * 0. WELCOME GREETING & DELIVERY LOCATION SKELETON
 */
export function LocationCardSkeleton() {
  const { colors, isDark } = useThemeColor();

  return (
    <View style={styles.greetingHeaderSection} testID="location-card-skeleton">
      {/* Greeting line placeholder: Hi, Customer! 👋 */}
      <ShimmerWave width={140} height={20} borderRadius={6} style={{ marginBottom: Spacing.sm }} />

      {/* Delivery location card container */}
      <View
        style={[
          styles.deliveryLocationCardSkeleton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          Shadows.soft,
        ]}
      >
        {/* MapPin icon square placeholder */}
        <ShimmerWave
          width={32}
          height={32}
          borderRadius={16}
          style={{ marginRight: Spacing.sm }}
        />

        {/* Column with 2 text lines */}
        <View style={styles.locationInfoCol}>
          <ShimmerWave width={85} height={10} borderRadius={4} style={{ marginBottom: 5 }} />
          <ShimmerWave width="80%" height={14} borderRadius={4} />
        </View>

        {/* Chevron placeholder */}
        <ShimmerWave width={14} height={14} borderRadius={7} />
      </View>
    </View>
  );
}

/**
 * 1. ACTIVE ERRAND CARD SKELETON
 */
export function ActiveErrandSkeleton() {
  const { colors, isDark } = useThemeColor();

  return (
    <View style={styles.activeSectionWrapper} testID="active-errand-skeleton">
      <View
        style={[
          styles.activeCardSkeleton,
          {
            backgroundColor: colors.card,
            borderColor: isDark ? 'rgba(246, 36, 89, 0.25)' : '#FFE4EC',
          },
          Shadows.liftedUp,
        ]}
      >
        {/* Header Row: Pulse Dot + Title + Status Badge Pill */}
        <View style={styles.activeHeaderRow}>
          <View style={styles.activeHeaderLeft}>
            <ShimmerWave width={9} height={9} borderRadius={5} style={{ marginRight: 8 }} />
            <ShimmerWave width={150} height={16} borderRadius={5} />
          </View>
          <ShimmerWave width={72} height={22} borderRadius={BorderRadius.full} />
        </View>

        {/* Status Description Line */}
        <ShimmerWave width={220} height={12} borderRadius={4} style={{ marginVertical: 10 }} />

        {/* Framed Summary Item Box */}
        <View
          style={[
            styles.summaryItemBoxSkeleton,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB',
              borderColor: colors.border,
            },
          ]}
        >
          <ShimmerWave width={90} height={10} borderRadius={4} style={{ marginBottom: 5 }} />
          <ShimmerWave width="90%" height={13} borderRadius={4} />
        </View>

        {/* Footer Row: Button + See More */}
        <View style={styles.activeFooterRow}>
          <ShimmerWave width={105} height={32} borderRadius={16} />
          <ShimmerWave width={70} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

/**
 * 2. CATEGORIES BENTO GRID SKELETON
 */
export function CategoriesBentoSkeleton() {
  const { isDark } = useThemeColor();
  const { width: windowWidth } = useResponsive();
  const contentWidth = Math.min(windowWidth - Spacing.md * 2, MAX_CONTENT_WIDTH);
  const pairSlotWidth = Math.floor((contentWidth - Spacing.sm) / 2);

  return (
    <View style={styles.categoriesSectionWrapper} testID="categories-bento-skeleton">
      {/* Header Row: Sparkles Icon + Title */}
      <View style={styles.categoriesHeaderRow}>
        <ShimmerWave width={18} height={18} borderRadius={9} style={{ marginRight: 6 }} />
        <ShimmerWave width={175} height={16} borderRadius={5} />
      </View>

      {/* PABILI HERO TILE SKELETON */}
      <View
        style={[
          styles.featureCardSkeleton,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#E5E7EB',
          },
          Shadows.soft,
        ]}
      >
        <ShimmerWave width="100%" height={140} borderRadius={BorderRadius.md}>
          <View style={styles.featureContentSkeleton}>
            <ShimmerWave
              width={100}
              height={18}
              borderRadius={BorderRadius.full}
              style={{ marginBottom: 8 }}
            />
            <ShimmerWave width={160} height={20} borderRadius={5} style={{ marginBottom: 6 }} />
            <ShimmerWave width="75%" height={12} borderRadius={4} />
          </View>
        </ShimmerWave>
      </View>

      {/* BENTO MOSAIC GRID SKELETON */}
      <View style={styles.mosaic}>
        {/* Row 1: Tall Slot (left) beside Two Stacked Half Slots (right) */}
        <View style={styles.mosaicRow}>
          <View style={styles.mosaicTallSlot}>
            <ShimmerWave width="100%" height={176} borderRadius={BorderRadius.md} />
          </View>
          <View style={styles.mosaicStackSlot}>
            <ShimmerWave width="100%" height={82} borderRadius={BorderRadius.md} />
            <ShimmerWave width="100%" height={82} borderRadius={BorderRadius.md} />
          </View>
        </View>

        {/* Row 2: Pair Slots */}
        <View style={styles.pairRow}>
          <View style={[styles.pairSlot, { width: pairSlotWidth }]}>
            <ShimmerWave width="100%" height={78} borderRadius={BorderRadius.md} />
          </View>
          <View style={[styles.pairSlot, { width: pairSlotWidth }]}>
            <ShimmerWave width="100%" height={78} borderRadius={BorderRadius.md} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * 3. RECENT ACTIVITY SKELETON
 */
export function RecentActivitySkeleton() {
  const { colors } = useThemeColor();

  return (
    <View style={styles.recentSectionWrapper} testID="recent-activity-skeleton">
      {/* Header Row: Title + Arrow */}
      <View style={styles.sectionHeaderRow}>
        <ShimmerWave width={125} height={16} borderRadius={5} />
        <ShimmerWave width={24} height={24} borderRadius={12} />
      </View>

      {/* Recent Items List */}
      {[1, 2].map((key) => (
        <View
          key={key}
          style={[
            styles.recentRowItemSkeleton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.soft,
          ]}
        >
          <View style={styles.recentRowLeft}>
            <View style={styles.recentTitleRow}>
              <ShimmerWave width={95} height={12} borderRadius={4} />
              <ShimmerWave width={75} height={10} borderRadius={3} />
            </View>
            <ShimmerWave width="85%" height={13} borderRadius={4} style={{ marginTop: 6 }} />
          </View>

          <View style={styles.recentRowRight}>
            <ShimmerWave width={65} height={20} borderRadius={BorderRadius.full} />
            <ShimmerWave width={12} height={12} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Default Composite Home Skeleton (combines section skeletons)
 */
export default function HomeSkeleton() {
  return (
    <View style={styles.container} testID="home-tab-skeleton">
      <LocationCardSkeleton />
      <CategoriesBentoSkeleton />
      <RecentActivitySkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingBottom: Spacing.xl * 2,
  },
  greetingHeaderSection: {
    marginBottom: Spacing.lg,
  },
  deliveryLocationCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  locationInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  activeSectionWrapper: {
    marginBottom: Spacing.xl,
  },
  activeCardSkeleton: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItemBoxSkeleton: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  activeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
  },
  categoriesSectionWrapper: {
    marginBottom: Spacing.xl,
  },
  categoriesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  featureCardSkeleton: {
    borderRadius: BorderRadius.md,
    height: 140,
    marginBottom: Spacing.sm + 2,
    overflow: 'hidden',
  },
  featureContentSkeleton: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
  },
  mosaic: {
    gap: Spacing.sm,
  },
  mosaicRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  mosaicTallSlot: {
    flex: 1,
  },
  mosaicStackSlot: {
    flex: 1,
    gap: Spacing.sm,
  },
  pairRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pairSlot: {
    marginBottom: Spacing.xs,
  },
  recentSectionWrapper: {
    marginBottom: Spacing.xl + Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm + 2,
  },
  recentRowItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  recentRowLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  recentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
