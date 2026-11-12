import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react-native';
import TrueNativeModal from './transitions/TrueNativeModal';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, FontFamily, Spacing, BorderRadius, Shadows } from '../config/theme';
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
    <TrueNativeModal visible={visible} onClose={onClose} containerStyle={{ padding: Spacing.lg }}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CalendarIcon size={20} color={colors.primary} />
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.headerTitle, { color: colors.textDark }]}>Select Birthdate</Text>
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
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.monthText, { color: colors.textDark }]}>
                {MONTH_NAMES[selectedMonth]}
              </Text>
              <TouchableOpacity
                onPress={() => setShowYearPicker((p) => !p)}
                style={[styles.yearPill, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}
              >
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.yearText, { color: colors.primary }]}>{selectedYear}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <ChevronRight size={20} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* YEAR PICKER OVERLAY */}
          {showYearPicker ? (
            <View style={[styles.yearPickerContainer, { backgroundColor: colors.card }]}>
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.yearPickerTitle, { color: colors.textMedium }]}>Choose Birth Year</Text>
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
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                        style={[[
                          styles.yearOptionText,
                          { color: selectedYear === y ? '#FFFFFF' : colors.textDark },
                        ], { color: colors.onPrimary }]}
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
                  <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} key={day} style={[styles.weekDayText, { color: colors.textLight }]}>
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
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                        style={[[
                          styles.dayText,
                          { color: isSelected ? '#FFFFFF' : colors.textDark },
                          isSelected && { fontFamily: FontFamily.bold },
                        ], { color: colors.onPrimary }]}
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
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.previewLabel, { color: colors.textGray }]}>Selected Date:</Text>
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.previewDate, { color: colors.primary }]}>
                {selectedYear}-{String(selectedMonth + 1).padStart(2, '0')}-{String(selectedDay).padStart(2, '0')}
              </Text>
            </View>

            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={onClose}
              >
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.cancelBtnText, { color: colors.textGray }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirm}
              >
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.confirmBtnText, { color: colors.onPrimary }]}>Set Birthdate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
    </TrueNativeModal>
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  yearPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  yearText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.xs,
  },
  weekDayText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    width: 38,
    textAlign: 'center',
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  yearPickerContainer: {
    height: 220,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
  },
  yearPickerTitle: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'),
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  previewDate: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  confirmBtn: {
    flex: 1.5,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
});
