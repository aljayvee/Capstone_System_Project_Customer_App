import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import ErrandChannelList from '../components/ErrandChannelList';
import ChatSearchFilterBar from '../components/ChatSearchFilterBar';
import Pagination from '../components/Pagination';
import { useActiveErrands } from '../hooks/useActiveErrands';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, Spacing, BorderRadius, FontFamily, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';

const PAGE_SIZE = 5;

export default function ActiveChatsScreen({ route, navigation }: RootStackScreenProps<'ActiveChats'>) {
  const { user } = route.params || ({} as any);
  const { errands, loading } = useActiveErrands(user?.id);
  const { colors, isDark } = useThemeColor();
  const { isTablet } = useResponsive();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredErrands = errands.filter((e) => {
    const matchesStatus = statusFilter === 'ALL' || String(e.status).toUpperCase() === statusFilter;
    if (!matchesStatus) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      String(e.id).toLowerCase().includes(query) ||
      String(e.category || '').toLowerCase().includes(query)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredErrands.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredErrands.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.responsiveWrapper}>
        {/* iOS-STYLE TOP NAV HEADER */}
        <View style={[styles.navHeaderRow, { borderBottomColor: colors.border, backgroundColor: colors.bgApp }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
            testID="back-button"
          >
            <ChevronLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>Active Errand Chats</Text>
          <View style={styles.navHeaderRightPlaceholder} />
        </View>

        <ScrollView
          style={[styles.container, { backgroundColor: colors.bgApp }]}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
            Select an active errand to live chat with your assigned dispatcher.
          </Text>

          <ChatSearchFilterBar
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
          />

          <ErrandChannelList
            errands={pageItems}
            loading={loading}
            onSelect={(errandId, status) =>
              navigation.navigate('CustomerChat', { user, errandId, initialStatus: status })
            }
            emptyText={
              errands.length === 0
                ? 'No active errand chats yet. Place an errand to start one.'
                : 'No chats match your search/filter.'
            }
          />

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={(next) => setPage(Math.min(Math.max(next, 1), totalPages))}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  responsiveWrapper: {
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
    paddingVertical: moderateScale(Spacing.sm + 2, 0.3),
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.md + 2, 0.35),
    textAlign: 'center',
  },
  navHeaderRightPlaceholder: {
    width: 36,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.sm, 0.3),
    marginBottom: Spacing.md,
  },
});
