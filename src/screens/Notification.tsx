import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bell,
  Calendar,
  CheckCheck,
  ChevronLeft,
  Bike,
  Package,
  MessageSquare,
  Search,
  X,
  Sparkles,
  Clock,
  CheckCircle2,
  Info,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  FontFamily,
  FontSizes,
  Spacing,
  BorderRadius,
  Shadows,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import { useNotifications, type CustomerNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { RootStackScreenProps } from '../navigation/types';

export type { CustomerNotification };

export type DateFilter = 'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

function formatNotificationTime(iso: string): { relative: string; dateFormatted: string } {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let relative = 'just now';
  if (minutes >= 1 && minutes < 60) relative = `${minutes}m ago`;
  else if (hours >= 1 && hours < 24) relative = `${hours}h ago`;
  else if (days === 1) relative = 'Yesterday';
  else if (days > 1 && days < 7) relative = `${days}d ago`;
  else if (days >= 7) {
    relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const dateFormatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  });

  return { relative, dateFormatted };
}

function matchesDateFilter(iso: string, filter: DateFilter): boolean {
  const itemDate = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - itemDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (filter) {
    case 'DAY':
      // Within the same calendar day or last 24 hours
      return (
        diffDays <= 1 ||
        (itemDate.getDate() === now.getDate() &&
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear())
      );
    case 'WEEK':
      // Within last 7 days
      return diffDays <= 7;
    case 'MONTH':
      // Within last 30 days or current calendar month
      return (
        diffDays <= 30 ||
        (itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear())
      );
    case 'YEAR':
      // Within current calendar year
      return itemDate.getFullYear() === now.getFullYear();
    case 'ALL':
    default:
      return true;
  }
}

function getNotificationVisuals(type: string) {
  const t = String(type || '').toUpperCase();
  if (t === 'RIDER_NEARBY' || t.includes('NEARBY') || t.includes('PROXIMITY')) {
    return { icon: Bike, iconColor: '#0284C7', haloBg: '#E0F2FE' };
  }
  if (t.includes('RIDER') || t.includes('DISPATCH') || t.includes('ASSIGN')) {
    return { icon: Bike, iconColor: '#3B82F6', haloBg: '#EFF6FF' };
  }
  if (t.includes('FEE') || t.includes('PRICE') || t.includes('PAYMENT')) {
    return { icon: Sparkles, iconColor: '#F59E0B', haloBg: '#FEF3C7' };
  }
  if (t.includes('CHAT') || t.includes('MESSAGE')) {
    return { icon: MessageSquare, iconColor: '#10B981', haloBg: '#ECFDF5' };
  }
  if (t.includes('COMPLETE') || t.includes('DELIVER')) {
    return { icon: CheckCircle2, iconColor: '#059669', haloBg: '#D1FAE5' };
  }
  return { icon: Bell, iconColor: '#F62459', haloBg: '#FFF0F5' };
}

export default function NotificationScreen({
  navigation,
  route,
}: RootStackScreenProps<'Notification'>) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications();
  const { user: authUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshNotifications(true);
    } finally {
      setRefreshing(false);
    }
  }, [refreshNotifications]);

  const handleNotificationPress = async (item: CustomerNotification) => {
    if (!item.isRead) {
      await markAsRead(item.id);
    }

    const t = String(item.type || '').toUpperCase();
    const effectiveUser = (route.params?.user || authUser) as any;

    if (!effectiveUser) return;

    if (t.includes('CHAT') || t.includes('MESSAGE')) {
      if (item.errandId) {
        navigation.navigate('CustomerChat', {
          user: effectiveUser,
          errandId: item.errandId,
        });
      }
      return;
    }

    if (t === 'RIDER_NEARBY' || t.includes('NEARBY') || t.includes('PROXIMITY')) {
      navigation.navigate('CustomerPortal', {
        user: effectiveUser,
        initialTab: 'track',
        focusedErrandId: item.errandId,
      });
      return;
    }

    if (t.includes('COMPLETE') || t.includes('DELIVER')) {
      if (item.errandId) {
        navigation.navigate('ErrandDetails', {
          user: effectiveUser,
          errandId: item.errandId,
        });
      }
      return;
    }

    // Default: If notification has an errandId, open track view for that errand
    if (item.errandId) {
      navigation.navigate('CustomerPortal', {
        user: effectiveUser,
        initialTab: 'track',
        focusedErrandId: item.errandId,
      });
    }
  };

  // Compute live filter counts
  const filterCounts = useMemo(() => {
    return {
      ALL: notifications.length,
      DAY: notifications.filter((n) => matchesDateFilter(n.createdAt, 'DAY')).length,
      WEEK: notifications.filter((n) => matchesDateFilter(n.createdAt, 'WEEK')).length,
      MONTH: notifications.filter((n) => matchesDateFilter(n.createdAt, 'MONTH')).length,
      YEAR: notifications.filter((n) => matchesDateFilter(n.createdAt, 'YEAR')).length,
    };
  }, [notifications]);

  // Filtered and searched list
  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((n) => {
        // Date Filter
        if (!matchesDateFilter(n.createdAt, dateFilter)) return false;

        // Search Filter
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const title = String(n.title || '').toLowerCase();
        const body = String(n.body || '').toLowerCase();
        const type = String(n.type || '').toLowerCase();

        return title.includes(q) || body.includes(q) || type.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [notifications, dateFilter, search]);

  const dateFilterTabs: { key: DateFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: filterCounts.ALL },
    { key: 'DAY', label: 'Today', count: filterCounts.DAY },
    { key: 'WEEK', label: 'This Week', count: filterCounts.WEEK },
    { key: 'MONTH', label: 'This Month', count: filterCounts.MONTH },
    { key: 'YEAR', label: 'This Year', count: filterCounts.YEAR },
  ];

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
      {/* 1. TOP NAV BAR */}
      <View style={styles.navHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text
            style={[styles.navTitle, { color: colors.textDark }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
          >
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadgePill, { backgroundColor: colors.primary }]}>
              <Text
                style={styles.unreadBadgeText}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
              >
                {unreadCount}
              </Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={markAllAsRead}
            hitSlop={PortalTouchTargets.compactHitSlop}
            style={styles.headerRightAction}
            testID="mark-all-read-btn"
          >
            <Text
              style={[styles.headerActionText, { color: colors.primary }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            >
              Read All
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navHeaderRightPlaceholder} />
        )}
      </View>

      {/* 2. CAPSULE SEARCH SECTION */}
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
          <Search size={16} color={colors.primary} strokeWidth={2.2} />
          <TextInput
            style={[styles.searchInput, { color: colors.textDark }]}
            placeholder="Search notifications..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            testID="notification-search-input"
            maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={PortalTouchTargets.compactHitSlop}
              style={styles.clearBtn}
            >
              <X size={14} color={colors.textMedium} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. DATE FILTER TABS (DAY, WEEK, MONTH, YEAR) */}
      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={dateFilterTabs}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: tab }) => {
            const isActive = dateFilter === tab.key;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                hitSlop={PortalTouchTargets.compactHitSlop}
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
                onPress={() => setDateFilter(tab.key)}
                testID={`date-filter-${tab.key}`}
              >
                <Calendar
                  size={12}
                  color={isActive ? '#FFFFFF' : colors.textMedium}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.filterTabText,
                    { color: isActive ? '#FFFFFF' : colors.textDark },
                    isActive && styles.filterTabTextActive,
                  ]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
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
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 4. NOTIFICATIONS LIST */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textGray }]}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => String(item.id)}
          // The search field above stays put while the keyboard covers the bottom
          // of this list: a drag puts it away so every row can be reached, and a
          // tap on a row works first time instead of only closing the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View
              style={[
                styles.separator,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' },
              ]}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View
              style={[
                styles.emptyContainer,
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
                <Bell size={40} color={colors.primary} strokeWidth={1.8} />
              </View>
              <Text
                style={[styles.emptyTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
              >
                No Notifications Found
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.textGray }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                {search
                  ? `No alerts matching "${search}". Try searching with another keyword.`
                  : dateFilter === 'DAY'
                  ? 'No notifications received today. You are all caught up!'
                  : dateFilter === 'WEEK'
                  ? 'No notifications received in the past 7 days.'
                  : dateFilter === 'MONTH'
                  ? 'No notifications received this month.'
                  : dateFilter === 'YEAR'
                  ? 'No notifications received this year.'
                  : 'You have no notifications yet. Whenever an errand progresses or a dispatcher messages you, alerts will show here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const visual = getNotificationVisuals(item.type);
            const VisualIcon = visual.icon;
            const timeInfo = formatNotificationTime(item.createdAt);

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.notificationRow}
                onPress={() => handleNotificationPress(item)}
                testID={`notification-card-${item.id}`}
              >
                <View style={styles.cardMainRow}>
                  {/* Icon Halo */}
                  <View
                    style={[
                      styles.iconHalo,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : visual.haloBg,
                      },
                    ]}
                  >
                    <VisualIcon
                      size={18}
                      color={visual.iconColor}
                      strokeWidth={2.2}
                    />
                  </View>

                  {/* Body Content */}
                  <View style={styles.cardContentCol}>
                    <View style={styles.cardHeaderRow}>
                      <Text
                        style={[
                          styles.cardTitle,
                          { color: colors.textDark },
                          !item.isRead && styles.cardTitleUnread,
                        ]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                      >
                        {item.title}
                      </Text>
                      {!item.isRead && (
                        <View
                          style={[
                            styles.unreadDot,
                            { backgroundColor: colors.primary },
                          ]}
                        />
                      )}
                    </View>

                    <Text
                      style={[styles.cardBodyText, { color: colors.textGray }]}
                      numberOfLines={3}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                    >
                      {item.body}
                    </Text>

                    <View style={styles.cardFooterRow}>
                      <View style={styles.timeTag}>
                        <Clock size={11} color={colors.textLight} />
                        <Text
                          style={[styles.timeText, { color: colors.textLight }]}
                          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                        >
                          {timeInfo.relative} • {timeInfo.dateFormatted}
                        </Text>
                      </View>

                      {!item.isRead && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => markAsRead(item.id)}
                          hitSlop={PortalTouchTargets.compactHitSlop}
                          style={styles.markReadAction}
                        >
                          <CheckCheck size={13} color={colors.primary} strokeWidth={2.2} />
                          <Text
                            style={[styles.markReadText, { color: colors.primary }]}
                            maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                          >
                            Mark read
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  // The top three (header, search, filters) were 8 and 10 dp apart; 12 each
  // now (2026-10-14). Filters to list was already 14 plus the row's own 14.
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm + 4,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
  navHeaderRightPlaceholder: {
    width: PortalTouchTargets.compact,
  },
  headerRightAction: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    minHeight: PortalTouchTargets.compact,
    justifyContent: 'center',
  },
  headerActionText: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.caption,
  },
  unreadBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  unreadBadgeText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: PortalFontSizes.micro,
  },
  searchSection: {
    marginBottom: Spacing.xs + 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.body,
    padding: 0,
  },
  clearBtn: {
    padding: 2,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  filterList: {
    gap: 6,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: PortalTouchTargets.pillHeight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterTabText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
  },
  filterTabTextActive: {
    fontFamily: FontFamily.bold,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  tabBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
  },
  listContent: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl * 3,
  },
  notificationRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  notificationCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  separator: {
    height: 1,
    width: '100%',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm + 2,
  },
  iconHalo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContentCol: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
    flex: 1,
    letterSpacing: -0.2,
  },
  cardTitleUnread: {
    fontFamily: FontFamily.bold,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: 6,
  },
  cardBodyText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginBottom: 6,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
  },
  markReadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markReadText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  emptyIconHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.title,
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    textAlign: 'center',
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
});
