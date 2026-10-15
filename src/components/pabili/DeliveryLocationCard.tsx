import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertCircle, MapPin, RefreshCw } from 'lucide-react-native';
import ShimmerWave from '../ShimmerWave';
import { useThemeColor } from '../../hooks/useThemeColor';
import type { DeliveryLocation } from '../../hooks/useDefaultDeliveryLocation';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  Shadows,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';

interface Props {
  location: DeliveryLocation | null;
  loading: boolean;
  failed: boolean;
  onChange: () => void;
  onRetry: () => void;
}

/**
 * Where the errand goes. Four states, each with its way forward: loading,
 * the saved place with Change, none saved with Set, and could-not-load with
 * Try again (not Set, which would send the customer to make a place they have).
 */
export default function DeliveryLocationCard({ location, loading, failed, onChange, onRetry }: Props) {
  const { colors, isDark } = useThemeColor();

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]} testID="location-card-loading">
        <ShimmerWave height={12} width="40%" />
        <ShimmerWave height={16} style={{ marginTop: 8 }} />
      </View>
    );
  }

  if (failed) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]} testID="location-card-failed">
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: colors.bgGray }]}>
            <AlertCircle size={16} color={colors.textGray} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
              Couldn't load your delivery address
            </Text>
            <Text style={[styles.subtitle, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              Your list is saved. Check your connection and try again.
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRetry}
            style={[styles.smallBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
            hitSlop={PortalTouchTargets.compactHitSlop}
            accessibilityRole="button"
          >
            <RefreshCw size={13} color={colors.primary} />
            <Text style={[styles.smallBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!location) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FEF3C7', borderColor: isDark ? '#D97706' : '#FCD34D' },
          Shadows.soft,
        ]}
        testID="location-card-missing"
      >
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: '#F59E0B20' }]}>
            <AlertCircle size={18} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: isDark ? '#FCD34D' : '#92400E' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
              Where should we deliver?
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#FDE68A' : '#B45309' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              Pin your delivery address in Tacurong City. Your list stays saved.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.setBtn, { backgroundColor: colors.primary }]}
          onPress={onChange}
          accessibilityRole="button"
        >
          <MapPin size={15} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.setBtnText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
            Set delivery location
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]} testID="location-card">
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(32,138,239,0.15)' : '#E6F4FE' }]}>
          <MapPin size={16} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
            Delivering to
          </Text>
          <Text style={[styles.address, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            {location.address}
          </Text>
          {location.streetName || location.landmark ? (
            <Text style={[styles.subtitle, { color: colors.textGray }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              {[location.streetName, location.landmark].filter(Boolean).join(' • ')}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.smallBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
          onPress={onChange}
          hitSlop={PortalTouchTargets.compactHitSlop}
          accessibilityRole="button"
        >
          <Text style={[styles.smallBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
            Change
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  address: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
    marginTop: 2,
  },
  title: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading), marginBottom: 2 },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  smallBtnText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.caption) },
  setBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  setBtnText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading), color: '#FFFFFF' },
});
