import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { AlertCircle, Bike, MapPin, RotateCw, Search, X } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useDefaultDeliveryLocation } from '../../hooks/useDefaultDeliveryLocation';
import { useEstablishmentSearch, MIN_QUERY_LENGTH } from '../../hooks/useEstablishmentSearch';
import { useFindStoresPages } from '../../hooks/useNearbyStoresPages';
import {
  doesEstablishmentMatchCategory,
  isSameStore,
  isPabiliEstablishment,
  OUTSIDE_SERVICE_AREA_MESSAGE,
  type Establishment,
} from '../../services/establishments';
import { recordCategorySearchAffinity } from '../../services/merchantCategories';
import ShimmerWave from '../ShimmerWave';
import { StoreCard } from '../stores/StoreCard';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';

/**
 * Step 1's "Location" list: real stores to buy from. Four stores near the
 * customer's saved location until they type, then the stores matching what they
 * typed, from the owner's Location Stores and Google Maps together. Shown in the
 * server's order: it ranks by distance first, then by the customer's own past
 * orders and everyone's (server lib/places/storeRanking.ts).
 *
 * Picked stores stay listed on top while the customer searches for the next
 * one, because a new search may no longer include them.
 *
 * With a `category` (Home's category tiles, 2026-10-10) the list is that
 * merchant category's stores, up to 20, and a typed search stays inside it; the
 * category shows as a chip the customer can clear to search every store.
 *
 * Each store is a photo card, as on the Popular Stores screen (2026-10-10; icon
 * rows before), so the list asks for photo addresses. A card picks or unpicks
 * its store; the card's tick and red border show which are picked.
 */
export default function EstablishmentPicker({
  userId,
  selected,
  onToggle,
  autoFocus = false,
  category = null,
  onClearCategory,
  onLetRiderPick,
  categoryImages = NO_IMAGES,
}: {
  userId: string | number | undefined;
  selected: Establishment[];
  onToggle: (store: Establishment) => void;
  /** Open with the keyboard up: the store search screen, opened to search. */
  autoFocus?: boolean;
  /** Only this merchant category's stores. */
  category?: { id: number; name: string } | null;
  /** Clears `category`: the chip's X. */
  onClearCategory?: () => void;
  /**
   * The category's empty list offers to let the rider choose the shop, as the
   * category tiles did before they listed stores. Omitted: no such offer.
   */
  onLetRiderPick?: () => void;
  /** Owner-set category photos by category id: a card's photo when the shop has none of its own. */
  categoryImages?: Record<number, string>;
}) {
  const { colors, isDark } = useThemeColor();
  const [query, setQuery] = useState('');
  const { location, loading: locationLoading } = useDefaultDeliveryLocation(userId);
  const near = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  // Before anything is typed, and without a category: the featured brands,
  // then every other store, ten at a time with See more (2026-10-14). It was
  // the four stores of Home's row. Typing, or a category, uses the search.
  const typedQuery = query.trim().length >= MIN_QUERY_LENGTH ? query.trim() : '';
  const browsing = !category && !typedQuery;
  const pages = useFindStoresPages(near, !locationLoading && browsing);
  const typedSearch = useEstablishmentSearch(query, near, !locationLoading && !browsing, {
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    withPhotos: true,
  });
  const search = browsing
    ? {
        items: pages.items,
        status: pages.status,
        googleAvailable: pages.googleAvailable,
        outsideServiceArea: pages.outsideServiceArea === true,
        retry: pages.retry,
        query: '',
      }
    : typedSearch;

  const pickedKeys = new Set(selected.map((s) => s.key));
  // A store carried over by "Order again" has no Google id, so the same shop
  // in the list is matched by name and spot instead of by key.
  const results = search.items
    .filter(
      (item) =>
        isPabiliEstablishment(item) &&
        doesEstablishmentMatchCategory(item, category?.id ?? null, category?.name ?? null)
    )
    .filter(
      (item) => !pickedKeys.has(item.key) && !selected.some((s) => isSameStore(s, item))
    );
  // The browsing list's two groups: the featured brands, then the rest.
  const featuredResults = browsing ? results.filter((store) => store.featured === true) : [];
  const otherResults = browsing ? results.filter((store) => store.featured !== true) : results;
  const showsGoogle = search.items.some((item) => item.source === 'google');
  const typed = query.trim();

  useEffect(() => {
    if (category?.name) {
      void recordCategorySearchAffinity(category.name);
    }
  }, [category?.name]);

  const handleToggle = (store: Establishment) => {
    if (store.categoryName) {
      void recordCategorySearchAffinity(store.categoryName);
    }
    onToggle(store);
  };

  const card = (store: Establishment, isSelected: boolean) => (
    <StoreCard
      key={store.key}
      store={store}
      onPress={handleToggle}
      categoryImages={categoryImages}
      width="100%"
      imageHeight={CARD_IMAGE_HEIGHT}
      testIDPrefix="establishment"
      selectable
      selected={isSelected}
    />
  );

  const note = (text: string, testID: string, tone: 'muted' | 'danger' = 'muted') => (
    <View style={styles.noteRow} testID={testID}>
      <AlertCircle size={15} color={tone === 'danger' ? colors.danger : colors.textGray} />
      <Text
        style={[styles.noteText, { color: tone === 'danger' ? colors.danger : colors.textGray }]}
        maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
      >
        {text}
      </Text>
    </View>
  );

  return (
    <View testID="establishment-picker">
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
          },
        ]}
        testID="establishment-search-bar"
      >
        <Search size={16} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={2.2} />
        <TextInput
          style={[styles.searchInput, { color: colors.textDark }]}
          placeholder={category ? `Search ${category.name} stores` : 'Search a store, e.g. Mercury Drug'}
          placeholderTextColor={colors.textLight}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          autoFocus={autoFocus}
          maxLength={80}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          testID="establishment-search-input"
        />
        {search.status === 'loading' && search.items.length > 0 ? (
          <ActivityIndicator size="small" color={colors.primary} testID="establishment-search-busy" />
        ) : null}
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={PortalTouchTargets.compactHitSlop} testID="establishment-search-clear" accessibilityLabel="Clear search">
            <X size={14} color={colors.textGray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {category ? (
        <View style={styles.chipRow}>
          <View
            style={[styles.categoryChip, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFF5F7', borderColor: colors.primary }]}
            testID="establishment-category-chip"
          >
            <Text style={[styles.categoryChipText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              {category.name}
            </Text>
            {onClearCategory ? (
              <TouchableOpacity
                onPress={onClearCategory}
                hitSlop={PortalTouchTargets.compactHitSlop}
                accessibilityRole="button"
                accessibilityLabel={`Show every store, not just ${category.name}`}
                testID="establishment-category-clear"
              >
                <X size={13} color={colors.primary} strokeWidth={2.6} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {selected.length > 0 ? (
        <View testID="picked-stores">
          <Text style={[styles.groupLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
            Your stores
          </Text>
          <View style={styles.cards}>{selected.map((store) => card(store, true))}</View>
        </View>
      ) : null}

      {/* The browsing list labels its own two groups below. */}
      {browsing && featuredResults.length > 0 ? null : (
        <Text style={[styles.groupLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
          {category
            ? search.query
              ? `${category.name} stores matching "${search.query}"`
              : `${category.name} stores near you`
            : search.query
            ? `Stores matching "${search.query}"`
            : 'Stores near you'}
        </Text>
      )}

      {typed.length > 0 && typed.length < MIN_QUERY_LENGTH
        ? note('Type at least 2 letters to search.', 'establishment-search-short')
        : null}

      {!search.googleAvailable && search.status !== 'error'
        ? note("Google Maps search isn't available right now, so this list shows SUGO's own stores.", 'establishment-google-unavailable')
        : null}

      {(search.status === 'idle' || search.status === 'loading') && search.items.length === 0 ? (
        <View style={styles.cards} testID="establishment-loading">
          {[0, 1].map((i) => (
            <View key={i} style={styles.shimmerCard}>
              <ShimmerWave width="100%" height={CARD_IMAGE_HEIGHT} borderRadius={BorderRadius.lg} />
              <View style={styles.shimmerBody}>
                <ShimmerWave height={14} width="65%" borderRadius={BorderRadius.sm} />
                <ShimmerWave height={12} width="40%" borderRadius={BorderRadius.sm} />
              </View>
            </View>
          ))}
        </View>
      ) : search.status === 'error' ? (
        <View style={styles.stateBox} testID="establishment-error">
          {note("We couldn't load stores. Check your connection, then try again.", 'establishment-error-text', 'danger')}
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: colors.primary }]}
            onPress={search.retry}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID="establishment-retry"
          >
            <RotateCw size={14} color={colors.primary} />
            <Text style={[styles.retryText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      ) : search.status === 'empty' || (search.status === 'ready' && results.length === 0) ? (
        <View style={styles.stateBox} testID="establishment-empty">
          <MapPin size={18} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            {search.outsideServiceArea
              ? OUTSIDE_SERVICE_AREA_MESSAGE
              : search.items.length > 0
              ? 'You picked every store listed here. Search for another by name.'
              : search.query
              ? `No ${category ? `${category.name} ` : ''}stores found for "${search.query}". Check the spelling, or try the branch or street name.`
              : category
              ? `No ${category.name} stores found near your saved location.`
              : 'No stores found near your saved location. Search for one by name.'}
          </Text>
          {category && onLetRiderPick && search.items.length === 0 && !search.outsideServiceArea ? (
            <TouchableOpacity
              style={[styles.retryBtn, { borderColor: colors.primary }]}
              onPress={onLetRiderPick}
              hitSlop={PortalTouchTargets.compactHitSlop}
              accessibilityRole="button"
              testID="establishment-let-rider-pick"
            >
              <Bike size={14} color={colors.primary} />
              <Text style={[styles.retryText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                {`Let your rider pick a ${category.name} store`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : browsing ? (
        <View>
          {featuredResults.length > 0 ? (
            <>
              <Text style={[styles.groupLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                Recommended for you
              </Text>
              <View style={styles.cards} testID="establishment-featured">
                {featuredResults.map((store) => card(store, false))}
              </View>
              {otherResults.length > 0 ? (
                <Text
                  style={[styles.groupLabel, styles.groupLabelAfter, { color: colors.textGray }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                >
                  More stores near you
                </Text>
              ) : null}
            </>
          ) : null}
          <View style={styles.cards} testID="establishment-results">
            {otherResults.map((store) => card(store, false))}
          </View>
          {/* See more (2026-10-14): ten more at a time, up to twenty. */}
          {pages.hasMore || pages.loadingMore || pages.moreFailed ? (
            <View style={styles.seeMoreWrap}>
              {pages.moreFailed ? note("We couldn't load more stores.", 'establishment-more-failed', 'danger') : null}
              <TouchableOpacity
                style={[styles.seeMoreBtn, { borderColor: colors.border }]}
                onPress={pages.loadMore}
                disabled={pages.loadingMore}
                accessibilityRole="button"
                accessibilityState={{ busy: pages.loadingMore }}
                testID="establishment-see-more"
              >
                {pages.loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.seeMoreText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                    {pages.moreFailed ? 'Try again' : 'See more'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.cards} testID="establishment-results">
          {results.map((store) => card(store, false))}
        </View>
      )}

      {showsGoogle ? (
        <Text style={[styles.attribution, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption} testID="google-attribution">
          Places from Google Maps
        </Text>
      ) : null}
    </View>
  );
}

/** A card's photo: tall enough to read the shop front, as on the Popular Stores screen. */
const CARD_IMAGE_HEIGHT = 140;
const NO_IMAGES: Record<number, string> = {};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.2,
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: Spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryChipText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  groupLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.3),
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  cards: {
    gap: Spacing.lg,
    marginTop: 4,
  },
  shimmerCard: {
    // Unboxed loading skeleton
  },
  shimmerBody: {
    paddingTop: Spacing.xs + 2,
    paddingBottom: 2,
    gap: 6,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 6,
  },
  noteText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
  },
  stateBox: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.4),
    paddingHorizontal: Spacing.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    minHeight: PortalTouchTargets.pillHeight,
  },
  retryText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  // The second group's heading: room after the cards above it.
  groupLabelAfter: {
    marginTop: Spacing.lg,
  },
  seeMoreWrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  seeMoreBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    minHeight: PortalTouchTargets.compact,
  },
  seeMoreText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  attribution: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    textAlign: 'right',
    marginTop: 6,
  },
});
