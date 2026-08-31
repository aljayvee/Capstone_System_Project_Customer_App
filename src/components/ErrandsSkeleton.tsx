import React from 'react';
import { StyleSheet, View } from 'react-native';
import ShimmerWave from './ShimmerWave';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, Spacing, Shadows, MAX_CONTENT_WIDTH } from '../config/theme';

/**
 * 1. SEARCH BAR SKELETON
 */
export function ErrandsSearchBarSkeleton() {
  const { colors } = useThemeColor();

  return (
    <View
      style={[
        styles.searchBarSkeleton,
        { backgroundColor: colors.card, borderColor: colors.border },
        Shadows.soft,
      ]}
      testID="errands-search-skeleton"
    >
      <ShimmerWave width={18} height={18} borderRadius={9} />
      <ShimmerWave width={160} height={14} borderRadius={4} />
    </View>
  );
}

/**
 * 2. FILTER PILLS SKELETON
 */
export function ErrandsFilterPillsSkeleton() {
  return (
    <View style={styles.filterRowSkeleton} testID="errands-filter-skeleton">
      {[90, 80, 100, 95].map((w, idx) => (
        <ShimmerWave key={idx} width={w} height={30} borderRadius={BorderRadius.full} />
      ))}
    </View>
  );
}

/**
 * 3. UTILITY TOOLBAR SKELETON
 */
export function ErrandsUtilityBarSkeleton() {
  return (
    <View style={styles.utilityBarSkeleton}>
      <ShimmerWave width={110} height={12} borderRadius={3} />
      <View style={styles.utilityActionsSkeleton}>
        <ShimmerWave width={75} height={24} borderRadius={BorderRadius.full} />
        <ShimmerWave width={90} height={24} borderRadius={BorderRadius.full} />
      </View>
    </View>
  );
}

/**
 * 4. ERRAND CARD SKELETON
 */
export function ErrandsCardSkeleton() {
  const { colors } = useThemeColor();

  return (
    <View
      style={[
        styles.cardSkeleton,
        { backgroundColor: colors.card, borderColor: colors.border },
        Shadows.soft,
      ]}
      testID="errands-card-skeleton"
    >
      {/* Header Row: Icon + Title + Status Pill */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <ShimmerWave width={34} height={34} borderRadius={17} style={{ marginRight: 10 }} />
          <View style={styles.cardHeaderTextCol}>
            <ShimmerWave width={140} height={15} borderRadius={4} style={{ marginBottom: 5 }} />
            <ShimmerWave width={100} height={11} borderRadius={3} />
          </View>
        </View>
        <ShimmerWave width={68} height={22} borderRadius={BorderRadius.full} />
      </View>

      {/* Address line */}
      <View style={styles.addressLineSkeleton}>
        <ShimmerWave width={14} height={14} borderRadius={7} style={{ marginRight: 6 }} />
        <ShimmerWave width="80%" height={12} borderRadius={3} />
      </View>

      {/* Footer Row: Price + Method + Link */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <ShimmerWave width={65} height={15} borderRadius={3} />
          <ShimmerWave width={40} height={12} borderRadius={3} />
        </View>
        <ShimmerWave width={60} height={14} borderRadius={3} />
      </View>

      {/* Reorder Button */}
      <View style={styles.reorderSkeletonWrap}>
        <ShimmerWave width="100%" height={34} borderRadius={BorderRadius.md} />
      </View>
    </View>
  );
}

/**
 * 5. CARDS-ONLY SKELETON (Used when header and filters are already mounted)
 */
export function ErrandsCardsSkeleton() {
  return (
    <View style={styles.cardsContainer} testID="errands-cards-skeleton">
      {[1, 2, 3].map((key) => (
        <ErrandsCardSkeleton key={key} />
      ))}
    </View>
  );
}

/**
 * Default Composite Errands Skeleton (Used when loading entire screen)
 */
export default function ErrandsSkeleton() {
  return (
    <View style={styles.container} testID="errands-tab-skeleton">
      <ErrandsSearchBarSkeleton />
      <ErrandsFilterPillsSkeleton />
      <ErrandsUtilityBarSkeleton />
      <ErrandsCardsSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  searchBarSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs + 2,
    borderWidth: 1,
    gap: 8,
  },
  filterRowSkeleton: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  utilityBarSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
  },
  utilityActionsSkeleton: {
    flexDirection: 'row',
    gap: 6,
  },
  cardsContainer: {
    paddingHorizontal: Spacing.md,
  },
  cardSkeleton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardHeaderTextCol: {
    flex: 1,
  },
  addressLineSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    marginBottom: Spacing.xs + 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reorderSkeletonWrap: {
    marginTop: 6,
  },
});
