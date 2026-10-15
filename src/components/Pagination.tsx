import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { colors, isDark } = useThemeColor();
  if (totalPages <= 1) return null;

  const btnBg = isDark ? 'rgba(246,36,89,0.18)' : colors.primaryLight;
  const btnDisabledBg = isDark ? 'rgba(255,255,255,0.06)' : colors.borderLight;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[
          styles.navBtn,
          { backgroundColor: btnBg },
          currentPage === 1 && { backgroundColor: btnDisabledBg },
        ]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <ChevronLeft size={18} color={currentPage === 1 ? colors.textLight : colors.primary} strokeWidth={2.4} />
      </TouchableOpacity>

      <Text style={[styles.pageText, { color: colors.textMedium }]}>
        Page {currentPage} of {totalPages}
      </Text>

      <TouchableOpacity
        style={[
          styles.navBtn,
          { backgroundColor: btnBg },
          currentPage === totalPages && { backgroundColor: btnDisabledBg },
        ]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <ChevronRight size={18} color={currentPage === totalPages ? colors.textLight : colors.primary} strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, marginTop: Spacing.md },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold },
});
