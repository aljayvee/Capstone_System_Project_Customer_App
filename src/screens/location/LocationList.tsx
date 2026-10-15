import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus, RotateCw } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontSizes,
  FontWeights,
  Spacing,
  BorderRadius,
  FontFamily,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
import SavedLocationCard from './SavedLocationCard';
import { SavedLocation } from './types';

export interface LocationListProps {
  locations: SavedLocation[];
  loading: boolean;
  /** Nothing could be loaded and nothing is cached: say so, with Try again. */
  loadFailed?: boolean;
  onRetry?: () => void;
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
  loadFailed = false,
  onRetry,
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
      <Text style={[styles.headerTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
        My Delivery Locations
      </Text>
      <Text style={[styles.subTitle, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
        Manage the addresses riders deliver your Pabili errands to. Tap a card to make it default.
      </Text>

      <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}>
        <Text style={[styles.countText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
          {locations.length} / {maxLocations} saved locations
        </Text>
      </View>

      {canAddMore ? (
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={onAddNew}
          hitSlop={PortalTouchTargets.compactHitSlop}
        >
          <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.addBtnText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
            Add New Location
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.limitNotice, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : colors.warningBg }]}>
          <Text style={[styles.limitNoticeText, { color: colors.warning }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            Maximum of {maxLocations} locations reached. Delete one to add another.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loadingSpinner} />
      ) : loadFailed ? (
        // Not the empty state: "No saved locations yet" for a failed load sent
        // customers to add a place they already had.
        <View style={[styles.errorPanel, { borderColor: colors.border }]} testID="saved-locations-error">
          <Text style={[styles.errorText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            Your saved locations didn't load. Check your connection, then try again.
          </Text>
          {onRetry ? (
            <TouchableOpacity
              style={[styles.retryBtn, { borderColor: colors.primary }]}
              onPress={onRetry}
              hitSlop={PortalTouchTargets.compactHitSlop}
              accessibilityRole="button"
              testID="saved-locations-retry"
            >
              <RotateCw size={14} color={colors.primary} />
              <Text style={[styles.retryText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                Try again
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : locations.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
          No saved locations yet. Add your first delivery pin above.
        </Text>
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
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.title,
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: Spacing.xs,
  },
  subTitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginBottom: Spacing.md,
  },
  countBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  countText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
  },
  addBtn: {
    flexDirection: 'row',
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  addBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: PortalFontSizes.subheading,
  },
  limitNotice: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  limitNoticeText: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.caption,
    textAlign: 'center',
  },
  loadingSpinner: { marginTop: Spacing.xl },
  errorPanel: {
    alignItems: 'center',
    gap: Spacing.sm + 2,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  errorText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    minHeight: PortalTouchTargets.pillHeight,
  },
  retryText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
