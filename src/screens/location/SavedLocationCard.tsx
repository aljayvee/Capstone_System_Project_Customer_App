import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Star, Pencil, Trash2 } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontSizes,
  FontWeights,
  Spacing,
  BorderRadius,
  Shadows,
  FontFamily,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
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
  const doorDetails = [location.streetName, location.landmark]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' • ');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: location.isDefault ? colors.primary : colors.border,
          borderWidth: location.isDefault ? 1.5 : 1,
        },
        Shadows.soft,
      ]}
      testID={`saved-location-card-${location.id}`}
    >
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={location.isDefault ? 1 : 0.7}
        onPress={() => {
          if (!location.isDefault) {
            onSetDefault(location);
          }
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: location.isDefault }}
        accessibilityLabel={
          location.isDefault
            ? `${location.label}, Default delivery location`
            : `Set ${location.label} as default delivery location`
        }
        testID={`saved-location-select-${location.id}`}
      >
        <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}>
          <Icon size={18} color={colors.primary} strokeWidth={2} />
        </View>

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, { color: colors.textDark }]}
              numberOfLines={1}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
            >
              {location.label}
            </Text>
            {location.isDefault && (
              <View style={[styles.defaultBadge, { backgroundColor: colors.primary }]} testID={`saved-location-default-badge-${location.id}`}>
                <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
                <Text
                  style={styles.defaultBadgeText}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  Default
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.address, { color: colors.textGray }]}
            numberOfLines={2}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          >
            {location.address}
          </Text>
          {doorDetails ? (
            <Text
              style={[styles.doorDetails, { color: colors.textMedium }]}
              numberOfLines={1}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              testID={`saved-location-details-${location.id}`}
            >
              {doorDetails}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
          onPress={() => onEdit(location)}
          hitSlop={PortalTouchTargets.compactHitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${location.label}`}
          testID={`edit-location-${location.id}`}
        >
          <Pencil size={16} color={colors.textMedium} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : colors.dangerBg }]}
          onPress={() => onDelete(location)}
          hitSlop={PortalTouchTargets.compactHitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${location.label}`}
          testID={`delete-location-${location.id}`}
        >
          <Trash2 size={16} color={colors.danger} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    paddingRight: Spacing.xs,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  info: { flex: 1, marginRight: Spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
    flexShrink: 1,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: PortalFontSizes.micro,
    fontFamily: FontFamily.bold,
  },
  address: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginTop: 2,
  },
  doorDetails: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginTop: 2,
  },
  actions: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.md,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
