import React, { useState, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search, X, HelpCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../../config/theme';
import ErrandChannelList from '../../components/ErrandChannelList';
import CustomerHelpModal from '../../components/CustomerHelpModal';
import { useActiveErrands } from '../../hooks/useActiveErrands';
import { formatErrandId } from '../../utils/formatErrandId';

export const CHAT_STATUS_FILTERS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'] as const;

export interface ChatTabProps {
  user: any;
  navigation: any;
}

export default function ChatTab({ user, navigation }: ChatTabProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, isTablet, isCompact } = useResponsive();
  const { errands, loading, error, refresh } = useActiveErrands(user?.id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Compute live filter counts
  const counts = useMemo(() => {
    const pending = errands.filter((e) => e.status === 'PENDING').length;
    const assigned = errands.filter((e) => e.status === 'ASSIGNED').length;
    const inTransit = errands.filter((e) => e.status === 'IN_TRANSIT').length;
    return {
      all: errands.length,
      pending,
      assigned,
      inTransit,
    };
  }, [errands]);

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
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'PENDING', label: 'Pending', count: counts.pending },
    { key: 'ASSIGNED', label: 'Assigned', count: counts.assigned },
    { key: 'IN_TRANSIT', label: 'In Transit', count: counts.inTransit },
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
              <Text style={[styles.screenTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
                Messages & Support
              </Text>
              <Text style={[styles.screenSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                Chat live with dispatchers or tap (?) for customer assistance and FAQs.
              </Text>
            </View>

            {/* Quick Help Guide Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.headerHelpBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray },
              ]}
              onPress={() => setIsHelpModalOpen(true)}
              testID="chat-help-guide-btn"
              accessibilityLabel="Get Help, Customer Guide & FAQ"
            >
              <HelpCircle size={20} color={colors.textGray} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Capsule Search Bar */}
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
              placeholder="Search by errand # or item..."
              placeholderTextColor={colors.textLight}
              value={search}
              onChangeText={setSearch}
              testID="chat-search-input"
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

        {/* Dynamic Status Filter Capsules */}
        <View style={styles.filterBar}>
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            const isPulsing = tab.key === 'IN_TRANSIT' && tab.count > 0;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.85}
                style={[
                  styles.filterTab,
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
                onPress={() => setStatusFilter(tab.key)}
                testID={`chat-filter-${tab.key}`}
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
                    styles.filterTabText,
                    { color: isActive ? '#FFFFFF' : colors.textDark },
                    isActive && styles.filterTabTextActive,
                  ]}
                  maxFontSizeMultiplier={1.15}
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
                    maxFontSizeMultiplier={1.15}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. ONLY THIS SCROLLS: ITEMIZED CHAT CARDS LIST */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
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
          onNewErrandPress={() => navigation.navigate('ServiceList', { user })}
          onSelect={(errandId, status) =>
            navigation.navigate('CustomerChat', { user, errandId, initialStatus: status })
          }
          emptyText={
            search
              ? `No active chats matching "${search}".`
              : errands.length === 0
              ? 'Chats are automatically created when you place an errand so you can coordinate directly with your assigned dispatcher.'
              : 'No chats match this status filter.'
          }
        />
      </ScrollView>

      {/* 3. CUSTOMER HELP MODAL */}
      <CustomerHelpModal
        visible={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
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
    marginBottom: 2,
  },
  screenSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: moderateScale(16, 0.2),
  },
  headerHelpBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(8, 0.2),
    minHeight: moderateScale(40, 0.2),
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    padding: 0,
  },
  clearBtn: {
    padding: 2,
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
    gap: 4,
    paddingVertical: moderateScale(7, 0.2),
    paddingHorizontal: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  filterTabText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(11, 0.2),
  },
  filterTabTextActive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(11, 0.2),
  },
  tabBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(9, 0.2),
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
  },
});
