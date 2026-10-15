import React, { useMemo, useEffect } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, RotateCw, Search, Store } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useDefaultDeliveryLocation } from '../../hooks/useDefaultDeliveryLocation';
import { useEstablishmentSearch } from '../../hooks/useEstablishmentSearch';
import { usePopularStores } from '../../hooks/usePopularStores';
import { useMerchantCategories } from '../../hooks/useMerchantCategories';
import { recordCategorySearchAffinity } from '../../services/merchantCategories';
import { useCategoryImages } from '../../hooks/useCategoryImages';
import { useStorePicks } from '../../hooks/useStorePicks';
import { NEARBY_MAX_AGE_MS } from '../../hooks/useNearbyStoresPages';
import { doesEstablishmentMatchCategory, OUTSIDE_SERVICE_AREA_MESSAGE } from '../../services/establishments';
import { toPickedStores } from '../../services/pabiliDraft';
import { StoreCard } from '../../components/stores/StoreCard';
import { STORE_CARD_WIDTH } from '../../components/stores/StoreCardRow';
import { ProceedDock } from '../../components/stores/ProceedDock';
import ShimmerWave from '../../components/ShimmerWave';
import type { RootStackScreenProps } from '../../navigation/types';
import {
  BorderRadius,
  FontFamily,
  MAX_CONTENT_WIDTH,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
  useResponsive,
} from '../../config/theme';

const VERTICAL_IMAGE_HEIGHT = 150;

export default function MerchantCategoryStoresScreen({
  route,
  navigation,
}: RootStackScreenProps<'MerchantCategoryStores'>) {
  const { user, category, selected } = route.params;
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth } = useResponsive();
  const contentWidth = Math.min(windowWidth - Spacing.md * 2, MAX_CONTENT_WIDTH);
  // Home's card width (2026-10-14). These rows still took 58% of the column,
  // so every phone showed 1.7 oversized cards wall to wall, the cramped look
  // Home had until it moved to a fixed width; now the two match.
  const horizontalItemWidth = Math.round(Math.min(STORE_CARD_WIDTH, contentWidth * 0.58));
  const horizontalImageHeight = Math.round(horizontalItemWidth * 0.5);

  const { location, loading: locationLoading } = useDefaultDeliveryLocation(user?.id);
  const near = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;

  const { categories: backendCategories } = useMerchantCategories();
  const categoryImages = useCategoryImages(backendCategories);

  useEffect(() => {
    if (category?.name) {
      void recordCategorySearchAffinity(category.name);
    }
  }, [category?.name]);

  // Single category-scoped establishment search (reused for Nearby Stores horizontal row and vertical list)
  const categorySearch = useEstablishmentSearch('', near, !locationLoading, {
    categoryId: category.id,
    categoryName: category.name,
    withPhotos: true,
    maxAgeMs: NEARBY_MAX_AGE_MS,
  });

  // Up to 10 popular stores in this merchant category
  const popular = usePopularStores(near, !locationLoading, false, category.id, category.name);

  // Strictly keep only stores matching this merchant category
  const categoryStores = useMemo(
    () =>
      categorySearch.items.filter((store) =>
        doesEstablishmentMatchCategory(store, category.id, category.name)
      ),
    [categorySearch.items, category.id, category.name]
  );

  const popularStores = useMemo(() => {
    const fromPopularEndpoint = popular.items.filter((store) =>
      doesEstablishmentMatchCategory(store, category.id, category.name)
    );
    if (fromPopularEndpoint.length > 0) {
      return fromPopularEndpoint.slice(0, 10);
    }
    if (popular.status === 'idle' || popular.status === 'loading') {
      return [];
    }
    const ratedFromCategory = categoryStores
      .filter((store) => typeof store.rating === 'number' && store.rating > 0)
      .sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
      });
    return ratedFromCategory.slice(0, 10);
  }, [popular.items, popular.status, categoryStores, category.id, category.name]);

  const cataloguePool = useMemo(
    () => [...categoryStores, ...popularStores],
    [categoryStores, popularStores]
  );

  // Store selection up to 3 stores, deduplicating across Google & catalogue keys while preserving placeId
  const { picked, toggle, isPicked, limitError } = useStorePicks(
    selected ? [selected] : [],
    cataloguePool
  );

  // Nearby stores sorted strictly by ascending distanceMeters
  const nearbyStores = useMemo(() => {
    return [...categoryStores].sort(
      (a, b) =>
        (a.distanceMeters ?? Number.POSITIVE_INFINITY) -
        (b.distanceMeters ?? Number.POSITIVE_INFINITY)
    );
  }, [categoryStores]);

  const isCategoryLoading =
    locationLoading ||
    ((categorySearch.status === 'idle' || categorySearch.status === 'loading') &&
      categoryStores.length === 0);

  const isPopularLoading =
    locationLoading ||
    ((popular.status === 'idle' ||
      popular.status === 'loading' ||
      (popular.status === 'empty' && isCategoryLoading)) &&
      popularStores.length === 0);

  const proceed = () => {
    if (picked.length === 0) return;
    const stores = toPickedStores(picked);
    navigation.navigate('ErrandItems', {
      user,
      selectedCats: stores.map((s) => s.key),
      stores,
    });
  };

  const openStoreSearch = () => {
    navigation.navigate('StoreSearch', {
      user,
      category: { id: category.id, name: category.name },
    });
  };

  const changeLocation = () => {
    navigation.navigate('CustomerLocation', { user });
  };

  const isOutsideServiceArea = Boolean(
    categorySearch.outsideServiceArea || popular.outsideServiceArea
  );

  const renderInlineState = (
    testID: string,
    message: string,
    action: { label: string; onPress: () => void; Icon: any }
  ) => (
    <View
      style={[
        styles.inlineStateBlock,
        {
          borderColor: colors.border,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
        },
      ]}
      testID={testID}
    >
      <Store size={20} color={colors.textLight} />
      <Text
        style={[styles.inlineStateText, { color: colors.textGray }]}
        maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
      >
        {message}
      </Text>
      <TouchableOpacity
        style={[styles.inlineStateBtn, { borderColor: colors.primary }]}
        onPress={action.onPress}
        hitSlop={PortalTouchTargets.compactHitSlop}
        accessibilityRole="button"
        testID={`${testID}-action`}
      >
        <action.Icon size={14} color={colors.primary} />
        <Text
          style={[styles.inlineStateBtnText, { color: colors.primary }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
        >
          {action.label}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const listHeader = (
    <View style={styles.headerSectionsWrapper}>
      {category.description ? (
        <Text
          style={[styles.categoryDescription, { color: colors.textGray }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          testID="merchant-category-stores-description"
        >
          {category.description}
        </Text>
      ) : null}

      {/* 1. Horizontal List: Popular Stores for this merchant category (up to 10) */}
      <View style={styles.sectionBlock} testID="category-popular-stores-section">
        <Text
          style={[styles.sectionTitle, { color: colors.textDark }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
        >
          Popular stores
        </Text>

        {isPopularLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={styles.bleed}
            contentContainerStyle={styles.horizontalRow}
            testID="category-popular-loading"
          >
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ width: horizontalItemWidth }}>
                <ShimmerWave
                  width={horizontalItemWidth}
                  height={horizontalImageHeight}
                  borderRadius={BorderRadius.lg}
                />
                <View style={styles.shimmerBody}>
                  <ShimmerWave width="75%" height={14} borderRadius={BorderRadius.sm} />
                  <ShimmerWave width="50%" height={11} borderRadius={BorderRadius.sm} />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : popular.status === 'error' && popularStores.length === 0 ? (
          renderInlineState(
            'category-popular-error',
            "We couldn't load popular stores in this category.",
            { label: 'Try again', onPress: popular.retry, Icon: RotateCw }
          )
        ) : popularStores.length === 0 ? (
          renderInlineState(
            'category-popular-empty',
            isOutsideServiceArea
              ? OUTSIDE_SERVICE_AREA_MESSAGE
              : `No rated popular stores found in ${category.name} yet.`,
            isOutsideServiceArea
              ? { label: 'Change location', onPress: changeLocation, Icon: MapPin }
              : { label: 'Search stores', onPress: openStoreSearch, Icon: Search }
          )
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.horizontalRow}
            testID="category-popular-list"
          >
            {popularStores.map((store) => (
              <StoreCard
                key={store.key}
                store={store}
                onPress={toggle}
                categoryImages={categoryImages}
                fallbackCategoryId={category.id}
                fallbackCategoryName={category.name}
                width={horizontalItemWidth}
                imageHeight={horizontalImageHeight}
                testIDPrefix="category-popular-store"
                showRating
                selectable
                selected={isPicked(store)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* 2. Horizontal List: Nearby Stores for this merchant category */}
      <View style={styles.sectionBlock} testID="category-nearby-stores-section">
        <Text
          style={[styles.sectionTitle, { color: colors.textDark }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
        >
          Nearby stores
        </Text>

        {isCategoryLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={styles.bleed}
            contentContainerStyle={styles.horizontalRow}
            testID="category-nearby-loading"
          >
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ width: horizontalItemWidth }}>
                <ShimmerWave
                  width={horizontalItemWidth}
                  height={horizontalImageHeight}
                  borderRadius={BorderRadius.lg}
                />
                <View style={styles.shimmerBody}>
                  <ShimmerWave width="75%" height={14} borderRadius={BorderRadius.sm} />
                  <ShimmerWave width="50%" height={11} borderRadius={BorderRadius.sm} />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : categorySearch.status === 'error' ? (
          renderInlineState(
            'category-nearby-error',
            "We couldn't load nearby stores in this category.",
            { label: 'Try again', onPress: categorySearch.retry, Icon: RotateCw }
          )
        ) : nearbyStores.length === 0 ? (
          renderInlineState(
            'category-nearby-empty',
            isOutsideServiceArea
              ? OUTSIDE_SERVICE_AREA_MESSAGE
              : `No nearby stores found in ${category.name} yet.`,
            isOutsideServiceArea
              ? { label: 'Change location', onPress: changeLocation, Icon: MapPin }
              : { label: 'Search stores', onPress: openStoreSearch, Icon: Search }
          )
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.horizontalRow}
            testID="category-nearby-list"
          >
            {nearbyStores.map((store) => (
              <StoreCard
                key={store.key}
                store={store}
                onPress={toggle}
                categoryImages={categoryImages}
                fallbackCategoryId={category.id}
                fallbackCategoryName={category.name}
                width={horizontalItemWidth}
                imageHeight={horizontalImageHeight}
                testIDPrefix="category-nearby-store"
                showRating
                selectable
                selected={isPicked(store)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* 3. Heading for Vertical List: All stores in this merchant category */}
      <View style={styles.verticalSectionHeader}>
        <Text
          style={[styles.sectionTitle, { color: colors.textDark }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
        >
          {`All ${category.name} stores`}
        </Text>
      </View>

      {isCategoryLoading ? (
        <View style={styles.verticalSkeletonList} testID="category-all-loading">
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.verticalSkeletonItem}>
              <ShimmerWave
                width="100%"
                height={VERTICAL_IMAGE_HEIGHT}
                borderRadius={BorderRadius.lg}
              />
              <View style={styles.shimmerBody}>
                <ShimmerWave width="60%" height={15} borderRadius={BorderRadius.sm} />
                <ShimmerWave width="40%" height={12} borderRadius={BorderRadius.sm} />
              </View>
            </View>
          ))}
        </View>
      ) : categorySearch.status === 'error' ? (
        renderInlineState(
          'category-all-error',
          `We couldn't load ${category.name} stores. Check your connection, then try again.`,
          { label: 'Try again', onPress: categorySearch.retry, Icon: RotateCw }
        )
      ) : categoryStores.length === 0 ? (
        renderInlineState(
          'category-all-empty',
          isOutsideServiceArea
            ? OUTSIDE_SERVICE_AREA_MESSAGE
            : categorySearch.googleAvailable
            ? `No stores found in ${category.name} yet. You can still search for any store by name.`
            : `${category.name} stores aren't available right now. You can still search for a store by name.`,
          isOutsideServiceArea
            ? { label: 'Change location', onPress: changeLocation, Icon: MapPin }
            : { label: 'Search stores', onPress: openStoreSearch, Icon: Search }
        )
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgApp }]}
      edges={picked.length > 0 ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.navHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text
          style={[styles.navTitle, { color: colors.textDark }]}
          numberOfLines={1}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
        >
          {category.name}
        </Text>
        <TouchableOpacity
          onPress={openStoreSearch}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Search stores"
          testID="merchant-category-search-button"
        >
          <Search size={18} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      {limitError ? (
        <Text
          style={[styles.limitErrorText, { color: colors.danger }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          testID="merchant-category-stores-limit-error"
        >
          {limitError}
        </Text>
      ) : null}

      <FlatList
        data={!isCategoryLoading && categorySearch.status !== 'error' ? categoryStores : []}
        keyExtractor={(store) => store.key}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <StoreCard
            store={item}
            onPress={toggle}
            categoryImages={categoryImages}
            fallbackCategoryId={category.id}
            fallbackCategoryName={category.name}
            width="100%"
            imageHeight={VERTICAL_IMAGE_HEIGHT}
            testIDPrefix="category-all-store"
            showRating
            selectable
            selected={isPicked(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.verticalSeparator} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        extraData={picked}
        testID="merchant-category-stores-list"
      />

      <ProceedDock
        count={picked.length}
        onProceed={proceed}
        testID="merchant-category-stores-proceed"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(17),
    lineHeight: getPortalLineHeight(17, 'heading'),
  },
  limitErrorText: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.35),
  },
  // Breathing room (2026-10-14): the page started 8 dp under the header, with
  // the description in 12 pt crammed against it and each title tight on its
  // cards. The spacing below follows Home's rhythm.
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },
  headerSectionsWrapper: {
    paddingTop: Spacing.sm,
  },
  categoryDescription: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 1.45),
    marginBottom: Spacing.sm,
  },
  sectionBlock: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
    marginBottom: Spacing.sm + 4,
  },
  bleed: {
    marginHorizontal: -Spacing.md,
  },
  horizontalRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 4,
    gap: Spacing.sm + 2,
  },
  shimmerBody: {
    paddingTop: Spacing.xs + 2,
    paddingBottom: 2,
    gap: 6,
  },
  verticalSectionHeader: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  verticalSeparator: {
    height: Spacing.lg,
  },
  verticalSkeletonList: {
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  verticalSkeletonItem: {
    // Unboxed skeleton matching StorePickScreen
  },
  inlineStateBlock: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  inlineStateText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.4),
    textAlign: 'center',
  },
  inlineStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: PortalTouchTargets.pillHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  inlineStateBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
});
