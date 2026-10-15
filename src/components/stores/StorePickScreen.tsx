import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, RotateCw, Search, Store } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useMerchantCategories } from '../../hooks/useMerchantCategories';
import { useCategoryImages } from '../../hooks/useCategoryImages';
import { useStorePicks } from '../../hooks/useStorePicks';
import { STORE_PAGES_MAX, type PagedStores } from '../../hooks/usePagedStores';
import { OUTSIDE_SERVICE_AREA_MESSAGE, type Establishment } from '../../services/establishments';
import { toPickedStores } from '../../services/pabiliDraft';
import { StoreCard } from './StoreCard';
import { ProceedDock } from './ProceedDock';
import ShimmerWave from '../ShimmerWave';
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
} from '../../config/theme';

/** A full-width card's photo: wide enough to read the shop front. */
const IMAGE_HEIGHT = 150;

export interface StorePickScreenProps {
  user: any;
  navigation: { navigate: (screen: any, params?: any) => void; goBack: () => void };
  title: string;
  /**
   * Test ids: `<prefix>-screen-loading|error|empty|list|end|more-loading|more-error|more-retry`,
   * `<prefix>-screen-store-<key>` for the cards, `<prefix>-limit-error`, `<prefix>-proceed`.
   */
  testIDPrefix: string;
  pages: PagedStores;
  /** Between the title and the list: Popular Stores' sort row. */
  subheader?: React.ReactNode;
  /** Google's stars on each photo: the popular list. */
  showRating?: boolean;
  /** Picked on the way in: the store tapped on Home's row. */
  initialPicks?: Establishment[];
  copy: {
    error: string;
    empty: string;
    /** Empty because Google could not answer. */
    unavailable: string;
    /** Under the last card when there is no more: `count` shown, at most `max`. */
    end: (count: number, max: number) => string;
  };
}

/**
 * The screens Home's store rows open (2026-10-11): "Popular Stores" and "Stores
 * near you", one behaviour for both. Full-width photo cards, the next page as
 * the list reaches its end (up to 20), and a card picks its store, up to 3,
 * with "Proceed with this store (1)" along the bottom to open the Shopping list
 * with them. A store tapped on Home's row arrives already picked
 * (`initialPicks`), so the customer can add up to two more before proceeding.
 *
 * Every state is drawn: shimmer cards while loading, the error with Try again,
 * the empty list with a way to search by name, and under the last card the
 * next page loading, its failure with Try again, or that this is all.
 */
export function StorePickScreen({
  user,
  navigation,
  title,
  testIDPrefix,
  pages,
  subheader,
  showRating = false,
  initialPicks,
  copy,
}: StorePickScreenProps) {
  const { colors, isDark } = useThemeColor();
  const { categories } = useMerchantCategories();
  const categoryImages = useCategoryImages(categories);
  const { picked, toggle, isPicked, limitError } = useStorePicks(initialPicks ?? [], pages.items);
  const id = (suffix: string) => `${testIDPrefix}-${suffix}`;

  const proceed = () => {
    if (picked.length === 0) return;
    const stores = toPickedStores(picked);
    navigation.navigate('ErrandItems', { user, selectedCats: stores.map((s) => s.key), stores });
  };
  const searchStores = () => navigation.navigate('StoreSearch', { user });
  const changeLocation = () => navigation.navigate('CustomerLocation', { user });

  const isLoading = (pages.status === 'idle' || pages.status === 'loading') && pages.items.length === 0;

  const panel = (testID: string, message: string, action: { label: string; onPress: () => void; Icon: any }) => (
    <View
      style={[styles.panel, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB' }]}
      testID={testID}
    >
      <Store size={22} color={colors.textLight} />
      <Text style={[styles.panelText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
        {message}
      </Text>
      <TouchableOpacity
        style={[styles.panelBtn, { borderColor: colors.primary }]}
        onPress={action.onPress}
        hitSlop={PortalTouchTargets.compactHitSlop}
        accessibilityRole="button"
        testID={`${testID}-action`}
      >
        <action.Icon size={14} color={colors.primary} />
        <Text style={[styles.panelBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
          {action.label}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Under the last card: loading the next page, why it failed, or that this is all.
  const footer = () => {
    if (pages.loadingMore) {
      return (
        <View style={styles.footer} testID={id('screen-more-loading')}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.footerText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            Loading more stores
          </Text>
        </View>
      );
    }
    if (pages.moreFailed) {
      return (
        <View style={styles.footer} testID={id('screen-more-error')}>
          <Text style={[styles.footerText, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            We couldn't load more stores.
          </Text>
          <TouchableOpacity
            style={[styles.panelBtn, { borderColor: colors.primary }]}
            onPress={pages.loadMore}
            hitSlop={PortalTouchTargets.compactHitSlop}
            accessibilityRole="button"
            testID={id('screen-more-retry')}
          >
            <RotateCw size={14} color={colors.primary} />
            <Text style={[styles.panelBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!pages.hasMore && pages.items.length > 0) {
      return (
        <Text
          style={[styles.footerText, styles.footerEnd, { color: colors.textLight }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          testID={id('screen-end')}
        >
          {copy.end(pages.items.length, STORE_PAGES_MAX)}
        </Text>
      );
    }
    return null;
  };

  return (
    // The Proceed bar pads for the phone's navigation bar itself; without it the list does.
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgApp }]}
      edges={picked.length > 0 ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.navHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          {title}
        </Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      {subheader}

      {limitError ? (
        <Text
          style={[styles.limitErrorText, { color: colors.danger }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          testID={id('limit-error')}
        >
          {limitError}
        </Text>
      ) : null}

      {isLoading ? (
        <View style={[styles.scrollContent, styles.list]} testID={id('screen-loading')}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.shimmerCard}>
              <ShimmerWave width="100%" height={IMAGE_HEIGHT} borderRadius={BorderRadius.lg} />
              <View style={styles.shimmerBody}>
                <ShimmerWave height={15} width="60%" borderRadius={BorderRadius.sm} />
                <ShimmerWave height={12} width="40%" borderRadius={BorderRadius.sm} />
              </View>
            </View>
          ))}
        </View>
      ) : pages.status === 'error' ? (
        <View style={styles.scrollContent}>
          {panel(id('screen-error'), copy.error, { label: 'Try again', onPress: pages.retry, Icon: RotateCw })}
        </View>
      ) : pages.items.length === 0 ? (
        <View style={styles.scrollContent}>
          {pages.outsideServiceArea
            ? panel(id('screen-empty'), OUTSIDE_SERVICE_AREA_MESSAGE, {
                label: 'Change location',
                onPress: changeLocation,
                Icon: MapPin,
              })
            : panel(id('screen-empty'), pages.googleAvailable ? copy.empty : copy.unavailable, {
                label: 'Search stores',
                onPress: searchStores,
                Icon: Search,
              })}
        </View>
      ) : (
        <FlatList
          data={pages.items}
          keyExtractor={(store) => store.key}
          renderItem={({ item }) => (
            <StoreCard
              store={item}
              onPress={toggle}
              categoryImages={categoryImages}
              width="100%"
              imageHeight={IMAGE_HEIGHT}
              testIDPrefix={id('screen-store')}
              showRating={showRating}
              selectable
              selected={isPicked(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          // Near the end, the next page; not again on its own after a failure,
          // which waits for the footer's Try again.
          onEndReached={() => {
            if (!pages.moreFailed) pages.loadMore();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          // A pick redraws its card's tick.
          extraData={picked}
          testID={id('screen-list')}
        />
      )}

      <ProceedDock count={picked.length} onProceed={proceed} testID={id('proceed')} />
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
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(17),
    lineHeight: getPortalLineHeight(17, 'heading'),
  },
  navHeaderRightPlaceholder: {
    width: PortalTouchTargets.compact,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },
  list: {
    gap: Spacing.lg,
  },
  separator: {
    height: Spacing.lg,
  },
  shimmerCard: {
    // Unboxed loading skeleton
  },
  shimmerBody: {
    paddingTop: Spacing.xs + 2,
    paddingBottom: 2,
    gap: 6,
  },
  panel: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  panelText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.4),
  },
  panelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    minHeight: PortalTouchTargets.pillHeight,
  },
  panelBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.lg,
  },
  footerText: {
    textAlign: 'center',
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.4),
  },
  footerEnd: {
    paddingVertical: Spacing.lg,
  },
  limitErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.35),
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
});
