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
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, isTablet, isCompact } = useResponsive();
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
      const formatted = formatErrandId(e.id).toLowerCase();
      const category = String(e.category || '').toLowerCase();

      return rawId.includes(q) || formatted.includes(q) || category.includes(q);
    });
  }, [errands, statusFilter, search]);

  const filterTabs = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'ASSIGNED', label: 'Assigned' },
    { key: 'IN_TRANSIT', label: 'In Transit' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgApp,
          paddingTop: insets.top > 0 ? insets.top + Spacing.xs : Spacing.md,
        },
      ]}
    >
      {/* 1. FIXED TOP HEADER & CONTROLS (NON-SCROLLING) */}
      <View style={styles.fixedTopSection}>
        {/* Header Row (No Left Icon) */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerLeftCol}>
              <Text style={[styles.screenTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                Messages & Support
              </Text>
            </View>
          </View>
        </View>

        {/* Apple Liquid Glass Search Bar */}
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
            testID="chat-search-bar"
          >
            <Search size={18} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={2.4} />
            <TextInput
              style={[styles.searchInput, { color: colors.textDark }]}
              placeholder="Search by errand # or item..."
              placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
              value={search}
              onChangeText={setSearch}
              testID="chat-search-input"
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

        {/* Dynamic Status Filter Capsules - Flat Minimalist */}
        <View style={styles.filterBar}>
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
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
                onPress={() => setStatusFilter(tab.key)}
                testID={`chat-filter-${tab.key}`}
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

      {/* 2. ONLY THIS SCROLLS: ITEMIZED CHAT CARDS LIST */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + Math.max(insets.bottom, 16) + Spacing.md }]}
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
          onSelect={(errandId, status) =>
            navigation.navigate('CustomerChat', { user, errandId, initialStatus: status })
          }
          emptyText={
            search
              ? `No active chats matching "${search}".`
              : errands.length === 0
              ? 'Chats are automatically created when you place an errand so you can coordinate directly with your assigned dispatcher.'
              : undefined
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
    marginBottom: Spacing.sm,
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
  },
});
