import { usePageLayout } from '../../hooks/usePageLayout';
import React, { useCallback, useState, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/useThemeColor';
import { searchFieldStyles, getSearchFieldSurface } from '../../config/searchField';
import {
  Spacing,
  FontFamily,
  useResponsive,
  MAX_CONTENT_WIDTH,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
import ErrandChannelList from '../../components/ErrandChannelList';
import { useActiveErrands } from '../../hooks/useActiveErrands';
import { formatErrandId } from '../../utils/formatErrandId';

export const CHAT_STATUS_FILTERS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'] as const;

export interface ChatTabProps {
  user: any;
  navigation: any;
  onScroll?: (event: any) => void;
}

export default function ChatTab({ user, navigation, onScroll }: ChatTabProps) {
  const pageLayout = usePageLayout({ tabletGutter: 24 });
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const brandColor = isDark ? colors.primary : colors.primaryStrong;
  const { isCompact } = useResponsive();
  const { errands, loading, error, refresh } = useActiveErrands(user?.id);
  // The spinner follows the customer's own pull only. The list refreshes
  // quietly on each visit (it is cached, 2026-10-14); showing the spinner for
  // that would make every return look like the reload this removed.
  const [pulling, setPulling] = useState(false);
  const pullToRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredErrands = useMemo(() => {
    return errands.filter((e) => {
      const matchesStatus =
        statusFilter === 'ALL' || String(e.status).toUpperCase() === statusFilter;
      if (!matchesStatus) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const rawId = String(e.id || '').toLowerCase();
      const formatted = formatErrandId(e.id, e.referenceNo).toLowerCase();
      const category = String(e.category || '').toLowerCase();
      const stores = (e.pinpoints || []).map((pin) => String(pin.storeName || '')).join(' ').toLowerCase();

      return rawId.includes(q) || formatted.includes(q) || category.includes(q) || stores.includes(q);
    });
  }, [errands, statusFilter, search]);

  const filterTabs = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Waiting' },
    { key: 'ASSIGNED', label: 'Assigned' },
    { key: 'IN_TRANSIT', label: 'On the way' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          paddingTop: insets.top > 0 ? insets.top + Spacing.xs : Spacing.md,
        }, pageLayout.frameStyle]}
    >
      {/* 1. FIXED TOP HEADER & CONTROLS (NON-SCROLLING) */}
      <View style={[styles.fixedTopSection, { paddingHorizontal: isCompact ? Spacing.lg : Spacing.xl }, pageLayout.gutterStyle]}>
        {/* Header Row (No Left Icon) */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerLeftCol}>
              <Text style={[styles.screenTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                Messages & Support
              </Text>
              <Text style={[styles.screenSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                Coordinate your errands with your dispatcher.
              </Text>
            </View>
          </View>
        </View>

        {/* Search remains visible while conversations scroll. */}
        <View style={styles.searchSection}>
          <View
            style={[
              searchFieldStyles.surface,
              getSearchFieldSurface(isDark),
            ]}
            testID="chat-search-bar"
          >
            <Search size={16} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={2.2} />
            <TextInput
              style={[searchFieldStyles.input, { color: colors.textDark }]}
              placeholder="Search conversations"
              placeholderTextColor={colors.textLight}
              value={search}
              onChangeText={setSearch}
              testID="chat-search-input"
              accessibilityLabel="Search conversations"
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={PortalTouchTargets.compactHitSlop}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <X size={16} color={colors.textGray} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Underlined tabs match My Errands. */}
        <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                style={[
                  styles.filterTab,
                  {
                    borderBottomColor: isActive ? brandColor : 'transparent',
                  },
                ]}
                onPress={() => setStatusFilter(tab.key)}
                testID={`chat-filter-${tab.key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { color: isActive ? brandColor : colors.textGray },
                    isActive && styles.filterTabTextActive,
                  ]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. ONLY THIS SCROLLS: ITEMIZED CHAT CARDS LIST */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isCompact ? Spacing.lg : Spacing.xl, paddingBottom: 80 + Math.max(insets.bottom, 16) + Spacing.md }, pageLayout.gutterStyle]}
        // The search field above stays put while the keyboard covers the bottom
        // of this list: a drag puts it away so every row can be reached, and a
        // tap on a row works first time instead of only closing the keyboard.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={pullToRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <ErrandChannelList
          errands={filteredErrands}
          loading={loading}
          error={error}
          onRefresh={refresh}
          emptyTitle={errands.length > 0 && filteredErrands.length === 0 ? 'No matching conversations' : undefined}
          onSelect={(errandId, status) =>
            navigation.navigate('CustomerChat', { user, errandId, initialStatus: status })
          }
          emptyText={
            search
              ? `No conversations matching "${search}". Try another keyword.`
              : errands.length === 0
              ? 'Your conversation with the dispatcher will appear here when you place an errand.'
              : 'No conversations for this status. Try another filter.'
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  fixedTopSection: {
    paddingHorizontal: Spacing.md,
  },
  headerContainer: {
    marginBottom: Spacing.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: PortalTouchTargets.compact,
  },
  headerLeftCol: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  screenTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    letterSpacing: -0.3,
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 1.25),
    marginBottom: 2,
  },
  screenSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
  },
  headerHelpBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: PortalTouchTargets.compact / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    marginBottom: Spacing.sm,
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
    marginTop: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
  },
  filterTabText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },
  filterTabTextActive: {
    fontFamily: FontFamily.semibold,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
  },
});
