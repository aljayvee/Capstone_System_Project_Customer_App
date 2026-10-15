import React from 'react';
import { StyleSheet, View } from 'react-native';
import ShimmerWave from './ShimmerWave';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, Spacing, Shadows, MAX_CONTENT_WIDTH, moderateScale, useResponsive } from '../config/theme';

/**
 * 0. WELCOME GREETING & DELIVERY LOCATION SKELETON
 */
export function LocationCardSkeleton() {
  const { colors, isDark } = useThemeColor();

  return (
    <View style={styles.greetingHeaderSection} testID="location-card-skeleton">
      {/* Delivery location header container */}
      <View style={styles.deliveryLocationCardSkeleton}>
        {/* MapPin icon placeholder */}
        <ShimmerWave
          width={22}
          height={22}
          borderRadius={11}
          style={{ marginRight: Spacing.sm + 2 }}
        />

        {/* Column with 2 text lines */}
        <View style={styles.locationInfoCol}>
          <ShimmerWave width={85} height={10} borderRadius={4} style={{ marginBottom: 5 }} />
          <ShimmerWave width="80%" height={14} borderRadius={4} />
        </View>

        {/* Action text button placeholder */}
        <ShimmerWave width={38} height={14} borderRadius={4} />
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
            borderColor: isDark ? colors.border : '#EDEFF2',
          },
          Shadows.soft,
        ]}
      >
        {/* Header Row: Title + Status Badge */}
        <View style={styles.activeHeaderRow}>
          <View style={styles.activeHeaderLeft}>
            <ShimmerWave width={150} height={16} borderRadius={5} />
          </View>
          <ShimmerWave width={72} height={22} borderRadius={BorderRadius.sm} />
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
          <ShimmerWave width={105} height={32} borderRadius={BorderRadius.lg} />
          <ShimmerWave width={70} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

/**
 * 2. EXPLORE MERCHANTS CATEGORIES SKELETON (Unboxed Vertical List)
 */
export function CategoriesBentoSkeleton() {
  return (
    <View style={styles.categoriesSectionWrapper} testID="categories-bento-skeleton">
      {/* UNBOXED VERTICAL CATEGORY LIST SKELETON */}
      <View style={styles.verticalCategoryListSkeleton}>
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.verticalCategoryItemSkeleton}>
            <ShimmerWave width="100%" height={moderateScale(176, 0.25)} borderRadius={BorderRadius.lg} />
            <ShimmerWave width="55%" height={16} borderRadius={4} style={{ marginTop: 8 }} />
            <ShimmerWave width="80%" height={12} borderRadius={4} style={{ marginTop: 5 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * 3. RECENT ACTIVITY SKELETON
 */
export function RecentActivitySkeleton() {
  const { colors, isDark } = useThemeColor();

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
              borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
            },
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
            <ShimmerWave width={65} height={20} borderRadius={BorderRadius.sm} />
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
    marginBottom: Spacing.md + 2,
  },
  deliveryLocationCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 4,
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
    borderWidth: 1,
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
  verticalCategoryListSkeleton: {
    gap: Spacing.lg,
  },
  verticalCategoryItemSkeleton: {
    width: '100%',
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
    paddingHorizontal: Spacing.xs,
    paddingVertical: 14,
    minHeight: 56,
    borderBottomWidth: 1,
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
