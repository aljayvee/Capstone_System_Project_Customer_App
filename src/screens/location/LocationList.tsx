import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { FontSizes, FontWeights, Spacing, BorderRadius, FontFamily, scaledFontSize, moderateScale } from '../../config/theme';
import SavedLocationCard from './SavedLocationCard';
import { SavedLocation } from './types';

export interface LocationListProps {
  locations: SavedLocation[];
  loading: boolean;
  canAddMore: boolean;
  maxLocations: number;
  onAddNew: () => void;
  onSetDefault: (location: SavedLocation) => void;
  onEdit: (location: SavedLocation) => void;
  onDelete: (location: SavedLocation) => void;
}

export default function LocationList({
  locations,
  loading,
  canAddMore,
  maxLocations,
  onAddNew,
  onSetDefault,
  onEdit,
  onDelete,
}: LocationListProps) {
  const { colors, isDark } = useThemeColor();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.headerTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>My Delivery Locations</Text>
      <Text style={[styles.subTitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>Manage the addresses riders deliver your Pabili errands to.</Text>

      <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}>
        <Text style={[styles.countText, { color: colors.primary }]} maxFontSizeMultiplier={1.15}>
          {locations.length} / {maxLocations} saved locations
        </Text>
      </View>

      {canAddMore ? (
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85} onPress={onAddNew}>
          <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.addBtnText} maxFontSizeMultiplier={1.15}>Add New Location</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.limitNotice, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : colors.warningBg }]}>
          <Text style={[styles.limitNoticeText, { color: colors.warning }]} maxFontSizeMultiplier={1.15}>
            Maximum of {maxLocations} locations reached. Delete one to add another.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loadingSpinner} />
      ) : locations.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textLight }]} maxFontSizeMultiplier={1.15}>No saved locations yet. Add your first delivery pin above.</Text>
      ) : (
        locations.map((loc) => (
          <SavedLocationCard key={loc.id} location={loc} onSetDefault={onSetDefault} onEdit={onEdit} onDelete={onDelete} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: scaledFontSize(FontSizes.lg, 0.2), marginBottom: Spacing.xs },
  subTitle: { fontFamily: FontFamily.regular, fontSize: scaledFontSize(FontSizes.xs, 0.2), marginBottom: Spacing.md },
  countBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  countText: { fontFamily: FontFamily.bold, fontSize: scaledFontSize(FontSizes.xs, 0.2) },
  addBtn: {
    flexDirection: 'row',
    paddingVertical: moderateScale(11, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    minHeight: moderateScale(48, 0.2),
  },
  addBtnText: { fontFamily: FontFamily.bold, color: '#FFFFFF', fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  limitNotice: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
  limitNoticeText: { fontFamily: FontFamily.semibold, fontSize: scaledFontSize(FontSizes.xs, 0.2), textAlign: 'center' },
  loadingSpinner: { marginTop: Spacing.xl },
  emptyText: { fontFamily: FontFamily.regular, fontSize: scaledFontSize(FontSizes.xs + 1, 0.2), textAlign: 'center', marginTop: Spacing.lg },
});
