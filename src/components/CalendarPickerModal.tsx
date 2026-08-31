import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react-native';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';

interface CalendarPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (formattedDate: string) => void;
  initialDate?: string; // YYYY-MM-DD
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarPickerModal({
  visible,
  onClose,
  onSelectDate,
  initialDate,
}: CalendarPickerModalProps) {
  const { colors, isDark } = useThemeColor();

  const parseInitial = () => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const [y, m, d] = initialDate.split('-').map(Number);
      return { year: y, month: m - 1, day: d };
    }
    const today = new Date();
    // Default to 18 years ago for convenience
    return { year: today.getFullYear() - 18, month: today.getMonth(), day: today.getDate() };
  };

  const initial = parseInitial();
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const daysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleConfirm = () => {
    const formattedMonth = String(selectedMonth + 1).padStart(2, '0');
    const formattedDay = String(selectedDay).padStart(2, '0');
    onSelectDate(`${selectedYear}-${formattedMonth}-${formattedDay}`);
    onClose();
  };

  // Generate years list (1930 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1930 + 1 }, (_, i) => currentYear - i);

  const totalDays = daysInMonth(selectedYear, selectedMonth);
  const startingDay = firstDayOfMonth(selectedYear, selectedMonth);

  // Generate grid slots
  const slots: (number | null)[] = [];
  for (let i = 0; i < startingDay; i++) {
    slots.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    slots.push(d);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CalendarIcon size={20} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.textDark }]}>Select Birthdate</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={colors.textGray} />
            </TouchableOpacity>
          </View>

          {/* MONTH & YEAR CONTROLS */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
              <ChevronLeft size={20} color={colors.textDark} />
            </TouchableOpacity>

            <View style={styles.monthYearSelector}>
              <Text style={[styles.monthText, { color: colors.textDark }]}>
                {MONTH_NAMES[selectedMonth]}
              </Text>
              <TouchableOpacity
                onPress={() => setShowYearPicker((p) => !p)}
                style={[styles.yearPill, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}
              >
                <Text style={[styles.yearText, { color: colors.primary }]}>{selectedYear}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <ChevronRight size={20} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* YEAR PICKER OVERLAY */}
          {showYearPicker ? (
            <View style={[styles.yearPickerContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.yearPickerTitle, { color: colors.textMedium }]}>Choose Birth Year</Text>
              <ScrollView style={styles.yearScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.yearGrid}>
                  {years.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearOption,
                        selectedYear === y && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => {
                        setSelectedYear(y);
                        setShowYearPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.yearOptionText,
                          { color: selectedYear === y ? '#FFFFFF' : colors.textDark },
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : (
            <>
              {/* DAYS OF WEEK */}
              <View style={styles.weekHeader}>
                {DAYS_OF_WEEK.map((day) => (
                  <Text key={day} style={[styles.weekDayText, { color: colors.textLight }]}>
                    {day}
                  </Text>
                ))}
              </View>

              {/* CALENDAR DAYS GRID */}
              <View style={styles.calendarGrid}>
                {slots.map((dayNum, index) => {
                  if (dayNum === null) {
                    return <View key={`empty-${index}`} style={styles.daySlot} />;
                  }
                  const isSelected = dayNum === selectedDay;
                  return (
                    <TouchableOpacity
                      key={`day-${dayNum}`}
                      style={[
                        styles.daySlot,
                        isSelected && [styles.selectedDaySlot, { backgroundColor: colors.primary }],
                      ]}
                      onPress={() => setSelectedDay(dayNum)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: isSelected ? '#FFFFFF' : colors.textDark },
                          isSelected && { fontFamily: FontFamily.bold },
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* PREVIEW & ACTIONS */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.selectedPreview}>
              <Text style={[styles.previewLabel, { color: colors.textGray }]}>Selected Date:</Text>
              <Text style={[styles.previewDate, { color: colors.primary }]}>
                {selectedYear}-{String(selectedMonth + 1).padStart(2, '0')}-{String(selectedDay).padStart(2, '0')}
              </Text>
            </View>

            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textGray }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmBtnText}>Set Birthdate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md + 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  navBtn: {
    padding: Spacing.xs,
  },
  monthYearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  monthText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  yearPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  yearText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.xs,
  },
  weekDayText: {
    width: 38,
    textAlign: 'center',
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  daySlot: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 19,
  },
  selectedDaySlot: {
    borderRadius: 19,
  },
  dayText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
  },
  yearPickerContainer: {
    height: 220,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
  },
  yearPickerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  yearScroll: {
    flex: 1,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  yearOption: {
    width: '30%',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  yearOptionText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  footer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  selectedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  previewLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs + 1,
  },
  previewDate: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm + 1,
    letterSpacing: 0.5,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  confirmBtn: {
    flex: 1.5,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
});
