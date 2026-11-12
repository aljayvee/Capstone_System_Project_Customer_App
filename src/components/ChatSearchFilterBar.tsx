import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, BorderRadius, FontFamily, Spacing } from '../config/theme';

// Only statuses useActiveErrands can actually return (COMPLETED is excluded
// there — a settled errand has nothing left to chat about).
export const CHAT_STATUS_FILTERS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const;

export interface ChatSearchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export default function ChatSearchFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: ChatSearchFilterBarProps) {
  const { colors, isDark } = useThemeColor();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchRow,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray },
        ]}
      >
        <Search size={16} color={colors.textGray} />
        <TextInput
          maxFontSizeMultiplier={PortalFontSizeMultipliers.input}
          style={[styles.searchInput, { color: colors.textDark }]}
          placeholder="Search by errand ID or category..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={onSearchChange}
          testID="chat-search-input"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CHAT_STATUS_FILTERS.map((status) => {
          const isActive = statusFilter === status;
          return (
            <TouchableOpacity
              key={status}
              activeOpacity={0.8}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => onStatusFilterChange(status)}
              testID={`chat-filter-${status}`}
            >
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : colors.textMedium }]}>
                {status === 'ALL' ? 'All' : status}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md, gap: Spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.regular,
  },
  filterRow: { gap: Spacing.xs },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  filterChipText: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'), fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
});
