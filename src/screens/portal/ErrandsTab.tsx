import React, { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import TrueNativeModal from '../../components/transitions/TrueNativeModal';
import {
  Search,
  X,
  Bike,
  Package,
  ShoppingBag,
  MapPin,
  Store,
  User,
  Calendar,
  Radio,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Check,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  ReceiptText,
  MessageCircle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BadgeDollarSign,
  Banknote,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  BorderRadius,
  FontSizes,
  Spacing,
  FontFamily,
  Shadows,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
import ErrandsSkeleton, { ErrandsCardsSkeleton } from '../../components/ErrandsSkeleton';
import { formatErrandId } from '../../utils/formatErrandId';
import { formatPaymentMethod } from '../../utils/format';
import { getErrandProgressStage } from '../../utils/errandProgress';
import { extractMerchantCategories } from '../../utils/merchantCategories';
import { establishmentsFromStops } from '../../services/establishments';

type StatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type DateFilter = 'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
type SortOption = 'NEWEST' | 'OLDEST' | 'PRICE_HIGH' | 'PRICE_LOW';

const ACTIVE_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];
const COMPLETED_STATUSES = ['DELIVERED', 'COMPLETED'];
const CANCELLED_STATUSES = ['CANCELLED'];

/**
 * Human-Friendly Status Helper (Translates developer DB states into conversational customer language)
 */
function getHumanStatusInfo(status: string) {
  const norm = String(status || '').toUpperCase();
  switch (norm) {
    case 'AVAILABLE':
    case 'PENDING':
      return {
        label: 'Finding a Rider...',
        sublabel: 'Searching for nearby drivers in Tacurong',
        badgeBg: '#FEF3C7',
        badgeText: '#D97706',
        dotColor: '#F59E0B',
        icon: Clock,
      };
    case 'ASSIGNED':
      return {
        label: 'Rider Heading to Store',
        sublabel: 'Driver is on the way to pick up your order',
        badgeBg: '#EFF6FF',
        badgeText: '#2563EB',
        dotColor: '#3B82F6',
        icon: Bike,
      };
    case 'IN_TRANSIT':
      return {
        label: 'Out for Delivery',
        sublabel: 'Your rider is on the way to your destination',
        badgeBg: '#FFF0F5',
        badgeText: '#F62459',
        dotColor: '#F62459',
        icon: Radio,
      };
    case 'DELIVERED':
    case 'COMPLETED':
      return {
        label: 'Delivered',
        sublabel: 'Order fulfilled successfully',
        badgeBg: '#ECFDF5',
        badgeText: '#059669',
        dotColor: '#10B981',
        icon: CheckCircle2,
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        sublabel: 'Order was cancelled',
        badgeBg: '#FEE2E2',
        badgeText: '#DC2626',
        dotColor: '#EF4444',
        icon: AlertCircle,
      };
    default:
      return {
        label: status || 'Pending',
        sublabel: 'Order update',
        badgeBg: '#F3F4F6',
        badgeText: '#6B7280',
        dotColor: '#9CA3AF',
        icon: Package,
      };
  }
}

export interface ErrandsTabProps {
  user: any;
  navigation: any;
  errands: any[];
  loading: boolean;
  onRefresh: () => void;
  onViewTrack?: (errand?: any) => void;
  onScroll?: (event: any) => void;
}

export default function ErrandsTab({
  user,
  navigation,
  errands,
  loading,
  onRefresh,
  onViewTrack,
  onScroll,
}: ErrandsTabProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, isTablet, isCompact } = useResponsive();
  const [filter, setFilter] = useState<StatusFilter>('ACTIVE');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('NEWEST');
  const [search, setSearch] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  // Filter and search
  const filteredErrands = useMemo(() => {
    let result = errands.filter((e) => {
      // 1. Status Filter
      if (filter === 'ACTIVE' && !ACTIVE_STATUSES.includes(e.status)) return false;
      if (filter === 'COMPLETED' && !COMPLETED_STATUSES.includes(e.status)) return false;
      if (filter === 'CANCELLED' && !CANCELLED_STATUSES.includes(e.status)) return false;

      // 2. Date Filter
      if (dateFilter !== 'ALL' && e.createdAt) {
        const date = new Date(e.createdAt);
        const now = new Date();
        if (dateFilter === 'DAY') {
          if (date.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'WEEK') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (date < oneWeekAgo) return false;
        } else if (dateFilter === 'MONTH') {
          if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
        } else if (dateFilter === 'YEAR') {
          if (date.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // 3. Search Query
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const rawId = String(e.id || e.orderId || '').toLowerCase();
      const formatted = formatErrandId(e.orderId || e.id).toLowerCase();
      const category = String(e.categories || '').toLowerCase();
      const rider = String(e.riderName || '').toLowerCase();
      const address = String(e.deliveryAddress || '').toLowerCase();

      return (
        rawId.includes(q) ||
        formatted.includes(q) ||
        category.includes(q) ||
        rider.includes(q) ||
        address.includes(q)
      );
    });

    result.sort((a, b) => {
      if (sortOption === 'NEWEST') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortOption === 'OLDEST') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortOption === 'PRICE_HIGH') {
        return (Number(b.grandTotal ?? b.totalCost ?? 0)) - (Number(a.grandTotal ?? a.totalCost ?? 0));
      } else if (sortOption === 'PRICE_LOW') {
        return (Number(a.grandTotal ?? a.totalCost ?? 0)) - (Number(b.grandTotal ?? b.totalCost ?? 0));
      }
      return 0;
    });

    return result;
  }, [errands, filter, dateFilter, sortOption, search]);

  // Compute live filter counts
  const counts = useMemo(() => {
    // For Status Filters, we want to know the total possible ignoring Date/Search/Sort
    const active = errands.filter((e) => ACTIVE_STATUSES.includes(e.status)).length;
    const completed = errands.filter((e) => COMPLETED_STATUSES.includes(e.status)).length;
    const cancelled = errands.filter((e) => CANCELLED_STATUSES.includes(e.status)).length;

    // For Date Filters, we want to show counts that apply after Status + Search filters are applied
    let day = 0, week = 0, month = 0, year = 0;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const preFilteredForDates = errands.filter((e) => {
      if (filter === 'ACTIVE' && !ACTIVE_STATUSES.includes(e.status)) return false;
      if (filter === 'COMPLETED' && !COMPLETED_STATUSES.includes(e.status)) return false;
      if (filter === 'CANCELLED' && !CANCELLED_STATUSES.includes(e.status)) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const rawId = String(e.id || e.orderId || '').toLowerCase();
      const formatted = formatErrandId(e.orderId || e.id).toLowerCase();
      const category = String(e.categories || '').toLowerCase();
      return rawId.includes(q) || formatted.includes(q) || category.includes(q);
    });

    preFilteredForDates.forEach(e => {
       if (e.createdAt) {
         const d = new Date(e.createdAt);
         if (d.toDateString() === now.toDateString()) day++;
         if (d >= oneWeekAgo) week++;
         if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) month++;
         if (d.getFullYear() === now.getFullYear()) year++;
       }
    });

    return {
      all: errands.length,
      active,
      completed,
      cancelled,
      dates: { all: preFilteredForDates.length, day, week, month, year }
    };
  }, [errands, filter, search]);

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'ACTIVE', label: 'Active' },
    { key: 'ALL', label: 'All' },
    { key: 'COMPLETED', label: 'Delivered' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  /**
   * Active errands, pinned above the history.
   *
   * They are deliberately exempt from the date filter and from sorting. An
   * errand that is happening right now is the reason the customer opened this
   * screen, and it was previously just another row in the list — so sorting by
   * "Lowest Price" or filtering to "This Year" could push a live delivery below
   * a dozen finished ones. Status filter and search still apply, because those
   * are the customer explicitly asking to narrow what they see.
   */
  const pinnedActive = useMemo(() => {
    if (filter === 'COMPLETED' || filter === 'CANCELLED') return [];
    return filteredErrands
      .filter((e: any) => ACTIVE_STATUSES.includes(e.status))
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [filteredErrands, filter]);

  const historyErrands = useMemo(
    () =>
      filteredErrands.filter(
        (e: any) => !(pinnedActive.length > 0 && ACTIVE_STATUSES.includes(e.status))
      ),
    [filteredErrands, pinnedActive]
  );

  /** Which chronological bucket a past errand belongs to. */
  const getDateBucket = (createdAt: string | undefined): string => {
    if (!createdAt) return 'Earlier';
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return 'Earlier';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (date >= startOfToday) return 'Today';
    if (date >= startOfYesterday) return 'Yesterday';
    if (date >= sevenDaysAgo) return 'This week';
    if (date.getFullYear() === now.getFullYear()) return 'Earlier this year';
    return String(date.getFullYear());
  };

  type ListRow =
    | { kind: 'section'; key: string; label: string; count: number; tone?: 'live' }
    | { kind: 'errand'; key: string; errand: any; pinned: boolean };

  /**
   * One flat array of headers and cards, rendered by a single FlatList.
   *
   * A SectionList would express this more directly but would mean rewriting
   * every prop, ref and empty-state path on the existing list. Sentinel rows
   * keep all of that intact while still giving the history the scannable
   * date breaks a long list needs — a flat run of forty identical cards has no
   * landmarks, so finding "the one from last Tuesday" means reading every row.
   */
  const listData: ListRow[] = useMemo(() => {
    const rows: ListRow[] = [];

    if (pinnedActive.length > 0) {
      rows.push({
        kind: 'section',
        key: 'section-live',
        label: 'Happening now',
        count: pinnedActive.length,
        tone: 'live',
      });
      pinnedActive.forEach((e: any) =>
        rows.push({ kind: 'errand', key: `live-${e.orderId || e.id}`, errand: e, pinned: true })
      );
    }

    // Date buckets only make sense while the list is in date order. Under a
    // price sort they would interleave meaninglessly, so the history stays flat
    // and gets a single header naming the order it is actually in.
    const isChronological = sortOption === 'NEWEST' || sortOption === 'OLDEST';

    if (historyErrands.length === 0) return rows;

    if (!isChronological) {
      rows.push({
        kind: 'section',
        key: 'section-sorted',
        label: sortOption === 'PRICE_HIGH' ? 'Highest price first' : 'Lowest price first',
        count: historyErrands.length,
      });
      historyErrands.forEach((e: any) =>
        rows.push({ kind: 'errand', key: `hist-${e.orderId || e.id}`, errand: e, pinned: false })
      );
      return rows;
    }

    let currentBucket: string | null = null;
    historyErrands.forEach((e: any) => {
      const bucket = getDateBucket(e.createdAt);
      if (bucket !== currentBucket) {
        currentBucket = bucket;
        rows.push({
          kind: 'section',
          key: `section-${bucket}`,
          label: bucket,
          count: historyErrands.filter((x: any) => getDateBucket(x.createdAt) === bucket).length,
        });
      }
      rows.push({ kind: 'errand', key: `hist-${e.orderId || e.id}`, errand: e, pinned: false });
    });

    return rows;
  }, [pinnedActive, historyErrands, sortOption]);

  /** Items in an errand, however this particular record happens to carry them. */
  const getItemCount = (item: any): number => {
    if (Array.isArray(item.items) && item.items.length > 0) return item.items.length;
    if (Array.isArray(item.pabiliDetails) && item.pabiliDetails.length > 0)
      return item.pabiliDetails.length;
    return 0;
  };

  /**
   * Repeat a past errand.
   *
   * The Hook Model's "action" step has to be the cheapest possible interaction,
   * and reordering is the single most repeated intent on a history screen — yet
   * the only thing a finished card offered was a receipt. This carries the
   * previous errand's stores into a fresh step 1 rather than submitting
   * anything: the customer still confirms items, address and payment, so
   * nothing is ordered behind their back.
   *
   * Since 2026-10-10 that step 1 is the store search, opened with the errand's
   * own stops picked (name, spot, category), not the Errand Details form with
   * its merchant categories.
   */
  const handleReorder = (item: any) => {
    navigation.navigate('StoreSearch', {
      user,
      reorderFrom: {
        errandId: String(item.orderId || item.id),
        stores: establishmentsFromStops(item.pinpoints),
      },
    });
  };

  const handleTrackShortcut = (errand: any) => {
    if (onViewTrack) {
      onViewTrack(errand);
    } else {
      navigation.navigate('CustomerPortal', { initialTab: 'track', user });
    }
  };

  // Helper to format human store title
  const getOrderDisplayTitle = (item: any) => {
    if (item.pinpoints && item.pinpoints.length > 0) {
      const stores = item.pinpoints.map((p: any) => p.storeName || p.category?.name || p.storeCategory).filter(Boolean);
      if (stores.length > 0) return `${stores.join(' & ')}`;
    }
    const extracted = extractMerchantCategories(item);
    if (extracted && extracted.toLowerCase() !== 'merchant categories') {
      return extracted;
    }
    return 'Merchant Categories';
  };

  const dateTabs: { key: DateFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Anytime', count: counts.dates.all },
    { key: 'DAY', label: 'Today', count: counts.dates.day },
    { key: 'WEEK', label: 'Past 7 Days', count: counts.dates.week },
    { key: 'MONTH', label: 'This Month', count: counts.dates.month },
    { key: 'YEAR', label: 'This Year', count: counts.dates.year },
  ];

  const sortTabs: { key: SortOption; label: string; description: string; icon: any }[] = [
    {
      key: 'NEWEST',
      label: 'Newest First',
      description: 'Most recent errands first',
      icon: ArrowDownWideNarrow,
    },
    {
      key: 'OLDEST',
      label: 'Oldest First',
      description: 'Earliest errands first',
      icon: ArrowUpNarrowWide,
    },
    {
      key: 'PRICE_HIGH',
      label: 'Highest Price',
      description: 'Highest total amount first',
      icon: BadgeDollarSign,
    },
    {
      key: 'PRICE_LOW',
      label: 'Lowest Price',
      description: 'Lowest total amount first',
      icon: Banknote,
    },
  ];

  const activeDateLabel = dateTabs.find((d) => d.key === dateFilter)?.label || 'Anytime';
  const activeSortLabel = sortTabs.find((s) => s.key === sortOption)?.label || 'Newest First';
  const hasActiveFilters = search.trim().length > 0 || dateFilter !== 'ALL' || sortOption !== 'NEWEST';
  const showViewAllPrompt = filter === 'ACTIVE' && counts.all > 0 && !hasActiveFilters;
  const isFiltered = hasActiveFilters || filter !== 'ALL';

  /**
   * A milestone line, shown only on round numbers.
   *
   * Reaching one is an identity-reinforcing moment — "I am someone who uses
   * this" — and those are what turn a useful app into a habit. Gated to
   * 5/10/25/50/100 precisely so it stays an event: a badge that congratulates
   * you on every single order is wallpaper within a week and reads as flattery.
   */
  const milestone = useMemo(() => {
    const n = counts.completed;
    const marks = [100, 50, 25, 10, 5];
    return marks.includes(n) ? `${n} errands completed — thank you!` : null;
  }, [counts.completed]);

  const resetAllFilters = () => {
    setSearch('');
    setFilter('ACTIVE');
    setDateFilter('ALL');
    setSortOption('NEWEST');
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bgApp,
          paddingTop: insets.top > 0 ? insets.top + Spacing.xs : Spacing.md,
        },
      ]}
    >
      {/* 1. FIXED TOP HEADER & CONTROLS (NON-SCROLLING) */}
      <View style={styles.fixedTopSection}>
        {/* Header Row (Matching ChatTab) */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerLeftCol}>
              <Text style={[styles.screenTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                My Errands
              </Text>
              {milestone ? (
                <View style={styles.milestonePill}>
                  <Sparkles size={11} color={colors.primary} strokeWidth={2.4} />
                  <Text style={[styles.milestoneText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                    {milestone}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Header Right Actions */}
            <View style={styles.headerRightRow}>
              {counts.active > 0 && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.liveHeaderPill}
                  onPress={() => setFilter('ACTIVE')}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                >
                  <Text style={[styles.liveHeaderPillText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                    {counts.active} Ongoing
                  </Text>
                </TouchableOpacity>
              )}

              {/* Date Filter Action Button (Matching ChatTab headerHelpBtn) */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerActionBtn}
                onPress={() => setShowDateModal(true)}
                testID="errands-date-filter-btn"
                accessibilityLabel="Filter by date"
                hitSlop={PortalTouchTargets.compactHitSlop}
              >
                <Calendar
                  size={19}
                  color={dateFilter !== 'ALL' ? colors.primary : colors.textGray}
                  strokeWidth={2}
                />
                {dateFilter !== 'ALL' && <View style={[styles.filterActiveDot, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Apple Liquid Glass Search Bar - Full Width */}
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                shadowOpacity: isDark ? 0.25 : 0.08,
              },
            ]}
            testID="errands-search-bar"
          >
            <Search size={18} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={2.4} />
            <TextInput
              style={[styles.searchInput, { color: colors.textDark }]}
              placeholder="Search stores, items, or errand #..."
              placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
              value={search}
              onChangeText={setSearch}
              testID="errands-search-input"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={PortalTouchTargets.compactHitSlop}
                style={styles.clearBtn}
              >
                <X size={14} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Dynamic Status Filter Capsules - Flat Minimalist Flex Row (Matching ChatTab) */}
        <View style={styles.filterBar}>
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isActive ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => setFilter(tab.key)}
                testID={`filter-tab-${tab.key}`}
                hitSlop={PortalTouchTargets.compactHitSlop}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { color: isActive ? '#FFFFFF' : colors.textDark },
                    isActive && styles.filterTabTextActive,
                  ]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>


      {/* 4. MAIN LIST / CARDS */}
      {loading && errands.length === 0 ? (
        <ErrandsCardsSkeleton />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(row) => row.key}
          // The search field above stays put while the keyboard covers the bottom
          // of this list: a drag puts it away so every row can be reached, and a
          // tap on a row works first time instead of only closing the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.listContent, { paddingBottom: 80 + Math.max(insets.bottom, 16) + Spacing.md }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconHalo,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : '#F3F4F6',
                  },
                ]}
              >
                <Package size={36} color={colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textDark }]}>
                {search
                  ? 'No Matching Errands'
                  : showViewAllPrompt
                  ? 'No Active Errands'
                  : isFiltered
                  ? 'No Matching Errands'
                  : 'No Errands Found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textGray }]}>
                {search
                  ? `No errands matching "${search}". Try searching with another store or keyword.`
                  : showViewAllPrompt
                  ? 'You don’t have any active errands right now.'
                  : isFiltered
                  ? 'No errands match your current date or status filters. Reset filters to see all your orders.'
                  : 'You haven’t requested any errands yet. Need food, groceries, or medicine bought in Tacurong?'}
              </Text>

              {isFiltered && !showViewAllPrompt && (
                <View style={styles.emptyActionsContainer}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.emptyResetBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                        borderColor: isDark ? colors.border : '#E5E7EB',
                      },
                    ]}
                    onPress={resetAllFilters}
                  >
                    <RotateCcw size={14} color={colors.textDark} strokeWidth={2.2} />
                    <Text style={[styles.emptyResetBtnText, { color: colors.textDark }]}>
                      Reset All Filters
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          renderItem={({ item: row, index }) => {
            if (row.kind === 'section') {
              const isFirstSection = listData.findIndex((r) => r.kind === 'section') === index;
              const isLiveSection = row.tone === 'live' || row.key === 'section-live';
              const firstHistorySectionIndex = listData.findIndex(
                (r) => r.kind === 'section' && r.key !== 'section-live'
              );
              const isFirstHistorySection = index === firstHistorySectionIndex;
              const isSortedSection = row.key === 'section-sorted';
              const showSortControl = isSortedSection || isFirstHistorySection;

              return (
                <View
                  style={[
                    styles.sectionHeaderRow,
                    isFirstSection && styles.sectionHeaderRowFirst,
                  ]}
                >
                  {isSortedSection ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowSortModal(true)}
                      style={styles.sectionSortLabelBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Current sort: ${row.label}. Tap to change sort order.`}
                    >
                      <Text
                        style={[
                          styles.sectionHeaderLabel,
                          { color: colors.textDark },
                        ]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                      >
                        {row.label}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[
                        styles.sectionHeaderLabel,
                        { color: isLiveSection ? colors.primary : colors.textDark },
                      ]}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                    >
                      {row.label}
                    </Text>
                  )}

                  <View
                    style={[
                      styles.sectionHeaderRule,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.10)'
                          : '#E2E8F0',
                      },
                    ]}
                  />

                  {showSortControl ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      hitSlop={PortalTouchTargets.compactHitSlop}
                      style={[
                        styles.sectionSortBtn,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#F1F5F9',
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => setShowSortModal(true)}
                      testID="errands-sort-btn"
                      accessibilityRole="button"
                      accessibilityLabel="Sort Errands"
                    >
                      <ArrowDownWideNarrow
                        size={14}
                        color={sortOption !== 'NEWEST' ? colors.primary : colors.textMedium}
                        strokeWidth={2.2}
                      />
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[styles.sectionHeaderCount, { color: colors.textLight }]}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                    >
                      {row.count}
                    </Text>
                  )}
                </View>
              );
            }

            const item = row.errand;
            const fee = Number(item.grandTotal ?? item.totalCost ?? 0).toFixed(2);
            const riderFirstName = item.riderName
              ? String(item.riderName).trim().split(' ')[0]
              : null;
            const isCancelled = item.status === 'CANCELLED';
            const isPendingOrAvailable = item.status === 'PENDING' || item.status === 'AVAILABLE';
            const isAssignedOrInTransit = item.status === 'ASSIGNED' || item.status === 'IN_TRANSIT';
            const isDeliveredOrCompleted = COMPLETED_STATUSES.includes(item.status);
            const isOngoing = ACTIVE_STATUSES.includes(item.status);
            const statusInfo = getHumanStatusInfo(item.status);
            // Same five-stage model the Track tab uses, so the two screens can
            // never disagree about how far along an errand is.
            const progressStage = getErrandProgressStage({
              status: item.status,
              itemsPurchasedAt: item.itemsPurchasedAt,
              pinpoints: item.pinpoints,
              riderLocation: null,
              destination: null,
            });
            const itemCount = getItemCount(item);
            const StatusIcon = statusInfo.icon;
            const displayTitle = getOrderDisplayTitle(item);

            const formattedDate = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'Recent Order';

            // Extract stores text
            const storeNames = (item.pinpoints || [])
              .map((p: any) => p.storeName)
              .filter(Boolean)
              .join(' → ');

            // ==========================================
            // 1. ACTIVE ORDER: HERO CARD (HAPPENING NOW)
            // ==========================================
            if (isOngoing) {
              return (
                <View
                  style={[
                    styles.heroCard,
                    {
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                    },
                  ]}
                  testID={`errand-card-${item.orderId || item.id}`}
                >
                  {/* Top Live Progress Header */}
                  <View style={styles.heroTopBar}>
                    <View style={styles.liveTagRow}>
                      <Text style={[styles.liveTagLabel, { color: isPendingOrAvailable ? '#D97706' : colors.primary }]}>
                        {isPendingOrAvailable ? 'REQUEST IN REVIEW' : 'DELIVERY IN PROGRESS'}
                      </Text>
                    </View>

                    {/* Humanized Friendly Status (Unboxed Typography) */}
                    <View style={styles.humanStatusPill}>
                      <StatusIcon size={12} color={statusInfo.badgeText} strokeWidth={2.4} />
                      <Text style={[styles.humanStatusText, { color: statusInfo.badgeText }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  {/* GOAL-GRADIENT RAIL
                      Five stages, with everything reached so far filled in.
                      The card previously showed only a status pill — a label
                      with no sense of distance travelled or distance left, so
                      "Rider Heading to Store" read the same at minute one as at
                      minute twenty. Motivation to stay with a task rises as the
                      finish line looks closer, which is exactly what a status
                      string alone cannot convey. Completed stages stay filled
                      rather than greying out; greying reads as regression. */}
                  <View style={styles.railWrap}>
                    <View style={styles.railTrack}>
                      {[0, 1, 2, 3, 4].map((stageIndex) => {
                        const reached = stageIndex <= progressStage.index;
                        return (
                          <View
                            key={stageIndex}
                            style={[
                              styles.railSegment,
                              {
                                backgroundColor: reached
                                  ? colors.primary
                                  : isDark
                                  ? 'rgba(255,255,255,0.12)'
                                  : '#E9EDF2',
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                    <View style={styles.railLabelRow}>
                      <Text style={[styles.railStageLabel, { color: colors.textDark }]} numberOfLines={1}>
                        {progressStage.label}
                      </Text>
                      <Text style={[styles.railStepCount, { color: colors.textLight }]}>
                        Step {progressStage.index + 1} of 5
                      </Text>
                    </View>
                    {progressStage.subLabel ? (
                      <Text style={[styles.railSubLabel, { color: colors.primary }]} numberOfLines={1}>
                        {progressStage.subLabel}
                      </Text>
                    ) : null}
                  </View>

                  {/* Main Order Identity */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate('ErrandDetails', {
                        user,
                        errand: item,
                        errandId: item.orderId || item.id,
                      })
                    }
                    style={styles.heroBodyPressable}
                  >
                    <View style={styles.heroTitleRow}>
                      <View
                        style={[
                          styles.serviceBadgeCircle,
                          { backgroundColor: isDark ? 'rgba(246,36,89,0.15)' : '#FFF0F5' },
                        ]}
                      >
                        <ShoppingBag size={18} color={colors.primary} strokeWidth={2.4} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.heroCardTitle, { color: colors.textDark }]}>
                          {displayTitle}
                        </Text>
                        <Text style={[styles.heroSubText, { color: colors.textLight }]}>
                          Order {formatErrandId(item.orderId || item.id)} • {formattedDate}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.textLight} />
                    </View>

                    {/* Visual Route Path: Store ➔ Destination */}
                    <View style={styles.routeContainer}>
                      {/* Store */}
                      <View style={styles.routeStep}>
                        <View style={[styles.routeIconNode, { backgroundColor: '#FFF7ED' }]}>
                          <Store size={12} color="#EA580C" strokeWidth={2.4} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.routeLabel, { color: colors.textLight }]}>
                            PICKUP FROM
                          </Text>
                          <Text
                            style={[styles.routeText, { color: colors.textDark }]}
                            numberOfLines={1}
                          >
                            {storeNames || 'Merchant Store'}
                          </Text>
                        </View>
                      </View>

                      {/* Connector line */}
                      <View style={styles.routeConnectorLine} />

                      {/* Destination */}
                      <View style={styles.routeStep}>
                        <View style={[styles.routeIconNode, { backgroundColor: '#FDF2F8' }]}>
                          <MapPin size={12} color={colors.primary} strokeWidth={2.4} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.routeLabel, { color: colors.textLight }]}>
                            DELIVER TO
                          </Text>
                          <Text
                            style={[styles.routeText, { color: colors.textGray }]}
                            numberOfLines={1}
                          >
                            {item.deliveryAddress || 'Tacurong City'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Price, Payment & Rider Footer */}
                    <View style={styles.heroFooter}>
                      <View>
                        <Text style={[styles.heroPriceLabel, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                          {isPendingOrAvailable ? 'DELIVERY FARE' : 'TOTAL BILL'}
                        </Text>
                        {isPendingOrAvailable ? (
                          <Text
                            style={{
                              fontSize: scaledPortalFontSize(PortalFontSizes.caption),
                              lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
                              color: '#D97706',
                              fontFamily: FontFamily.semibold,
                              marginTop: 2,
                            }}
                            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                          >
                            Pending Completion
                          </Text>
                        ) : (
                          <Text style={[styles.heroPriceText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                            ₱{fee}
                          </Text>
                        )}
                        {isPendingOrAvailable && (
                          <Text
                            style={{
                              fontSize: scaledPortalFontSize(PortalFontSizes.micro),
                              lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
                              color: colors.textLight,
                              fontStyle: 'italic',
                              marginTop: 1,
                            }}
                            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                          >
                            Applied upon rider delivery
                          </Text>
                        )}
                      </View>

                      <View style={styles.heroPillGroup}>
                        <View style={styles.microPill}>
                          <Text style={[styles.microPillText, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                            {isPendingOrAvailable || !item.paymentMethod || String(item.paymentMethod).toUpperCase() === 'PENDING'
                              ? 'Payment: Pending'
                              : formatPaymentMethod(item.paymentMethod, 'full')}
                          </Text>
                        </View>

                        {riderFirstName && isAssignedOrInTransit && (
                          <View style={styles.microPill}>
                            <User size={11} color={colors.textGray} strokeWidth={2.2} />
                            <Text style={[styles.microPillText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                              Rider: {riderFirstName}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* PROMINENT ACTION CTA */}
                  {isAssignedOrInTransit ? (
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.trackCtaBtn, { backgroundColor: colors.primary }, Shadows.soft]}
                      onPress={() => handleTrackShortcut(item)}
                    >
                      <Radio size={16} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.trackCtaText}>View Live Rider GPS Map</Text>
                      <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.trackCtaBtn, { backgroundColor: '#1E3A5F' }, Shadows.soft]}
                      onPress={() =>
                        navigation.navigate('CustomerChat', {
                          user,
                          errandId: item.orderId || item.id,
                          initialStatus: item.status,
                        })
                      }
                    >
                      <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.4} />
                      <Text style={styles.trackCtaText}>Chat with Dispatcher / View Request</Text>
                      <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }

            // ==========================================
            // 2. PAST ORDER CARD (DELIVERED / CANCELLED)
            // ==========================================
            return (
              <TouchableOpacity
                activeOpacity={0.75}
                style={[
                  styles.standardCard,
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
                testID={`errand-card-${item.orderId || item.id}`}
              >
                {/* Top Row: Store Title + Humanized Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.standardServiceIcon,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : statusInfo.badgeBg,
                        },
                      ]}
                    >
                      <StatusIcon size={16} color={statusInfo.badgeText} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.textDark }]} numberOfLines={1}>
                        {displayTitle}
                      </Text>
                      <Text style={[styles.cardSubText, { color: colors.textLight }]}>
                        {itemCount > 0
                          ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} • ${formattedDate}`
                          : `${formatErrandId(item.orderId || item.id)} • ${formattedDate}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.standardStatusPill}>
                    <Text style={[styles.standardStatusText, { color: statusInfo.badgeText }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                {/* Delivery Address snippet */}
                <View style={styles.addressLine}>
                  <MapPin size={12} color={colors.textLight} strokeWidth={2} />
                  <Text
                    style={[styles.addressLineText, { color: isCancelled ? '#EF4444' : colors.textGray }]}
                    numberOfLines={1}
                  >
                    {isCancelled
                      ? 'Order was cancelled • No items delivered'
                      : isPendingOrAvailable
                      ? item.deliveryAddress
                        ? `Deliver to ${item.deliveryAddress}`
                        : 'Tacurong City'
                      : item.deliveryAddress
                      ? `Delivered to ${item.deliveryAddress}`
                      : 'Tacurong City'}
                  </Text>
                </View>

                {/* Footer: Fee, Method, Receipt Action */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerLeftGroup}>
                    {isCancelled ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.standardPriceText, { color: colors.textLight, textDecorationLine: 'line-through' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                          ₱{fee}
                        </Text>
                        <Text
                          style={{
                            color: '#DC2626',
                            fontSize: scaledPortalFontSize(PortalFontSizes.micro),
                            lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
                            fontFamily: FontFamily.semibold,
                          }}
                          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                        >
                          Voided (₱0.00)
                        </Text>
                      </View>
                    ) : isPendingOrAvailable ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            color: '#D97706',
                            fontSize: scaledPortalFontSize(PortalFontSizes.caption),
                            lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
                            fontFamily: FontFamily.semibold,
                          }}
                          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                        >
                          Fare: Pending Completion
                        </Text>
                        <View style={styles.dot} />
                        <Text style={[styles.footerSubText, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                          Awaiting Rider
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.standardPriceText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                          ₱{fee}
                        </Text>
                        <View style={styles.dot} />
                        <Text style={[styles.footerSubText, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                          {formatPaymentMethod(item.paymentMethod, 'short')}
                        </Text>
                        {riderFirstName && (
                          <>
                            <View style={styles.dot} />
                            <View style={styles.riderChip}>
                              <User size={11} color={colors.textGray} />
                              <Text style={[styles.footerSubText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                                {riderFirstName}
                              </Text>
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </View>

                  <View style={styles.viewReceiptRow}>
                    <ReceiptText size={13} color={isCancelled ? colors.textGray : colors.primary} strokeWidth={2} />
                    <Text style={[styles.viewReceiptText, { color: isCancelled ? colors.textGray : colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                      {isCancelled ? 'Details' : 'Receipt'}
                    </Text>
                    <ChevronRight size={14} color={isCancelled ? colors.textGray : colors.primary} />
                  </View>
                </View>

                {/* ORDER AGAIN
                    A finished errand offered only a receipt, which is a
                    backward-looking action on a screen full of things the
                    customer has already decided they wanted. Repeating an order
                    is the most common intent here and it took six screens to do
                    by hand. Offered on delivered orders only: repeating a
                    cancelled one usually means repeating whatever went wrong.

                    It opens a prefilled form rather than placing the order —
                    items, address and payment are still confirmed by the
                    customer, so nothing is bought on a single accidental tap. */}
                {isDeliveredOrCompleted && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.reorderBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F9FAFB',
                        borderColor: isDark ? colors.border : '#E5E7EB',
                      },
                    ]}
                    onPress={() => handleReorder(item)}
                    testID={`errand-reorder-${item.orderId || item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Order again from ${displayTitle}`}
                  >
                    <RotateCcw size={13} color={colors.primary} strokeWidth={2.4} />
                    <Text style={[styles.reorderBtnText, { color: colors.primary }]}>
                      Order again
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* 5. DATE RANGE SELECTOR MODAL */}
      <TrueNativeModal
        visible={showDateModal}
        onClose={() => setShowDateModal(false)}
        containerStyle={{ paddingHorizontal: Spacing.lg }}
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
            },
            Shadows.liftedUp,
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
            ]}
          >
            <View style={styles.modalHeaderLeft}>
              <View
                style={[
                  styles.modalIconBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  },
                ]}
              >
                <Calendar size={16} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text
                style={[styles.modalTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
              >
                Filter by Date
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowDateModal(false)}
              hitSlop={PortalTouchTargets.compactHitSlop}
              style={[
                styles.modalCloseBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close date filter"
            >
              <X size={16} color={colors.textMedium} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalOptionsList}>
            {dateTabs.map((tab) => {
              const isSelected = dateFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.7}
                  style={[
                    styles.modalOptionItem,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC')
                        : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                      borderColor: isSelected
                        ? (isDark ? 'rgba(255, 255, 255, 0.18)' : '#CBD5E1')
                        : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                    },
                  ]}
                  onPress={() => {
                    setDateFilter(tab.key);
                    setShowDateModal(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${tab.label}, ${tab.count} orders`}
                >
                  <View style={styles.modalOptionLeft}>
                    <Text
                      style={[
                        styles.modalOptionText,
                        {
                          color: colors.textDark,
                          fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
                        },
                      ]}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        styles.tabBadge,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabBadgeText,
                          { color: isSelected ? colors.primary : colors.textGray },
                        ]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View
                      style={[
                        styles.optionCheckBadge,
                        {
                          backgroundColor: isDark
                            ? 'rgba(246, 36, 89, 0.14)'
                            : 'rgba(246, 36, 89, 0.08)',
                        },
                      ]}
                    >
                      <Check size={14} color={colors.primary} strokeWidth={2.6} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TrueNativeModal>

      {/* 7. SORT OPTION SELECTOR MODAL */}
      <TrueNativeModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        containerStyle={{ paddingHorizontal: Spacing.lg }}
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
            },
            Shadows.liftedUp,
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
            ]}
          >
            <View style={styles.modalHeaderLeft}>
              <View
                style={[
                  styles.modalIconBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  },
                ]}
              >
                <SlidersHorizontal size={16} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text
                style={[styles.modalTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
              >
                Sort Errands
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSortModal(false)}
              hitSlop={PortalTouchTargets.compactHitSlop}
              style={[
                styles.modalCloseBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close sort options"
            >
              <X size={16} color={colors.textMedium} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalOptionsList}>
            {sortTabs.map((tab) => {
              const isSelected = sortOption === tab.key;
              const Icon = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.key}
                  activeOpacity={0.7}
                  style={[
                    styles.modalOptionItem,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC')
                        : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF'),
                      borderColor: isSelected
                        ? (isDark ? 'rgba(255, 255, 255, 0.18)' : '#CBD5E1')
                        : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                    },
                  ]}
                  onPress={() => {
                    setSortOption(tab.key);
                    setShowSortModal(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${tab.label}, ${tab.description}`}
                >
                  <View style={styles.modalOptionLeft}>
                    <View
                      style={[
                        styles.optionIconBox,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(246, 36, 89, 0.14)' : 'rgba(246, 36, 89, 0.08)')
                            : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9'),
                        },
                      ]}
                    >
                      <Icon
                        size={16}
                        color={isSelected ? colors.primary : colors.textMedium}
                        strokeWidth={isSelected ? 2.4 : 2}
                      />
                    </View>
                    <View style={styles.optionTextCol}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          {
                            color: colors.textDark,
                            fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
                          },
                        ]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                      >
                        {tab.label}
                      </Text>
                      <Text
                        style={[
                          styles.modalOptionDesc,
                          { color: colors.textGray },
                        ]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                      >
                        {tab.description}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View
                      style={[
                        styles.optionCheckBadge,
                        {
                          backgroundColor: isDark
                            ? 'rgba(246, 36, 89, 0.14)'
                            : 'rgba(246, 36, 89, 0.08)',
                        },
                      ]}
                    >
                      <Check size={14} color={colors.primary} strokeWidth={2.6} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TrueNativeModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  fixedTopSection: {
    paddingHorizontal: Spacing.md,
  },
  headerContainer: {
    marginBottom: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeftCol: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  screenTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    letterSpacing: -0.3,
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 1.25),
    marginBottom: 2,
  },
  headerActionBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: PortalTouchTargets.compact / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // ── Section headers ───────────────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm + 2,
  },
  sectionHeaderRowFirst: {
    marginTop: Spacing.md,
  },
  sectionSortLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sectionHeaderLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
    letterSpacing: 0.2,
  },
  sectionHeaderRule: {
    flex: 1,
    height: 1,
    marginHorizontal: Spacing.sm + 2,
  },
  sectionHeaderCount: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    paddingHorizontal: 4,
  },
  sectionSortBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Goal-gradient rail ────────────────────────────────────────────────
  railWrap: {
    marginTop: 10,
    // 14 dp to the store name below (2026-10-14); it was 4, so "Step 2 of 5"
    // and its note sat on top of the title while the rest of the card had
    // 11 to 22 dp between its parts.
    marginBottom: Spacing.sm + 4,
  },
  railTrack: {
    flexDirection: 'row',
    gap: 3,
  },
  railSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  railLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    gap: 8,
  },
  railStageLabel: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },
  railStepCount: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  railSubLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    marginTop: 2,
  },

  // ── Reorder ───────────────────────────────────────────────────────────
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    minHeight: PortalTouchTargets.compact,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reorderBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },

  // ── Milestone ─────────────────────────────────────────────────────────
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  milestoneText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },

  screenSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginTop: 2,
  },
  liveHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  liveHeaderPillText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  searchSection: {
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.3),
    padding: 0,
  },
  clearBtn: {
    padding: Spacing.xs,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(8, 0.2),
    paddingHorizontal: Spacing.xs,
    minHeight: 36,
    borderRadius: BorderRadius.full,
  },
  filterTabText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.2),
  },
  filterTabTextActive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.2),
  },
  tabBadge: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
  },
  // HERO SECTION (HAPPENING NOW)
  heroCard: {
    paddingHorizontal: 0,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    marginBottom: Spacing.md,
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: Spacing.sm,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveTagLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    letterSpacing: 0.6,
  },
  humanStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 0,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  humanStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  heroBodyPressable: {
    paddingVertical: 2,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  serviceBadgeCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    letterSpacing: -0.2,
  },
  heroSubText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    marginTop: 1,
  },
  routeContainer: {
    paddingLeft: 2,
    marginVertical: Spacing.sm,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeIconNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    letterSpacing: 0.3,
  },
  routeText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
  },
  routeConnectorLine: {
    width: 2,
    height: 14,
    backgroundColor: '#E5E7EB',
    marginLeft: 10,
    marginVertical: 3,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs + 2,
  },
  heroPriceLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    letterSpacing: 0.4,
  },
  heroPriceText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.price),
    lineHeight: getPortalLineHeight(PortalFontSizes.price, 'heading'),
    letterSpacing: -0.3,
  },
  heroPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  microPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 0,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  microPillText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  trackCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm + 4,
  },
  trackCtaText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
  },
  // STANDARD ROW (PAST HISTORY / DELIVERED / CANCELLED)
  standardCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    paddingRight: Spacing.xs,
  },
  standardServiceIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    letterSpacing: -0.2,
  },
  cardSubText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    marginTop: 1,
  },
  standardStatusPill: {
    paddingHorizontal: 0,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  standardStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
    marginTop: 2,
  },
  addressLineText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginTop: 2,
  },
  footerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  standardPriceText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
  },
  footerSubText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  riderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewReceiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: PortalTouchTargets.compact,
    paddingVertical: 4,
  },
  viewReceiptText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },
  // EMPTY STATE
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl + 8,
    marginTop: Spacing.md,
  },
  emptyIconHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 280,
  },
  // UTILITY TOOLBAR (COMPACT FILTERS)
  utilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  utilityCountText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  utilityActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  utilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    minHeight: PortalTouchTargets.filterPillHeight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    maxWidth: 140,
  },
  utilityChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  // EMPTY STATE ACTIONS
  emptyActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    minHeight: PortalTouchTargets.compact,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  emptyResetBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },
  // POPUP SELECTOR MODALS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md + 2,
    paddingBottom: Spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm + 2,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm + 2,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionsList: {
    gap: 8,
    paddingTop: 2,
  },
  modalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.2,
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
    gap: 2,
  },
  modalOptionText: {
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
  },
  modalOptionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  optionCheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: Spacing.xl,
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.lg,
  },
  emptyBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
  },
});



