import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../config/theme';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.navBtn, currentPage === 1 && styles.navBtnDisabled]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <ChevronLeft size={18} color={currentPage === 1 ? Colors.textLight : Colors.primary} strokeWidth={2.4} />
      </TouchableOpacity>

      <Text style={styles.pageText}>
        Page {currentPage} of {totalPages}
      </Text>

      <TouchableOpacity
        style={[styles.navBtn, currentPage === totalPages && styles.navBtnDisabled]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <ChevronRight size={18} color={currentPage === totalPages ? Colors.textLight : Colors.primary} strokeWidth={2.4} />
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
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { backgroundColor: Colors.borderLight },
  pageText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.textMedium },
});
