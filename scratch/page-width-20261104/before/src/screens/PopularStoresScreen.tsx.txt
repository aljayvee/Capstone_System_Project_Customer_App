import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowUpDown } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { useDefaultDeliveryLocation } from '../hooks/useDefaultDeliveryLocation';
import { usePopularStoresPages } from '../hooks/usePopularStores';
import type { PopularSort } from '../services/establishments';
import { StorePickScreen } from '../components/stores/StorePickScreen';
import type { RootStackScreenProps } from '../navigation/types';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  scaledPortalFontSize,
} from '../config/theme';

/** The sort settings, in the order shown. The server orders the same stores each way. */
export const POPULAR_SORT_OPTIONS: { value: PopularSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Top rated' },
  { value: 'distance', label: 'Nearest' },
  { value: 'reviews', label: 'Most reviews' },
];

/**
 * "Popular Stores", opened from Home's "Popular Stores" row: the popular shops
 * near the customer as full-width cards with their stars, six at first, six
 * more each time the list reaches its end, up to 20 (2026-10-10; six in all
 * before). A card picks its store, up to 3, and "Proceed with this store (1)"
 * appears along the bottom; the list, paging and picking are
 * components/stores/StorePickScreen.tsx, shared with "Stores near you".
 *
 * Opened by tapping a store on Home's row, that store arrives already picked
 * (`selected`, 2026-10-11; the tap went straight to the Shopping list before).
 *
 * The sort row on top reorders them: Recommended (the best of each merchant
 * category first, as Home's row shows them), Top rated, Nearest, Most reviews.
 * Recommended's first page is the answer Home already has (shared for two
 * minutes, hooks/usePopularStores.ts), so the cards do not change on the way in.
 * Picks survive a change of sort.
 */
export default function PopularStoresScreen({ route, navigation }: RootStackScreenProps<'PopularStores'>) {
  const { user, selected } = route.params || ({} as any);
  const { colors, isDark } = useThemeColor();
  const [sort, setSort] = useState<PopularSort>('recommended');
  const { location, loading: locationLoading } = useDefaultDeliveryLocation(user?.id);
  const near = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  const popular = usePopularStoresPages(near, !locationLoading, sort);

  const sortRow = (
    // SORT SETTINGS: stays put while the list scrolls under it.
    <View style={styles.sortRow}>
      <ArrowUpDown size={14} color={colors.textGray} />
      <Text style={[styles.sortLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
        Sort
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortOptions}
        testID="popular-stores-sort"
      >
        {POPULAR_SORT_OPTIONS.map((option) => {
          const isSelected = option.value === sort;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => setSort(option.value)}
              style={[
                styles.sortOption,
                isSelected
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.card },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Sort by ${option.label}`}
              testID={`popular-sort-${option.value}`}
            >
              <Text
                style={[styles.sortOptionText, { color: isSelected ? '#FFFFFF' : colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <StorePickScreen
      user={user}
      navigation={navigation}
      title="Popular Stores"
      testIDPrefix="popular-stores"
      pages={popular}
      subheader={sortRow}
      showRating
      initialPicks={selected ? [selected] : undefined}
      copy={{
        error: "We couldn't load popular stores. Check your connection, then try again.",
        empty: 'No rated stores found near your saved location yet. You can still search for one by name.',
        unavailable: "Popular stores aren't available right now. You can still search for a store by name.",
        end: (count, max) =>
          count >= max ? `That's the top ${max} popular stores near you.` : "That's every popular store near you.",
      }}
    />
  );
}

const styles = StyleSheet.create({
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sortLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sortOptions: {
    gap: Spacing.xs + 2,
    paddingLeft: 4,
    paddingRight: Spacing.md,
  },
  sortOption: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    minHeight: PortalTouchTargets.pillHeight,
    justifyContent: 'center',
  },
  sortOptionText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
});
