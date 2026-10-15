import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LocateFixed, Navigation, ChevronRight } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontSizes,
  FontWeights,
  Spacing,
  BorderRadius,
  FontFamily,
  Shadows,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
import MapPreviewField from '../../components/MapPreviewField';
import SettingsRow from '../../components/SettingsRow';
import SettingsSection from '../../components/SettingsSection';
import { useReverseGeocodedAddress } from '../../hooks/useReverseGeocodedAddress';
import { MapCoordinate, DEFAULT_CENTER } from '../../utils/coords';

export interface WizardStepPinProps {
  pin: MapCoordinate | null;
  onSelectPin: (coordinate: MapCoordinate) => void;
  gpsLoading: boolean;
  onUseCurrentLocation: () => Promise<MapCoordinate | null>;
  onNext: (resolvedAddress: string | null) => void;
}

function statusTextFor(pin: MapCoordinate | null, resolving: boolean, resolvedAddress: string | null) {
  if (!pin) return 'No location selected yet';
  if (resolving) return 'Finding address…';
  if (resolvedAddress) return resolvedAddress;
  return 'Location pinned. Enter the address on the next step.';
}

export default function WizardStepPin({ pin, onSelectPin, gpsLoading, onUseCurrentLocation, onNext }: WizardStepPinProps) {
  const { colors, isDark } = useThemeColor();
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const { resolving, resolvedAddress } = useReverseGeocodedAddress(pin);

  const handleUseCurrentLocation = async () => {
    const coordinate = await onUseCurrentLocation();
    if (coordinate) onSelectPin(coordinate);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text
          style={[styles.title, { color: colors.textDark }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
        >
          Pin Your Location
        </Text>
        <Text
          style={[styles.subtitle, { color: colors.textGray }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
        >
          Use your current GPS position or drop a pin on the map.
        </Text>

        <TouchableOpacity
          style={[styles.gpsBtn, { backgroundColor: colors.primary }, Shadows.soft]}
          onPress={handleUseCurrentLocation}
          disabled={gpsLoading}
          activeOpacity={0.85}
          hitSlop={PortalTouchTargets.compactHitSlop}
        >
          {gpsLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <LocateFixed size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text
                style={styles.gpsBtnText}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
              >
                Use Current Location
              </Text>
            </>
          )}
        </TouchableOpacity>

        <SettingsSection>
          <SettingsRow
            icon={Navigation}
            label="Choose on Map"
            subtitle="Drop a pin at your delivery spot"
            trailing={<ChevronRight size={18} color={colors.textLight} />}
            onPress={() => setMapPickerVisible(true)}
          />
        </SettingsSection>

        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
              borderColor: colors.border,
            },
            Shadows.soft,
          ]}
        >
          {resolving && <ActivityIndicator color={colors.primary} size="small" style={styles.statusSpinner} />}
          <Text
            style={[
              styles.statusText,
              { color: pin ? colors.textDark : colors.textLight },
              !pin && styles.statusTextMuted,
            ]}
            numberOfLines={3}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          >
            {statusTextFor(pin, resolving, resolvedAddress)}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.nextBtn,
            {
              backgroundColor: pin
                ? colors.primary
                : isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : '#E5E7EB',
            },
            pin ? Shadows.soft : null,
          ]}
          onPress={() => onNext(resolvedAddress)}
          disabled={!pin}
          activeOpacity={0.85}
          hitSlop={PortalTouchTargets.compactHitSlop}
        >
          <Text
            style={[
              styles.nextBtnText,
              {
                color: pin
                  ? '#FFFFFF'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.35)'
                  : colors.textLight,
              },
            ]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
          >
            Next
          </Text>
        </TouchableOpacity>
      </View>

      <MapPreviewField
        editable
        center={pin ?? DEFAULT_CENTER}
        label="Choose on Map"
        controlled={{ visible: mapPickerVisible, onClose: () => setMapPickerVisible(false) }}
        onConfirm={onSelectPin}
        confirmLabel="Use this pin"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.title,
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginBottom: Spacing.lg,
  },
  gpsBtn: {
    flexDirection: 'row',
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  gpsBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  statusSpinner: { marginRight: 2 },
  statusText: {
    flex: 1,
    fontSize: PortalFontSizes.caption,
    fontFamily: FontFamily.medium,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
  statusTextMuted: {
    fontStyle: 'italic',
    fontFamily: FontFamily.regular,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  nextBtn: {
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
});
