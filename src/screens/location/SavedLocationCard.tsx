import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Star, Pencil, Trash2 } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { FontSizes, FontWeights, Spacing, BorderRadius, Shadows, FontFamily } from '../../config/theme';
import { getLocationTypeIcon } from '../../utils/locationLabelIcons';
import { SavedLocation } from './types';

export interface SavedLocationCardProps {
  location: SavedLocation;
  onSetDefault: (location: SavedLocation) => void;
  onEdit: (location: SavedLocation) => void;
  onDelete: (location: SavedLocation) => void;
}

export default function SavedLocationCard({ location, onSetDefault, onEdit, onDelete }: SavedLocationCardProps) {
  const { colors, isDark } = useThemeColor();
  const Icon = getLocationTypeIcon(location.label);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: location.isDefault ? colors.primary : colors.border },
        location.isDefault && styles.cardDefault,
        Shadows.soft,
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}>
        <Icon size={18} color={colors.primary} strokeWidth={2} />
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textDark }]} numberOfLines={1}>
            {location.label}
          </Text>
          {location.isDefault && (
            <View style={[styles.defaultBadge, { backgroundColor: colors.primary }]}>
              <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={[styles.address, { color: colors.textGray }]} numberOfLines={2}>
          {location.address}
        </Text>
      </View>

      <View style={styles.actions}>
        {!location.isDefault && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
            onPress={() => onSetDefault(location)}
            accessibilityRole="button"
            accessibilityLabel={`Set ${location.label} as default location`}
          >
            <Star size={15} color={colors.textMedium} strokeWidth={2} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
          onPress={() => onEdit(location)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${location.label}`}
        >
          <Pencil size={15} color={colors.textMedium} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : colors.dangerBg }]}
          onPress={() => onDelete(location)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${location.label}`}
        >
          <Trash2 size={15} color={colors.danger} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  cardDefault: { borderWidth: 1.5 },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  info: { flex: 1, marginRight: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, flexShrink: 1 },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: FontFamily.bold },
  address: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, marginTop: 2, lineHeight: 16 },
  actions: { flexDirection: 'column', gap: 4 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
