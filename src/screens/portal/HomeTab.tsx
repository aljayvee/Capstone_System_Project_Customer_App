import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
  Alert,
} from 'react-native';
import {
  Bike,
  ChevronRight,
  ShoppingBag,
  Store,
  Pill,
  Utensils,
  ShoppingBasket,
  Plus,
  ArrowRight,
  Sparkles,
  MapPin,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import StatusBadge from '../../components/StatusBadge';
import HomeSkeleton, {
  LocationCardSkeleton,
  ActiveErrandSkeleton,
  CategoriesBentoSkeleton,
  RecentActivitySkeleton,
} from '../../components/HomeSkeleton';
import ErrandDetailsModal from '../../components/ErrandDetailsModal';
import MerchantCategoriesModal from '../../components/MerchantCategoriesModal';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useRateConfig } from '../../hooks/useRateConfig';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../../config/theme';
import { formatErrandId } from '../../utils/formatErrandId';
import { useCategoryImages } from '../../hooks/useCategoryImages';
import { useMerchantCategories } from '../../hooks/useMerchantCategories';

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
}

/**
 * Format summary items string for active card
 */
function formatItemSummary(errand: any): string {
  if (Array.isArray(errand.items) && errand.items.length > 0) {
    const list = errand.items.map(
      (it: any) => `${it.quantity ? `${it.quantity}x ` : ''}${it.name || it.itemName || 'Item'}`
    );
    return list.slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3} more` : '');
  }
  if (Array.isArray(errand.pabiliDetails) && errand.pabiliDetails.length > 0) {
    const list = errand.pabiliDetails.map(
      (it: any) => `${it.quantity ? `${it.quantity}x ` : ''}${it.itemName || it.name || 'Item'}`
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

/**
 * Visual defaults for a category tile: icon, tint, and the stock photo used
 * when the owner has not set one in the portal.
 *
 * Deliberately no size hint. This used to carry an `isHero` flag that decided
 * which tile got the large slot by matching the category NAME, which meant the
 * mosaic's shape depended on which categories the owner happened to activate.
 * Size is decided by position in the grid now; this function answers only
 * "what does this category look like". The `imageUrl` here
 * is a FALLBACK only — an owner-set `store_cat_image` always wins, so the grid
 * looks like Tacurong's actual stores rather than stock photography as soon as
 * the categories are photographed.
 */
function getMerchantCategoryButtonMeta(catName: string, primaryColor: string) {
  const lower = String(catName || '').toLowerCase();

  if (lower.includes('supermarket') || lower.includes('grocery') || lower.includes('mall')) {
    return {
      aliasId: 'malls',
      label: 'Malls & Grocery',
      Icon: Store,
      iconColor: '#FFFFFF',
      bgLight: '#EFF6FF',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('pharmacy') || lower.includes('health') || lower.includes('med')) {
    return {
      aliasId: 'pharmacy',
      label: 'Pharmacy',
      Icon: Pill,
      iconColor: '#FFFFFF',
      bgLight: '#ECFDF5',
      imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('bakery') || lower.includes('bread') || lower.includes('pastr')) {
    return {
      aliasId: 'bakery',
      label: 'Bakery',
      Icon: ShoppingBag,
      iconColor: '#FFFFFF',
      bgLight: '#FEF3C7',
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe')) {
    return {
      aliasId: 'restaurant',
      label: 'Food & Dining',
      Icon: Utensils,
      iconColor: '#FFFFFF',
      bgLight: '#FEE2E2',
      imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('retail') || lower.includes('merchandise') || lower.includes('goods')) {
    return {
      aliasId: 'retail',
      label: 'Retail & Goods',
      Icon: ShoppingBasket,
      iconColor: '#FFFFFF',
      bgLight: '#F5F3FF',
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    };
  }

  const displayLabel = catName.length > 12 ? catName.split(' ')[0] : catName;
  return {
    aliasId: catName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    label: displayLabel || 'Store',
    Icon: Store,
    iconColor: '#FFFFFF',
    bgLight: '#FFEEF3',
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80',
  };
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
}: HomeTabProps) {
  const { colors, isDark } = useThemeColor();
  const { baseFee } = useRateConfig();
  const { width: windowWidth, isTablet, isCompact } = useResponsive();
  const contentWidth = Math.min(windowWidth - Spacing.md * 2, MAX_CONTENT_WIDTH);
  const pairSlotWidth = Math.floor((contentWidth - Spacing.sm) / 2);
  const [selectedErrand, setSelectedErrand] = useState<any | null>(null);

  // Active slide index for multi-errand carousel
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Active backend merchant categories. The hook keeps this in step with the
  // server over the socket, so a category deactivated in the owner portal
  // disappears from the grid without the customer refreshing anything.
  const { categories: backendCategories, reload: reloadMerchantCategories, isLoading: isCategoriesLoading } =
    useMerchantCategories();

  // Owner-set category photos (`store_cat_image`), keyed by category id. Only
  // categories the server reports as having one are fetched, and each is cached
  // on device by its `updatedAt`.
  const categoryImages = useCategoryImages(backendCategories);

  // All Merchant Categories Collection Modal state (triggered by See More)
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);

  // Pull-to-refresh still forces a re-fetch. It is a fallback now rather than
  // the only way the grid ever updates.
  const handleRefresh = useCallback(() => {
    void reloadMerchantCategories();
    if (onRefresh) onRefresh();
  }, [reloadMerchantCategories, onRefresh]);

  const ACTIVE_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];

  // Collect active errands array
  const activeList: any[] = (activeErrands && activeErrands.length > 0)
    ? activeErrands.filter((e) => ACTIVE_STATUSES.includes(String(e.status).toUpperCase()))
    : (activeErrand && ACTIVE_STATUSES.includes(String(activeErrand.status).toUpperCase()))
    ? [activeErrand]
    : [];

  const hasActiveOrders = activeList.length > 0;

  const getStatusStep = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'AVAILABLE':
      case 'PENDING':
        return { step: 1, label: 'Finding available rider in Tacurong...' };
      case 'ASSIGNED':
        return { step: 2, label: 'Rider assigned • Heading to the store' };
      case 'IN_TRANSIT':
        return { step: 3, label: 'Items purchased • On the way to you' };
      case 'DELIVERED':
      case 'COMPLETED':
        return { step: 4, label: 'Successfully delivered' };
      case 'CANCELLED':
        return { step: 0, label: 'Order cancelled' };
      default:
        return { step: 1, label: 'Order update' };
    }
  };

  /**
   * Direct 1-Tap Category Navigation to "Items to Buy" (ErrandItemsScreen)
   */
  const handleSelectCategory = (catName: string) => {
    navigation.navigate('ErrandItems', {
      user,
      selectedCats: [catName],
    });
  };

  /**
   * Navigate to Multi-Category Pabili Errand Form (ErrandFormScreen)
   */
  const handleNavigateToCategoriesForm = () => {
    navigation.navigate('ErrandForm', {
      user,
      selectedServices: ['Pabili'],
    });
  };

  interface CategoryButtonItem {
    id: string;
    label: string;
    categoryParam: string;
    Icon: any;
    iconColor: string;
    bgLight: string;
    imageUrl?: string;
    /** Pinned location stores in this category — real social proof, from
     *  `_count.places` on the catalogue response. Undefined when unknown; never
     *  invented, per the ethical guardrail on fabricated counts. */
    storeCount?: number;
    isPabiliService?: boolean;
    isSeeMore?: boolean;
  }

  /**
   * How many categories the grid shows before deferring to the "See More" sheet.
   *
   * Hick's Law: decision time grows with the number of options, and this grid is
   * the first thing a customer sees. Five plus an explicit overflow tile reads as
   * a curated set; eleven reads as a directory to be waded through.
   */
  const MAX_GRID_CATEGORIES = 5;

  const pabiliTile: CategoryButtonItem = useMemo(
    () => ({
      id: 'pabili',
      label: 'Pabili (Any Store)',
      categoryParam: 'Pabili',
      Icon: ShoppingBag,
      iconColor: '#FFFFFF',
      bgLight: '#FFEEF3',
      imageUrl:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
      isPabiliService: true,
    }),
    []
  );

  const seeMoreTile: CategoryButtonItem = useMemo(
    () => ({
      id: 'see_more',
      label: 'See More',
      categoryParam: '',
      Icon: Plus,
      iconColor: '#8B5CF6',
      bgLight: '#F5F3FF',
      isSeeMore: true,
    }),
    []
  );

  /** Active backend categories, shaped for the mosaic. */
  const categoryTiles: CategoryButtonItem[] = useMemo(() => {
    return backendCategories
      .filter((c) => Boolean(c?.name && (c.status === 'Active' || !c.status)))
      .map((c) => {
        const meta = getMerchantCategoryButtonMeta(c.name, colors.primary);

        // The owner's photo from the portal takes precedence over the stock
        // image. A real storefront the customer recognises from Tacurong reads
        // as a real service — the visceral layer of the tile is doing the work
        // the label cannot.
        const ownerImage = typeof c.id === 'number' ? categoryImages[c.id] : undefined;

        return {
          id: meta.aliasId || `cat-${c.id ?? c.name}`,
          label: meta.label,
          categoryParam: c.name,
          Icon: meta.Icon,
          iconColor: meta.iconColor,
          bgLight: meta.bgLight,
          imageUrl: ownerImage || meta.imageUrl,
          storeCount: typeof c._count?.places === 'number' ? c._count.places : undefined,
        };
      })
      .slice(0, MAX_GRID_CATEGORIES);
  }, [backendCategories, categoryImages, colors.primary]);

  const handleTilePress = useCallback(
    (tile: CategoryButtonItem) => {
      if (tile.isPabiliService) {
        handleNavigateToCategoriesForm();
      } else if (tile.isSeeMore) {
        setIsCategoriesModalOpen(true);
      } else {
        handleSelectCategory(tile.categoryParam);
      }
    },
    [handleNavigateToCategoriesForm, handleSelectCategory]
  );

  /**
   * One category tile.
   *
   * `variant` controls only geometry — every tile is otherwise identical, so a
   * category looks like itself wherever the mosaic places it.
   *
   *   tall — full height of row 1, beside the stacked pair
   *   half — one of the two stacked tiles in row 1
   *   wide — a standard tile in the pair rows below
   */
  const renderCategoryTile = useCallback(
    (tile: CategoryButtonItem, variant: 'tall' | 'half' | 'wide') => {
      const { id, label, Icon, imageUrl, storeCount } = tile;
      const isTall = variant === 'tall';

      return (
        <TouchableOpacity
          key={id}
          activeOpacity={0.85}
          style={[
            styles.tile,
            variant === 'tall' && styles.tileTall,
            variant === 'half' && styles.tileHalf,
            variant === 'wide' && styles.tileWide,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#EEF2F6' },
            !isDark && Shadows.soft,
          ]}
          onPress={() => handleTilePress(tile)}
          testID={`category-btn-${id}`}
          accessibilityRole="button"
          accessibilityLabel={
            typeof storeCount === 'number'
              ? `${label}, ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}`
              : label
          }
        >
          <ImageBackground
            source={{ uri: imageUrl }}
            style={styles.tileImage}
            imageStyle={styles.bentoImageStyle}
          >
            {/* A three-stop scrim rather than a flat wash. Owner-uploaded
                photos vary wildly in brightness, and a single translucent
                black either muddied dark photos or left white text unreadable
                on bright ones. Weighting the darkness to the bottom protects
                the label without dulling the image the tile is selling. */}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.80)']}
              locations={[0, 0.45, 1]}
              style={styles.bentoOverlay}
              pointerEvents="none"
            />

            <View style={[styles.tileIconBadge, isTall && styles.tileIconBadgeTall]}>
              <Icon size={isTall ? 17 : 15} color="#FFFFFF" strokeWidth={2.6} />
            </View>

            <View style={styles.tileFooter}>
              <Text
                style={[styles.tileLabel, isTall && styles.tileLabelTall]}
                numberOfLines={isTall ? 2 : 1}
              >
                {label}
              </Text>

              {/* Social proof, and only when it is real. `storeCount` comes
                  from the catalogue's own `_count.places`; when the server
                  does not send it, nothing is shown rather than a guess. */}
              {typeof storeCount === 'number' && storeCount > 0 && (
                <View style={styles.tileCountRow}>
                  <MapPin size={9} color="rgba(255,255,255,0.85)" strokeWidth={2.6} />
                  <Text style={styles.tileCountText}>
                    {storeCount} {storeCount === 1 ? 'store' : 'stores'}
                  </Text>
                </View>
              )}
            </View>
          </ImageBackground>
        </TouchableOpacity>
      );
    },
    [isDark, handleTilePress]
  );

  // Up to 5 recent transaction history items
  const recentHistory = recentErrands.slice(0, 5);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm + 2,
        paddingBottom: 110,
        alignItems: 'center',
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        ) : undefined
      }
    >
      <View style={[styles.contentContainerWrapper, { maxWidth: MAX_CONTENT_WIDTH }]}>
      {loading && !hasActiveOrders && recentErrands.length === 0 ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* 0. WELCOME GREETING & DELIVERY LOCATION SECTION */}
          <View style={styles.greetingHeaderSection}>
            <Text style={[styles.welcomeGreetingText, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
              Hi, {user.firstName || user.username || 'Customer'}! 👋
            </Text>

            <TouchableOpacity
              style={[
                styles.deliveryLocationCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
                Shadows.soft,
              ]}
              onPress={() => navigation.navigate('CustomerLocation', { user })}
              activeOpacity={0.75}
              testID="home-location-pill"
            >
              <View style={[styles.locationIconBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3' }]}>
                <MapPin size={16} color={colors.primary} />
              </View>
              <View style={styles.locationInfoCol}>
                <Text style={[styles.deliveringToLabel, { color: colors.primary }]} maxFontSizeMultiplier={1.2}>DELIVERING TO</Text>
                <Text
                  style={[
                    styles.locationAddressText,
                    { color: defaultAddressText ? colors.textDark : colors.textGray },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  maxFontSizeMultiplier={1.25}
                >
                  {defaultAddressText
                    ? (defaultLocationLabel ? `${defaultLocationLabel} • ${defaultAddressText}` : defaultAddressText)
                    : '+ Tap to set your delivery address'}
                </Text>
              </View>
              <ChevronRight size={16} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* 1. ACTIVE ERRAND SECTION (MULTI-DISPLAY CAROUSEL IF MULTIPLE ACTIVE ORDERS) */}
          {hasActiveOrders && (
            <View style={styles.activeSectionWrapper}>
              {activeList.length === 1 ? (
                // Single Active Errand Card
                <View
                  style={[
                    styles.activeCard,
                    { backgroundColor: colors.card, borderColor: colors.primary },
                    Shadows.liftedUp,
                  ]}
                >
                  <View style={styles.activeHeader}>
                    <View style={styles.activeHeaderLeft}>
                      <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.activeHeaderTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
                        Active Errand #{formatErrandId(activeList[0].orderId)}
                      </Text>
                    </View>
                    <StatusBadge status={activeList[0].status} />
                  </View>

                  <Text style={[styles.activeStatusDesc, { color: colors.textMedium }]} maxFontSizeMultiplier={1.25}>
                    {getStatusStep(activeList[0].status).label}
                  </Text>

                  {/* Framed Summary Item Box */}
                  <View
                    style={[
                      styles.summaryItemBox,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.summaryLabel, { color: colors.primary }]} maxFontSizeMultiplier={1.2}>Summary Item:</Text>
                    <Text style={[styles.summaryText, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={1.25}>
                      {formatItemSummary(activeList[0])}
                    </Text>
                  </View>

                  <View style={styles.activeFooterRow}>
                    {activeList[0].status === 'ASSIGNED' || activeList[0].status === 'IN_TRANSIT' ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.trackBtn, { backgroundColor: colors.primary }]}
                        onPress={onViewTrack}
                      >
                        <Bike size={14} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.trackBtnText} maxFontSizeMultiplier={1.2}>Track Live</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.feePreviewBox}>
                        <Text style={[styles.feePreviewText, { color: colors.textGray }]} maxFontSizeMultiplier={1.25}>
                          Estimated: <Text style={{ fontFamily: FontFamily.bold, color: colors.primary }}>
                            ₱{Number(activeList[0].grandTotal ?? activeList[0].totalCost ?? baseFee).toFixed(2)}
                          </Text>
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.seeMoreLink}
                      onPress={() => setSelectedErrand(activeList[0])}
                    >
                      <Text style={[styles.seeMoreLinkText, { color: colors.primary }]} maxFontSizeMultiplier={1.2}>See more...</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Multi-Display Carousel for 2+ Active Orders
                <View>
                  <FlatList
                    data={activeList}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={contentWidth}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => {
                      const newIndex = Math.round(
                        e.nativeEvent.contentOffset.x / contentWidth
                      );
                      setActiveSlideIndex(newIndex);
                    }}
                    renderItem={({ item }) => (
                      <View
                        style={[
                          styles.activeCard,
                          {
                            width: contentWidth,
                            backgroundColor: colors.card,
                            borderColor: colors.primary,
                          },
                          Shadows.liftedUp,
                        ]}
                      >
                        <View style={styles.activeHeader}>
                          <View style={styles.activeHeaderLeft}>
                            <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
                            <Text style={[styles.activeHeaderTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
                              Active Errand #{formatErrandId(item.orderId)}
                            </Text>
                          </View>
                          <StatusBadge status={item.status} />
                        </View>

                        <Text style={[styles.activeStatusDesc, { color: colors.textMedium }]} maxFontSizeMultiplier={1.25}>
                          {getStatusStep(item.status).label}
                        </Text>

                        {/* Framed Summary Item Box */}
                        <View
                          style={[
                            styles.summaryItemBox,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.summaryLabel, { color: colors.primary }]}>Summary Item:</Text>
                          <Text style={[styles.summaryText, { color: colors.textDark }]} numberOfLines={2}>
                            {formatItemSummary(item)}
                          </Text>
                        </View>

                        <View style={styles.activeFooterRow}>
                          {item.status === 'ASSIGNED' || item.status === 'IN_TRANSIT' ? (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              style={[styles.trackBtn, { backgroundColor: colors.primary }]}
                              onPress={onViewTrack}
                            >
                              <Bike size={14} color="#FFFFFF" strokeWidth={2.4} />
                              <Text style={styles.trackBtnText}>Track Live</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.feePreviewBox}>
                              <Text style={[styles.feePreviewText, { color: colors.textGray }]}>
                                Estimated: <Text style={{ fontFamily: FontFamily.bold, color: colors.primary }}>
                                  ₱{Number(item.grandTotal ?? item.totalCost ?? baseFee).toFixed(2)}
                                </Text>
                              </Text>
                            </View>
                          )}

                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={styles.seeMoreLink}
                            onPress={() => setSelectedErrand(item)}
                          >
                            <Text style={[styles.seeMoreLinkText, { color: colors.primary }]}>See more...</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    keyExtractor={(item) => String(item.id || item.orderId)}
                  />

                  {/* Carousel Pagination Dots */}
                  <View style={styles.paginationDotsRow}>
                    {activeList.map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.dot,
                          {
                            backgroundColor: idx === activeSlideIndex ? colors.primary : colors.border,
                            width: idx === activeSlideIndex ? 16 : 6,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* 2. STORE CATEGORIES — BENTO MOSAIC                           */}
          {/*                                                              */}
          {/* Rebuilt from a uniform 48%-wide grid whose single "large"    */}
          {/* slot was decided by matching the category NAME against a     */}
          {/* hardcoded list. That made the layout a lottery: activate two */}
          {/* matching categories and you got two stacked full-width       */}
          {/* slabs; activate none and every tile was identical, so        */}
          {/* nothing drew the eye and the grid read as a wall.            */}
          {/*                                                              */}
          {/* Size is now driven by POSITION, not by name, so the mosaic   */}
          {/* holds its shape whatever the owner activates. Pabili is      */}
          {/* lifted out as the single dominant CTA — the contrast effect  */}
          {/* only works if one option is unmistakably the primary one.    */}
          {/* ─────────────────────────────────────────────────────────── */}
          <View style={styles.categoriesSectionWrapper}>
            <View style={styles.categoriesHeaderRow}>
              <Sparkles size={16} color={colors.primary} />
              <Text style={[styles.categoriesSectionTitle, { color: colors.textDark }]}>
                What would you like to buy?
              </Text>
            </View>

            {/* PRIMARY CTA — Pabili. Full width, tallest element, brand
                accent. Everything below is deliberately quieter so this stays
                the obvious first move for a customer who is not sure which
                category their errand belongs to. */}
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.featureCard, !isDark && Shadows.soft]}
              onPress={() => handleTilePress(pabiliTile)}
              testID="category-btn-pabili"
              accessibilityRole="button"
              accessibilityLabel="Pabili - buy from any store in Tacurong"
            >
              <ImageBackground
                source={{ uri: pabiliTile.imageUrl }}
                style={styles.featureImage}
                imageStyle={styles.bentoImageStyle}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.86)']}
                  locations={[0, 0.42, 1]}
                  style={styles.bentoOverlay}
                  pointerEvents="none"
                />
                <View style={styles.featureContent}>
                  <View style={[styles.featureBadge, { backgroundColor: colors.primary }]}>
                    <ShoppingBag size={12} color="#FFFFFF" strokeWidth={2.6} />
                    <Text style={styles.featureBadgeText}>MOST FLEXIBLE</Text>
                  </View>
                  <Text style={styles.featureTitle}>Pabili — Any Store</Text>
                  <Text style={styles.featureSubtitle} numberOfLines={1}>
                    Tell us what to buy and where. We handle the rest.
                  </Text>
                </View>
                <View style={[styles.featureArrow, { backgroundColor: colors.primary }]}>
                  <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.8} />
                </View>
              </ImageBackground>
            </TouchableOpacity>

            {isCategoriesLoading && backendCategories.length === 0 ? (
              <CategoriesBentoSkeleton />
            ) : categoryTiles.length === 0 ? (
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
                <Text style={[styles.emptyCategoriesTitle, { color: colors.textDark }]}>
                  No store categories available yet
                </Text>
                <Text style={[styles.emptyCategoriesBody, { color: colors.textGray }]}>
                  You can still place an errand — use Pabili above and name any store in Tacurong.
                </Text>
              </View>
            ) : (
              <View style={styles.mosaic}>
                {/* Row 1: one tall tile beside two stacked half tiles. This is
                    what makes it a bento rather than a grid — the size
                    difference is the hierarchy, readable before any label. */}
                {categoryTiles.length >= 3 ? (
                  <View style={styles.mosaicRow}>
                    <View style={styles.mosaicTallSlot}>
                      {renderCategoryTile(categoryTiles[0], 'tall')}
                    </View>
                    <View style={styles.mosaicStackSlot}>
                      {renderCategoryTile(categoryTiles[1], 'half')}
                      {renderCategoryTile(categoryTiles[2], 'half')}
                    </View>
                  </View>
                ) : (
                  /* One or two categories cannot fill a mosaic; a plain row of
                     equal tiles is honest rather than a lopsided gap. */
                  <View style={styles.mosaicRow}>
                    {categoryTiles.map((tile) => (
                      <View key={tile.id} style={styles.mosaicEqualSlot}>
                        {renderCategoryTile(tile, 'wide')}
                      </View>
                    ))}
                  </View>
                )}

                {/* Remaining categories plus the overflow tile, in pairs. */}
                <View style={styles.pairRow}>
                  {(categoryTiles.length >= 3 ? categoryTiles.slice(3) : []).map((tile) => (
                    <View key={tile.id} style={[styles.pairSlot, { width: pairSlotWidth }]}>
                      {renderCategoryTile(tile, 'wide')}
                    </View>
                  ))}

                  <View style={[styles.pairSlot, { width: pairSlotWidth }]}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[
                        styles.tile,
                        styles.seeMoreTile,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5F3FF',
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#DDD6FE',
                        },
                      ]}
                      onPress={() => handleTilePress(seeMoreTile)}
                      testID="category-btn-see_more"
                      accessibilityRole="button"
                      accessibilityLabel="See all store categories"
                    >
                      <View
                        style={[
                          styles.seeMoreIcon,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#EDE9FE' },
                        ]}
                      >
                        <Plus size={17} color="#8B5CF6" strokeWidth={2.8} />
                      </View>
                      <Text style={[styles.seeMoreLabel, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>See More</Text>
                      <Text style={[styles.seeMoreHint, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
                        All categories
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* 3. RECENT ACTIVITY SECTION (UP TO 5 TRANSACTIONS - ONLY SHOWN WHEN DATA EXISTS) */}
          {loading && recentHistory.length === 0 ? (
            <RecentActivitySkeleton />
          ) : recentHistory.length > 0 ? (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeader, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>Recent Activity</Text>

                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => {
                    if (onNavigateErrands) {
                      onNavigateErrands();
                    } else {
                      navigation.navigate('CustomerPortal', { initialTab: 'errands' });
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                    activeOpacity={0.75}
                    style={[
                      styles.recentRowItem,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      Shadows.soft,
                    ]}
                    onPress={() => setSelectedErrand(item)}
                    testID={`recent-errand-${item.orderId}`}
                  >
                    <View style={styles.recentRowLeft}>
                      <View style={styles.recentTitleRow}>
                        <Text style={[styles.recentErrandId, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                          #{formatErrandId(item.orderId)}
                        </Text>
                        <Text style={[styles.recentDateText, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
                          {formatRelativeDate(item.createdAt)}
                        </Text>
                      </View>
                      <Text style={[styles.recentCategory, { color: colors.textMedium }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
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
        </>
      )}

      {/* TRANSACTION DETAILS MODAL */}
      <ErrandDetailsModal
        visible={!!selectedErrand}
        errand={selectedErrand}
        user={user}
        navigation={navigation}
        onClose={() => setSelectedErrand(null)}
      />

      {/* ALL STORE & MERCHANT CATEGORIES MODAL (TRIGGERED BY "SEE MORE") */}
      <MerchantCategoriesModal
        visible={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        onSelectCategory={(catName) => {
          setIsCategoriesModalOpen(false);
          handleSelectCategory(catName);
        }}
      />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainerWrapper: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  greetingHeaderSection: {
    marginBottom: Spacing.lg,
  },
  welcomeGreetingText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.lg, 0.2),
    letterSpacing: -0.3,
    lineHeight: moderateScale(22, 0.2),
    marginBottom: Spacing.xs,
  },
  deliveryLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(10, 0.2),
    paddingHorizontal: moderateScale(12, 0.2),
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  locationIconBadge: {
    width: moderateScale(30, 0.2),
    height: moderateScale(30, 0.2),
    borderRadius: moderateScale(15, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 2,
  },
  locationInfoCol: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  deliveringToLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(9, 0.2),
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  locationAddressText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  activeSectionWrapper: {
    marginBottom: Spacing.lg,
  },
  activeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
  activeStatusDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginBottom: 6,
  },
  summaryItemBox: {
    borderRadius: BorderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  summaryLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(9.5, 0.2),
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  summaryText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: moderateScale(15, 0.2),
  },
  activeFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  trackBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  feePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feePreviewText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  seeMoreLink: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  seeMoreLinkText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  paginationDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  categoriesSectionWrapper: {
    marginBottom: Spacing.xl,
  },
  categoriesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  categoriesSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
  },
  featureCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    height: moderateScale(120, 0.2),
    marginBottom: Spacing.md,
  },
  featureImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  featureContent: {
    padding: Spacing.md,
    paddingRight: 56, // clear of the arrow affordance
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 5,
  },
  featureBadgeText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(8.5, 0.2),
    letterSpacing: 0.6,
  },
  featureTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.base, 0.2),
    color: '#FFFFFF',
    marginBottom: 2,
  },
  featureSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    color: 'rgba(255,255,255,0.88)',
  },
  featureArrow: {
    position: 'absolute',
    right: Spacing.sm + 2,
    bottom: Spacing.sm + 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mosaic: {
    gap: Spacing.md,
  },
  mosaicRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  mosaicTallSlot: {
    flex: 1,
    height: moderateScale(190, 0.2),
  },
  mosaicStackSlot: {
    flex: 1,
    height: moderateScale(190, 0.2),
    gap: Spacing.md,
  },
  mosaicEqualSlot: {
    flex: 1,
    height: moderateScale(95, 0.2),
  },
  pairRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  pairSlot: {
    height: moderateScale(90, 0.2),
  },
  tile: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  tileTall: {
    flex: 1,
  },
  tileHalf: {
    flex: 1,
  },
  tileWide: {
    flex: 1,
  },
  tileImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  tileIconBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  tileIconBadgeTall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  tileFooter: {
    padding: 7,
  },
  tileLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    color: '#FFFFFF',
  },
  tileLabelTall: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
  tileCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  tileCountText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(9, 0.2),
    color: 'rgba(255,255,255,0.88)',
  },
  seeMoreTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    height: '100%',
  },
  seeMoreIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  seeMoreLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  seeMoreHint: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(9, 0.2),
    marginTop: 1,
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
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
    marginTop: 2,
  },
  emptyCategoriesBody: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    textAlign: 'center',
    lineHeight: 14,
  },
  bentoImageStyle: {
    resizeMode: 'cover',
  },
  bentoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
  },
  viewAllBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(8, 0.2),
    paddingHorizontal: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    marginBottom: 6,
    borderWidth: 1,
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
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  recentDateText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(9.5, 0.2),
  },
  recentCategory: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  recentRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
