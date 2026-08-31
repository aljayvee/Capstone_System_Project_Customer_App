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
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../../config/theme';
import ErrandDetailsModal from '../../components/ErrandDetailsModal';
import ErrandsSkeleton, { ErrandsCardsSkeleton } from '../../components/ErrandsSkeleton';
import { formatErrandId } from '../../utils/formatErrandId';
import { getErrandProgressStage } from '../../utils/errandProgress';

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
}

export default function ErrandsTab({
  user,
  navigation,
  errands,
  loading,
  onRefresh,
  onViewTrack,
}: ErrandsTabProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, isTablet, isCompact } = useResponsive();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('NEWEST');
  const [search, setSearch] = useState('');
  const [selectedErrand, setSelectedErrand] = useState<any | null>(null);
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

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All Errands', count: counts.all },
    { key: 'ACTIVE', label: 'Active', count: counts.active },
    { key: 'COMPLETED', label: 'Delivered', count: counts.completed },
    ...(counts.cancelled > 0
      ? [{ key: 'CANCELLED' as StatusFilter, label: 'Cancelled', count: counts.cancelled }]
      : []),
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
   * previous errand's category and stores into a fresh form rather than
   * submitting anything: the customer still confirms items, address and
   * payment, so nothing is ordered behind their back.
   */
  const handleReorder = (item: any) => {
    const storeNames = (item.pinpoints || [])
      .map((p: any) => p.storeName)
      .filter(Boolean);

    navigation.navigate('ErrandForm', {
      user,
      reorderFrom: {
        errandId: item.orderId || item.id,
        categories: item.categories || '',
        storeNames,
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
      const stores = item.pinpoints.map((p: any) => p.storeName).filter(Boolean);
      if (stores.length > 0) return `${stores.join(' & ')}`;
    }
    if (item.categories && item.categories.trim().length > 0) {
      return item.categories;
    }
    return 'Pabili Shopping Request';
  };

  const dateTabs: { key: DateFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Anytime', count: counts.dates.all },
    { key: 'DAY', label: 'Today', count: counts.dates.day },
    { key: 'WEEK', label: 'Past 7 Days', count: counts.dates.week },
    { key: 'MONTH', label: 'This Month', count: counts.dates.month },
    { key: 'YEAR', label: 'This Year', count: counts.dates.year },
  ];

  const sortTabs: { key: SortOption; label: string; icon: any }[] = [
    { key: 'NEWEST', label: 'Newest First', icon: ArrowDownWideNarrow },
    { key: 'OLDEST', label: 'Oldest First', icon: ArrowUpNarrowWide },
    { key: 'PRICE_HIGH', label: 'Highest Price', icon: BadgeDollarSign },
    { key: 'PRICE_LOW', label: 'Lowest Price', icon: Banknote },
  ];

  const activeDateLabel = dateTabs.find((d) => d.key === dateFilter)?.label || 'Anytime';
  const activeSortLabel = sortTabs.find((s) => s.key === sortOption)?.label || 'Newest First';
  const isFiltered = search.trim().length > 0 || filter !== 'ALL' || dateFilter !== 'ALL' || sortOption !== 'NEWEST';

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
    setFilter('ALL');
    setDateFilter('ALL');
    setSortOption('NEWEST');
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bgApp,
          paddingTop: insets.top > 0 ? insets.top + Spacing.sm : Spacing.md,
        },
      ]}
    >
      {/* 1. WELCOMING HUMAN SCREEN HEADER WITH MILESTONE ANCHOR */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLeftCol}>
            <Text style={[styles.screenTitle, { color: colors.textDark }]}>My Errands</Text>
            <Text style={[styles.screenSubtitle, { color: colors.textGray }]}>
              {counts.completed > 0
                ? `${counts.completed} fulfilled • Track active or view past receipts.`
                : 'Track ongoing errands or view past receipts.'}
            </Text>
            {milestone ? (
              <View
                style={[
                  styles.milestonePill,
                  { backgroundColor: isDark ? 'rgba(246,36,89,0.14)' : '#FFF1F5' },
                ]}
              >
                <Sparkles size={11} color={colors.primary} strokeWidth={2.4} />
                <Text style={[styles.milestoneText, { color: colors.primary }]}>{milestone}</Text>
              </View>
            ) : null}
          </View>

          {counts.active > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.liveHeaderPill,
                { backgroundColor: isDark ? 'rgba(246,36,89,0.18)' : '#FFE4EC' },
              ]}
              onPress={() => setFilter('ACTIVE')}
            >
              <View style={[styles.pulsingDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.liveHeaderPillText, { color: colors.primary }]}>
                {counts.active} Ongoing
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. CAPSULE SEARCH BAR */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? colors.border : '#EDEFF2',
            },
            Shadows.soft,
          ]}
        >
          <Search size={18} color={colors.primary} strokeWidth={2.2} />
          <TextInput
            style={[styles.searchInput, { color: colors.textDark }]}
            placeholder="Search stores, items, or errand #..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            testID="errands-search-input"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <X size={14} color={colors.textMedium} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. STREAMLINED PRIMARY STATUS CAPSULES */}
      <View style={styles.filterScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            const isPulsing = tab.key === 'ACTIVE' && tab.count > 0;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.85}
                style={[
                  styles.scrollChip,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : colors.card,
                    borderColor: isActive
                      ? colors.primary
                      : isDark
                      ? colors.border
                      : '#E5E7EB',
                  },
                  isActive ? Shadows.soft : null,
                ]}
                onPress={() => setFilter(tab.key)}
                testID={`filter-tab-${tab.key}`}
              >
                {isPulsing && (
                  <View
                    style={[
                      styles.tabDot,
                      { backgroundColor: isActive ? '#FFFFFF' : colors.primary },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.scrollChipText,
                    { color: isActive ? '#FFFFFF' : colors.textDark },
                    isActive && styles.scrollChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isActive
                        ? 'rgba(255,255,255,0.25)'
                        : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : '#F3F4F6',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      { color: isActive ? '#FFFFFF' : colors.textGray },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. COMPACT UTILITY TOOLBAR: ACTIVE COUNT + COMPACT DROPDOWN SELECTORS */}
      <View style={styles.utilityBar}>
        <Text style={[styles.utilityCountText, { color: colors.textLight }]}>
          Showing <Text style={{ fontFamily: FontFamily.bold, color: colors.textDark }}>{filteredErrands.length}</Text> {filteredErrands.length === 1 ? 'errand' : 'errands'}
        </Text>

        <View style={styles.utilityActionsRow}>
          {/* Date Picker Trigger Chip */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.utilityChip,
              {
                backgroundColor: dateFilter !== 'ALL'
                  ? (isDark ? 'rgba(246,36,89,0.15)' : '#FFF0F5')
                  : (isDark ? 'rgba(255,255,255,0.05)' : colors.card),
                borderColor: dateFilter !== 'ALL'
                  ? colors.primary
                  : (isDark ? colors.border : '#E5E7EB'),
              },
            ]}
            onPress={() => setShowDateModal(true)}
          >
            <Calendar size={12} color={dateFilter !== 'ALL' ? colors.primary : colors.textMedium} strokeWidth={2.2} />
            <Text
              style={[
                styles.utilityChipText,
                { color: dateFilter !== 'ALL' ? colors.primary : colors.textDark },
              ]}
              numberOfLines={1}
            >
              {activeDateLabel}
            </Text>
            <ChevronDown size={12} color={dateFilter !== 'ALL' ? colors.primary : colors.textMedium} />
          </TouchableOpacity>

          {/* Sort Picker Trigger Chip */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.utilityChip,
              {
                backgroundColor: sortOption !== 'NEWEST'
                  ? (isDark ? 'rgba(246,36,89,0.15)' : '#FFF0F5')
                  : (isDark ? 'rgba(255,255,255,0.05)' : colors.card),
                borderColor: sortOption !== 'NEWEST'
                  ? colors.primary
                  : (isDark ? colors.border : '#E5E7EB'),
              },
            ]}
            onPress={() => setShowSortModal(true)}
          >
            <ArrowDownWideNarrow size={12} color={sortOption !== 'NEWEST' ? colors.primary : colors.textMedium} strokeWidth={2.2} />
            <Text
              style={[
                styles.utilityChipText,
                { color: sortOption !== 'NEWEST' ? colors.primary : colors.textDark },
              ]}
              numberOfLines={1}
            >
              {activeSortLabel}
            </Text>
            <ChevronDown size={12} color={sortOption !== 'NEWEST' ? colors.primary : colors.textMedium} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. MAIN LIST / CARDS */}
      {loading && errands.length === 0 ? (
        <ErrandsCardsSkeleton />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isDark ? colors.border : '#EDEFF2',
                },
                Shadows.soft,
              ]}
            >
              <View
                style={[
                  styles.emptyIconHalo,
                  {
                    backgroundColor: isDark
                      ? 'rgba(246,36,89,0.12)'
                      : '#FFF0F5',
                  },
                ]}
              >
                <Package size={36} color={colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textDark }]}>
                {isFiltered ? 'No Matching Errands' : 'No Errands Found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textGray }]}>
                {search
                  ? `No errands matching "${search}". Try searching with another store or keyword.`
                  : isFiltered
                  ? 'No errands match your current date or status filters. Reset filters to see all your orders.'
                  : 'You haven’t requested any errands yet. Need food, groceries, or medicine bought in Tacurong?'}
              </Text>

              <View style={styles.emptyActionsContainer}>
                {isFiltered && (
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
                )}

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }, Shadows.soft]}
                  onPress={() => navigation.navigate('ServiceList', { user })}
                >
                  <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.emptyBtnText}>Request a New Errand</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item: row }) => {
            if (row.kind === 'section') {
              return (
                <View style={styles.sectionHeaderRow}>
                  {row.tone === 'live' ? (
                    <View style={[styles.sectionLiveDot, { backgroundColor: colors.primary }]} />
                  ) : null}
                  <Text
                    style={[
                      styles.sectionHeaderLabel,
                      { color: row.tone === 'live' ? colors.primary : colors.textGray },
                    ]}
                  >
                    {row.label}
                  </Text>
                  <View style={[styles.sectionHeaderRule, { backgroundColor: colors.border }]} />
                  <Text style={[styles.sectionHeaderCount, { color: colors.textLight }]}>
                    {row.count}
                  </Text>
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
                      backgroundColor: colors.card,
                      borderColor: isDark ? 'rgba(246,36,89,0.35)' : '#FFE4EC',
                    },
                    Shadows.liftedUp,
                  ]}
                  testID={`errand-card-${item.orderId || item.id}`}
                >
                  {/* Top Live Progress Header */}
                  <View style={styles.heroTopBar}>
                    <View style={styles.liveTagRow}>
                      <View style={styles.pulsingDot} />
                      <Text style={[styles.liveTagLabel, { color: isPendingOrAvailable ? '#D97706' : colors.primary }]}>
                        {isPendingOrAvailable ? 'REQUEST IN REVIEW' : 'DELIVERY IN PROGRESS'}
                      </Text>
                    </View>

                    {/* Humanized Friendly Status Pill */}
                    <View
                      style={[
                        styles.humanStatusPill,
                        { backgroundColor: isDark ? 'rgba(246,36,89,0.18)' : statusInfo.badgeBg },
                      ]}
                    >
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
                    onPress={() => setSelectedErrand(item)}
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
                          Order #{formatErrandId(item.orderId || item.id)} • {formattedDate}
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
                        <Text style={[styles.heroPriceLabel, { color: colors.textLight }]}>
                          {isPendingOrAvailable ? 'DELIVERY FARE' : 'TOTAL BILL'}
                        </Text>
                        {isPendingOrAvailable ? (
                          <Text style={{ fontSize: 12, color: '#D97706', fontFamily: FontFamily.semibold, marginTop: 2 }}>
                            Pending Completion
                          </Text>
                        ) : (
                          <Text style={[styles.heroPriceText, { color: colors.primary }]}>
                            ₱{fee}
                          </Text>
                        )}
                        {isPendingOrAvailable && (
                          <Text style={{ fontSize: 9, color: colors.textLight, fontStyle: 'italic', marginTop: 1 }}>
                            Applied upon rider delivery
                          </Text>
                        )}
                      </View>

                      <View style={styles.heroPillGroup}>
                        <View
                          style={[
                            styles.microPill,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : '#F3F4F6',
                            },
                          ]}
                        >
                          <Text style={[styles.microPillText, { color: colors.textDark }]}>
                            {isPendingOrAvailable
                              ? 'Payment: Pending'
                              : item.paymentMethod === 'ONLINE'
                              ? 'Paid Online'
                              : 'Cash on Delivery'}
                          </Text>
                        </View>

                        {riderFirstName && isAssignedOrInTransit && (
                          <View
                            style={[
                              styles.microPill,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(37,99,235,0.15)'
                                  : '#EBF5FF',
                              },
                            ]}
                          >
                            <User size={11} color="#2563EB" strokeWidth={2.2} />
                            <Text style={[styles.microPillText, { color: '#2563EB' }]}>
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
                activeOpacity={0.82}
                style={[
                  styles.standardCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDark ? colors.border : '#EDEFF2',
                  },
                  Shadows.soft,
                ]}
                onPress={() => setSelectedErrand(item)}
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
                          : `#${formatErrandId(item.orderId || item.id)} • ${formattedDate}`}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.standardStatusPill,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : statusInfo.badgeBg },
                    ]}
                  >
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
                        <Text style={[styles.standardPriceText, { color: colors.textLight, textDecorationLine: 'line-through' }]}>
                          ₱{fee}
                        </Text>
                        <Text style={{ color: '#DC2626', fontSize: 11, fontFamily: FontFamily.semibold }}>
                          Voided (₱0.00)
                        </Text>
                      </View>
                    ) : isPendingOrAvailable ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: '#D97706', fontSize: 11.5, fontFamily: FontFamily.semibold }}>
                          Fare: Pending Completion
                        </Text>
                        <View style={styles.dot} />
                        <Text style={[styles.footerSubText, { color: colors.textMedium }]}>
                          Awaiting Rider
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.standardPriceText, { color: colors.textDark }]}>
                          ₱{fee}
                        </Text>
                        <View style={styles.dot} />
                        <Text style={[styles.footerSubText, { color: colors.textMedium }]}>
                          {item.paymentMethod === 'ONLINE' ? 'Online' : 'Cash'}
                        </Text>
                        {riderFirstName && (
                          <>
                            <View style={styles.dot} />
                            <View style={styles.riderChip}>
                              <User size={11} color={colors.textGray} />
                              <Text style={[styles.footerSubText, { color: colors.textGray }]}>
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
                    <Text style={[styles.viewReceiptText, { color: isCancelled ? colors.textGray : colors.primary }]}>
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
                        backgroundColor: isDark ? 'rgba(246,36,89,0.12)' : '#FFF1F5',
                        borderColor: isDark ? 'rgba(246,36,89,0.28)' : '#FFD9E4',
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

      {/* 5. TRANSACTION DETAILS RECEIPT MODAL */}
      <ErrandDetailsModal
        visible={!!selectedErrand}
        errand={selectedErrand}
        user={user}
        navigation={navigation}
        onClose={() => setSelectedErrand(null)}
      />

      {/* 6. DATE RANGE SELECTOR MODAL */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowDateModal(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? colors.border : '#EDEFF2',
              },
              Shadows.liftedUp,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Calendar size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={[styles.modalTitle, { color: colors.textDark }]}>Filter by Date</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDateModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={colors.textMedium} />
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
                      isSelected && [
                        styles.modalOptionActive,
                        { backgroundColor: isDark ? 'rgba(246,36,89,0.12)' : '#FFF0F5' },
                      ],
                    ]}
                    onPress={() => {
                      setDateFilter(tab.key);
                      setShowDateModal(false);
                    }}
                  >
                    <View style={styles.modalOptionLeft}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          { color: isSelected ? colors.primary : colors.textDark },
                          isSelected && styles.modalOptionTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          styles.tabBadge,
                          {
                            backgroundColor: isSelected
                              ? (isDark ? 'rgba(246,36,89,0.2)' : '#FFE4EC')
                              : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabBadgeText,
                            { color: isSelected ? colors.primary : colors.textGray },
                          ]}
                        >
                          {tab.count}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <Check size={16} color={colors.primary} strokeWidth={2.6} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 7. SORT OPTION SELECTOR MODAL */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowSortModal(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? colors.border : '#EDEFF2',
              },
              Shadows.liftedUp,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <SlidersHorizontal size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={[styles.modalTitle, { color: colors.textDark }]}>Sort Errands</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSortModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={colors.textMedium} />
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
                      isSelected && [
                        styles.modalOptionActive,
                        { backgroundColor: isDark ? 'rgba(246,36,89,0.12)' : '#FFF0F5' },
                      ],
                    ]}
                    onPress={() => {
                      setSortOption(tab.key);
                      setShowSortModal(false);
                    }}
                  >
                    <View style={styles.modalOptionLeft}>
                      <Icon
                        size={16}
                        color={isSelected ? colors.primary : colors.textMedium}
                        strokeWidth={isSelected ? 2.4 : 2}
                      />
                      <Text
                        style={[
                          styles.modalOptionText,
                          { color: isSelected ? colors.primary : colors.textDark },
                          isSelected && styles.modalOptionTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </View>

                    {isSelected && (
                      <Check size={16} color={colors.primary} strokeWidth={2.6} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerContainer: {
    paddingHorizontal: Spacing.md,
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
  screenTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xl, 0.2),
    letterSpacing: -0.3,
    lineHeight: moderateScale(26, 0.2),
  },
  // ── Section headers ───────────────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    marginTop: Spacing.sm + 2,
    marginBottom: 7,
  },
  sectionLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionHeaderLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  sectionHeaderRule: {
    flex: 1,
    height: 1,
    opacity: 0.7,
  },
  sectionHeaderCount: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },

  // ── Goal-gradient rail ────────────────────────────────────────────────
  railWrap: {
    marginTop: 10,
    marginBottom: 2,
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
    fontSize: 12,
  },
  railStepCount: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
  },
  railSubLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10.5,
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
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reorderBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
  },

  // ── Milestone ─────────────────────────────────────────────────────────
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  milestoneText: {
    fontFamily: FontFamily.bold,
    fontSize: 10.5,
  },

  screenSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginTop: 2,
    lineHeight: moderateScale(16, 0.2),
  },
  liveHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  liveHeaderPillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F62459',
  },
  searchSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs + 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    minHeight: 42,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 1,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterScrollWrapper: {
    marginBottom: Spacing.md,
  },
  filterScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  scrollChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  scrollChipText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  scrollChipTextActive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(9.5, 0.2),
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
  },
  // HERO CARD (HAPPENING NOW)
  heroCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
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
    fontSize: scaledFontSize(9.5, 0.2),
    letterSpacing: 0.6,
  },
  humanStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  humanStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(10, 0.2),
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
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
    letterSpacing: -0.2,
  },
  heroSubText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
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
    fontSize: scaledFontSize(9, 0.2),
    letterSpacing: 0.3,
  },
  routeText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(11.5, 0.2),
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
    fontSize: scaledFontSize(9, 0.2),
    letterSpacing: 0.4,
  },
  heroPriceText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.md + 1, 0.2),
    letterSpacing: -0.3,
  },
  heroPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  microPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  microPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
  },
  trackCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm + 4,
  },
  trackCtaText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.xs + 1,
  },
  // STANDARD CARD (PAST HISTORY)
  standardCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
    fontSize: FontSizes.sm + 1,
    letterSpacing: -0.2,
  },
  cardSubText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    marginTop: 1,
  },
  standardStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  standardStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
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
    fontSize: 11.5,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
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
    fontSize: FontSizes.sm,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
  },
  footerSubText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
  riderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewReceiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewReceiptText: {
    fontFamily: FontFamily.bold,
    fontSize: 11.5,
  },
  // EMPTY STATE
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl + 8,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginTop: Spacing.sm,
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
    fontSize: FontSizes.md + 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 0.5,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 18,
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
    fontSize: 11.5,
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
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    maxWidth: 140,
  },
  utilityChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
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
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  emptyResetBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs + 1,
  },
  // POPUP SELECTOR MODALS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl + 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: Spacing.sm,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalOptionsList: {
    gap: 6,
    paddingTop: 4,
  },
  modalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  modalOptionActive: {
    borderRadius: BorderRadius.lg,
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalOptionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
  },
  modalOptionTextActive: {
    fontFamily: FontFamily.bold,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  emptyBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
  },
});



