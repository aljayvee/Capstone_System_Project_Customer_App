import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronRight,
  Store,
  ArrowRight,
  Search,
  Sparkles,
  Clock,
} from 'lucide-react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import StatusBadge from '../../components/StatusBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaintenanceNotice } from '../../hooks/useMaintenanceNotice';
import MaintenanceNoticeBanner from '../../components/MaintenanceNoticeBanner';
import HomeSkeleton, {
  CategoriesBentoSkeleton,
  RecentActivitySkeleton,
} from '../../components/HomeSkeleton';
import ConfirmModal from '../../components/ConfirmModal';
import { checkNewlyUpdatedApp, getInstalledAppVersion } from '../../services/appUpdateService';
import NearbyStoresRow from '../../components/NearbyStoresRow';
import PopularStoresRow from '../../components/PopularStoresRow';
import AccountReminder from '../../components/home/AccountReminder';
import { ActiveErrandsFab } from '../../components/home/ActiveErrandsFab';
import { BlurTargetView } from 'expo-blur';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  BorderRadius,
  FontSizes,
  Spacing,
  FontFamily,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalFontSizeMultipliers,
  PortalTouchTargets,
} from '../../config/theme';
import { useCategoryImages } from '../../hooks/useCategoryImages';
import { useMerchantCategories } from '../../hooks/useMerchantCategories';
import {
  type BackendMerchantCategory,
  getCategorySearchAffinities,
  recordCategorySearchAffinity,
  prioritizeCategoriesWithAffinity,
} from '../../services/merchantCategories';
import { getCategoryIcon } from '../../constants/pabili';
import { formatErrandId } from '../../utils/formatErrandId';
import { formatItemLabel } from '../../utils/format';

export interface HomeTabProps {
  user: any;
  navigation: any;
  defaultAddressText?: string | null;
  defaultLocationLabel?: string | null;
  activeErrand?: any | null;
  activeErrands?: any[];
  recentErrands: any[];
  loading?: boolean;
  onRefresh?: () => void;
  onViewTrack: () => void;
  onNavigateErrands?: () => void;
  onScroll?: (event: any) => void;
  onScrollBeginDrag?: (event: any) => void;
  onScrollEndDrag?: (event: any) => void;
  /** Height of the portal header overlaying the top of Home (0: none). */
  headerSpace?: number;
  /** How much of that header shows now, animated; the search bar sits under it. */
  headerOffset?: SharedValue<number>;
}

/**
 * Format summary items string for active card
 */
function formatItemSummary(errand: any): string {
  if (Array.isArray(errand.items) && errand.items.length > 0) {
    const list = errand.items.map(
      (it: any) => `${it.quantity ? `${it.quantity}x ` : ''}${formatItemLabel(it.name || it.itemName || 'Item', it.size)}`
    );
    return list.slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3} more` : '');
  }
  if (Array.isArray(errand.pabiliDetails) && errand.pabiliDetails.length > 0) {
    const list = errand.pabiliDetails.map(
      (it: any) => `${it.quantity ? `${it.quantity}x ` : ''}${formatItemLabel(it.itemName || it.name || 'Item', it.size)}`
    );
    return list.slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3} more` : '');
  }
  return errand.categories || 'Pabili Shopping Items';
}

/**
 * Format relative date/time for transaction history
 */
function formatRelativeDate(dateStr?: string | Date): string {
  if (!dateStr) return 'Recently';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Recently';
  }
}

function getCategoryTestId(catName: string): string {
  const lower = String(catName || '').toLowerCase();
  if (lower.includes('supermarket') || lower.includes('grocery') || lower.includes('mall')) return 'malls';
  if (lower.includes('pharmacy') || lower.includes('health') || lower.includes('med')) return 'pharmacy';
  if (lower.includes('bakery') || lower.includes('bread') || lower.includes('pastr')) return 'bakery';
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe')) return 'restaurant';
  if (lower.includes('retail') || lower.includes('merchandise') || lower.includes('goods')) return 'retail';
  return lower.replace(/[^a-z0-9]/g, '_');
}

function MerchantCategoryRow({
  category,
  imageUri,
  colors,
  isDark,
  onPress,
}: {
  category: BackendMerchantCategory;
  imageUri?: string;
  colors: any;
  isDark: boolean;
  onPress: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUri && !imageFailed);
  const Icon = getCategoryIcon(category.name);
  const testIdSuffix = getCategoryTestId(category.name);
  const description = category.description ? String(category.description).trim() : '';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.categoryRow}
      onPress={onPress}
      testID={`category-btn-${testIdSuffix}`}
      accessibilityRole="button"
      accessibilityLabel={description ? `${category.name}. ${description}` : category.name}
    >
      <View
        style={[
          styles.categoryImageContainer,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.categoryImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
            testID={`category-image-${testIdSuffix}`}
          />
        ) : (
          <View style={styles.categoryImageFallback} testID={`category-icon-${testIdSuffix}`}>
            <Icon size={32} color={colors.primary} strokeWidth={2} />
          </View>
        )}

        {(category.isRecommended || category.orderedBefore) ? (
          <View style={styles.categoryBadgeRow} pointerEvents="none">
            {category.isRecommended ? (
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.92)' : '#DC2626' },
                ]}
                testID={`category-badge-recommended-${testIdSuffix}`}
              >
                <Sparkles size={10} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.categoryBadgeText}>RECOMMENDED</Text>
              </View>
            ) : null}
            {category.orderedBefore ? (
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.92)' : '#059669' },
                ]}
                testID={`category-badge-ordered-${testIdSuffix}`}
              >
                <Clock size={10} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.categoryBadgeText}>ORDERED BEFORE</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.categoryMetaBlock}>
        <Text
          style={[styles.categoryTitle, { color: colors.textDark }]}
          numberOfLines={1}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
        >
          {category.name}
        </Text>
        {description ? (
          <Text
            style={[styles.categorySubtitle, { color: colors.textGray }]}
            numberOfLines={2}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
            testID={`category-desc-${testIdSuffix}`}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeTab({
  user,
  navigation,
  defaultAddressText,
  defaultLocationLabel,
  activeErrand,
  activeErrands,
  recentErrands,
  loading = false,
  onRefresh,
  onViewTrack,
  onNavigateErrands,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  headerSpace = 0,
  headerOffset,
}: HomeTabProps) {
  // The search bar follows the header as it slides (2026-10-13). Moved by a
  // transform, like the header, so the page's frame never changes mid-drag;
  // the old docking resized it and shook a slow scroll.
  const searchSlotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerOffset ? headerOffset.value : 0 }],
  }));
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const maintenanceNotice = useMaintenanceNotice('customer');
  const { width: windowWidth } = useResponsive();
  const contentWidth = Math.min(windowWidth - Spacing.md * 2, MAX_CONTENT_WIDTH);

  // Active backend merchant categories. The hook keeps this in step with the
  // server over the socket, so a category deactivated in the owner portal
  // disappears from the list without the customer refreshing anything.
  const { categories: backendCategories, isLoading: isCategoriesLoading } =
    useMerchantCategories();

  // Owner-set category photos (`store_cat_image`), keyed by category id. Only
  // categories the server reports as having one are fetched, and each is cached
  // on device by its `updatedAt`.
  const categoryImages = useCategoryImages(backendCategories);

  // Dynamic category search and exploration affinity
  const [searchAffinities, setSearchAffinities] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    getCategorySearchAffinities()
      .then((affinities) => {
        if (mounted && affinities) setSearchAffinities(affinities);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Newly updated app announcement modal state
  const [showUpdateWelcome, setShowUpdateWelcome] = useState(false);
  const [updatedVersionString, setUpdatedVersionString] = useState('');

  const ACTIVE_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];

  // Collect active errands array
  const activeList: any[] = (activeErrands && activeErrands.length > 0)
    ? activeErrands.filter((e) => ACTIVE_STATUSES.includes(String(e.status).toUpperCase()))
    : (activeErrand && ACTIVE_STATUSES.includes(String(activeErrand.status).toUpperCase()))
    ? [activeErrand]
    : [];

  const hasActiveOrders = activeList.length > 0;

  /**
   * Tapping a merchant category navigates to `MerchantCategoryStores` for that
   * category (or falls back to `StoreSearch` when no numeric category id is present).
   */
  const handleSelectCategory = (cat: BackendMerchantCategory) => {
    if (cat.name) {
      void recordCategorySearchAffinity(cat.name);
      setSearchAffinities((prev) => ({
        ...prev,
        [cat.name]: (prev[cat.name] || 0) + 1,
      }));
    }
    if (typeof cat.id === 'number') {
      navigation.navigate('MerchantCategoryStores', {
        user,
        category: {
          id: cat.id,
          name: cat.name,
          description: cat.description ?? null,
        },
      });
    } else {
      navigation.navigate('StoreSearch', { user });
    }
  };

  /**
   * Step 1 of a Pabili errand: the store search (StoreSearchScreen), as the
   * bottom bar's "+" opens it. The Errand Details form's step 1 until 2026-10-10.
   */
  const openStoreSearch = () => {
    navigation.navigate('StoreSearch', { user });
  };

  const activeCategories = useMemo(() => {
    const raw = backendCategories.filter((c) => Boolean(c?.name && (c.status === 'Active' || !c.status)));
    return prioritizeCategoriesWithAffinity(raw, searchAffinities);
  }, [backendCategories, searchAffinities]);

  const activeCategoriesCount = activeCategories.length;

  // Up to 5 recent transaction history items
  const recentHistory = recentErrands.slice(0, 5);

  // Check if app has been newly updated from an earlier version
  useEffect(() => {
    let isMounted = true;
    checkNewlyUpdatedApp()
      .then(({ isNewlyUpdated, currentVersion }) => {
        if (isMounted && isNewlyUpdated) {
          setUpdatedVersionString(currentVersion);
          setShowUpdateWelcome(true);
        }
      })
      .catch((err) => {
        console.warn('[HomeTab] Failed to check post-update status:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Home's content, as the active errands button's glass blurs it on Android.
  const homeContentRef = useRef<View>(null);
  // The floating search bar's slot, measured: the page starts below it.
  const [searchSlotHeight, setSearchSlotHeight] = useState(62);
  const openActiveErrands = () => navigation.navigate('ActiveErrands', { user, errands: activeList });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <BlurTargetView ref={homeContentRef} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bgApp }}
        contentContainerStyle={{
          // The page starts under the floating search bar.
          paddingTop: headerSpace + searchSlotHeight + Spacing.sm,
          paddingBottom: 80 + Math.max(insets.bottom, 16) + Spacing.md,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        scrollEventThrottle={16}
      >
        {loading && !hasActiveOrders && recentErrands.length === 0 ? (
          <View style={[styles.contentContainerWrapper, { maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: Spacing.md }]} key="home-skeleton">
            <HomeSkeleton />
          </View>
        ) : (
          <>
            {/* ── CHILD 0: Top Header & Active Orders ── */}
            <View style={[styles.contentContainerWrapper, { maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: Spacing.md }]} key="home-top">
              {/* Real-time SysAdmin Maintenance Notice Banner */}
              <MaintenanceNoticeBanner notice={maintenanceNotice} />

          {/* The "Delivering to" card moved into the header, in place of the
              Help "?" (HeaderLocationButton, 2026-10-11); the search bar took
              its place, floating above the page. */}

          {/* What the account is missing: a mobile number, its verification
              (manual sign-ups) or a birthdate (Google sign-ups). */}
          <AccountReminder user={user} navigation={navigation} />

          {/* The active errands moved to a liquid glass button floating over
              Home (ActiveErrandsFab, 2026-10-10); this card is gone. */}
        </View>

        {/* ── CHILD 2: Stores, Categories & Transactions Stream ── */}
        <View style={[styles.contentContainerWrapper, { maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: Spacing.md }]} key="home-content">
          <View style={styles.categoriesSectionWrapper}>

            {/* POPULAR STORES first (2026-10-10, the user's order): the best
                rated shops nearby on Google, a sideways row of photo cards the
                way foodpanda lists shops, each with its stars on the photo. */}
            <PopularStoresRow
              user={user}
              navigation={navigation}
              categoryImages={categoryImages}
              contentWidth={contentWidth}
            />

            {/* STORES NEAR YOU: in the same cards. The server ranks them
                (distance first, then the customer's habits). Real stores come
                before the Merchant Categories, the kinds of store. */}
            <NearbyStoresRow
              user={user}
              navigation={navigation}
              categoryImages={categoryImages}
              contentWidth={contentWidth}
            />

            <View style={styles.subsectionHeaderRow}>
              <Text style={[styles.subsectionTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                Explore merchants categories
              </Text>
            </View>

            {isCategoriesLoading && backendCategories.length === 0 ? (
              <CategoriesBentoSkeleton />
            ) : activeCategoriesCount === 0 ? (
              /* Zero dead ends: an empty catalogue is a real state the owner
                 can create, and it must explain itself and still offer a way
                 forward rather than leaving a blank band under the header. */
              <View
                style={[
                  styles.emptyCategories,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                    borderColor: colors.border,
                  },
                ]}
                testID="categories-empty-state"
              >
                <Store size={22} color={colors.textLight} />
                <Text style={[styles.emptyCategoriesTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                  No merchant categories available yet
                </Text>
                <Text style={[styles.emptyCategoriesBody, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                  You can still place an errand: search for any store in Tacurong above.
                </Text>
              </View>
            ) : (
              <View style={styles.categoriesVerticalList} testID="explore-merchants-categories-list">
                {activeCategories.map((cat, idx) => (
                  <MerchantCategoryRow
                    key={cat.id ? String(cat.id) : `${cat.name}-${idx}`}
                    category={cat}
                    imageUri={typeof cat.id === 'number' ? categoryImages[cat.id] : undefined}
                    colors={colors}
                    isDark={isDark}
                    onPress={() => handleSelectCategory(cat)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* 3. RECENT ACTIVITY SECTION (UP TO 5 TRANSACTIONS - ONLY SHOWN WHEN DATA EXISTS) */}
          {loading && recentHistory.length === 0 ? (
            <RecentActivitySkeleton />
          ) : recentHistory.length > 0 ? (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeader, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>Recent Activity</Text>

                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => {
                    if (onNavigateErrands) {
                      onNavigateErrands();
                    } else {
                      navigation.navigate('CustomerPortal', { initialTab: 'errands' });
                    }
                  }}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  testID="navigate-my-errands"
                  accessibilityLabel="View All Errand History"
                >
                  <ArrowRight size={18} color={colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {recentHistory.map((item) => {
                // In consumer view, fulfilled orders are displayed as DELIVERED
                const displayStatus = String(item.status).toUpperCase() === 'COMPLETED' ? 'DELIVERED' : item.status;

                return (
                  <TouchableOpacity
                    key={String(item.id || item.orderId)}
                    activeOpacity={0.7}
                    style={[
                      styles.recentRowItem,
                      {
                        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate('ErrandDetails', {
                        user,
                        errand: item,
                        errandId: item.orderId || item.id,
                      })
                    }
                    testID={`recent-errand-${item.orderId}`}
                  >
                    <View style={styles.recentRowLeft}>
                      <View style={styles.recentTitleRow}>
                        <Text style={[styles.recentErrandId, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                          {formatErrandId(item.orderId)}
                        </Text>
                        <Text style={[styles.recentDateText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                          {formatRelativeDate(item.createdAt)}
                        </Text>
                      </View>
                      <Text style={[styles.recentCategory, { color: colors.textMedium }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                        {formatItemSummary(item)}
                      </Text>
                    </View>

                    <View style={styles.recentRowRight}>
                      <StatusBadge status={displayStatus} />
                      <ChevronRight size={15} color={colors.textLight} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      </>
    )}
      </ScrollView>
      </BlurTargetView>

      {/* SEARCH, floating (2026-10-11): fixed above the page, so it stays in
          view however far Home scrolls; the page passes under it, behind a
          strip that continues the header. It used to be a sticky header that
          never stuck (Home's sections sit in one fragment, so the ScrollView
          had no child 1 to pin), and it scrolled up under the header. The
          strip lets touches through to the page (box-none). */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.floatingSearchSlot,
          { backgroundColor: colors.bgAppTranslucent },
          searchSlotStyle,
        ]}
        onLayout={(e) => setSearchSlotHeight(e.nativeEvent.layout.height)}
        testID="home-sticky-search"
      >
        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.liquidGlassSearchBar,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
            },
          ]}
          onPress={openStoreSearch}
          testID="home-store-search"
          accessibilityRole="button"
          accessibilityLabel="Search stores"
          accessibilityHint="Find the stores to buy from in Tacurong"
        >
          <View style={styles.searchIconBadge}>
            <Search size={18} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={2.4} />
          </View>
          <Text
            style={[
              styles.storeSearchPlaceholder,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          >
            Search stores, groceries, medicine...
          </Text>
          <View
            style={[
              styles.liquidGlassSearchAction,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0',
              },
            ]}
            testID="home-store-search-action"
          >
            <Text
              style={[
                styles.storeSearchActionText,
                { color: isDark ? '#F1F5F9' : '#1E293B' },
              ]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            >
              Search
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ACTIVE ERRANDS: a liquid glass button over the bottom bar's right end,
          only while an errand is under way. It opens Active Errands. */}
      <ActiveErrandsFab count={activeList.length} onPress={openActiveErrands} blurTarget={homeContentRef} />

      <ConfirmModal
        visible={showUpdateWelcome}
        title="Update Installed"
        message={`Sugo Express has been updated to v${updatedVersionString || getInstalledAppVersion()}. Enjoy the latest features and improvements!`}
        confirmLabel="Got it"
        singleButton
        variant="success"
        icon="success"
        destructive={false}
        onConfirm={() => setShowUpdateWelcome(false)}
        testID="update-welcome-modal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainerWrapper: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  welcomeGreetingText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.lg, 0.2),
    letterSpacing: -0.3,
    lineHeight: moderateScale(22, 0.2),
    marginBottom: Spacing.xs,
  },
  categoriesSectionWrapper: {
    // Room under the search bar (2026-10-11): its slot's 6 px, the page's 8 px
    // top padding and these 10 make 24 px, three times the 8 px between the
    // heading and its cards, so "Popular Stores" reads as a section, not as the
    // bar's caption.
    paddingTop: Spacing.sm + 2,
    marginBottom: Spacing.xl,
  },
  // Sticky Liquid Glass Search Bar (Child 1)
  floatingSearchSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    zIndex: 50,
  },
  liquidGlassSearchBar: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    borderWidth: 1.2,
    borderRadius: 25,
    paddingLeft: 14,
    paddingRight: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  searchIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeSearchPlaceholder: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  liquidGlassSearchAction: {
    borderRadius: 18,
    paddingHorizontal: 15,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  storeSearchActionText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  subsectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  subsectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
  },
  categoriesVerticalList: {
    gap: Spacing.lg,
  },
  categoryRow: {
    width: '100%',
  },
  categoryImageContainer: {
    width: '100%',
    height: moderateScale(176, 0.25),
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  categoryMetaBlock: {
    marginTop: Spacing.xs + 2,
    gap: 2,
  },
  categoryTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
  },
  categorySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'),
  },
  emptyCategories: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 4,
  },
  emptyCategoriesTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
    marginTop: 2,
  },
  emptyCategoriesBody: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    textAlign: 'center',
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
  },
  recentSection: {
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs + 2,
  },
  sectionHeader: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
  },
  viewAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
  },
  recentRowLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  recentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  recentErrandId: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  recentDateText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  recentCategory: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'body'),
  },
  recentRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
