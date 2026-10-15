import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  Shadows,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../../config/theme';

export interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LocationRequiredSpotlightProps {
  visible: boolean;
  /** The Home tab's "Delivering to" card, in window coordinates. Null: no hole, the card is centred. */
  target: SpotlightRect | null;
  onSetLocation: () => void;
}

const SCRIM = 'rgba(11, 19, 43, 0.82)';
/** Room around the lit card, so its border ring does not touch it. */
const PAD = 6;

/**
 * "Set your location first", for a customer with no saved delivery location
 * (2026-10-09). Everything is dimmed except the "Delivering to" card, which is
 * ringed, with a note under it and a button; tapping the card or the button
 * opens Saved Locations. There is no close: without a location the app cannot
 * show nearby stores or take an order, so this is the one way on. It clears by
 * itself once a location is saved.
 *
 * A Modal, so it also covers the top bar and the tab bar. Drawn as four dark
 * panels around the card rather than a cut-out, which plain views cannot make.
 * statusBarTranslucent so the Modal's coordinates are the window's, the same
 * ones `measureInWindow` gave for the card.
 */
export default function LocationRequiredSpotlight({ visible, target, onSetLocation }: LocationRequiredSpotlightProps) {
  const { colors, isDark } = useThemeColor();
  const { width, height } = useWindowDimensions();

  const hole = target
    ? {
        x: Math.max(0, target.x - PAD),
        y: Math.max(0, target.y - PAD),
        width: Math.min(width, target.width + PAD * 2),
        height: target.height + PAD * 2,
      }
    : null;
  // The note goes under the card, or over it if the card sits low.
  const noteBelow = !hole || hole.y + hole.height < height * 0.6;

  const note = (
    <View
      style={[
        styles.note,
        { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border },
        Shadows.liftedUp,
      ]}
      testID="location-required-note"
    >
      <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
        Set your delivery location first
      </Text>
      <Text style={[styles.body, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
        We need to know where to deliver before you can order. It also lets us show the stores near you.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onSetLocation}
        accessibilityRole="button"
        accessibilityLabel="Set my location"
        testID="location-required-set"
      >
        <MapPin size={16} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={styles.buttonText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
          Set my location
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      // The way on is to set a location; Back does not skip it.
      onRequestClose={() => {}}
      testID="location-required-spotlight"
    >
      {hole ? (
        <>
          <View style={[styles.scrim, { left: 0, top: 0, width, height: hole.y }]} />
          <View style={[styles.scrim, { left: 0, top: hole.y + hole.height, width, bottom: 0 }]} />
          <View style={[styles.scrim, { left: 0, top: hole.y, width: hole.x, height: hole.height }]} />
          <View
            style={[styles.scrim, { left: hole.x + hole.width, top: hole.y, right: 0, height: hole.height }]}
          />
          <TouchableOpacity
            style={[styles.ring, { left: hole.x, top: hole.y, width: hole.width, height: hole.height, borderColor: colors.primary }]}
            onPress={onSetLocation}
            accessibilityRole="button"
            accessibilityLabel="Set your delivery location"
            testID="location-required-target"
          />
          <View
            style={[
              styles.noteSlot,
              noteBelow ? { top: hole.y + hole.height + Spacing.md } : { bottom: height - hole.y + Spacing.md },
            ]}
          >
            {note}
          </View>
        </>
      ) : (
        <View style={[styles.scrim, styles.centered, { left: 0, top: 0, width, height }]}>{note}</View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    backgroundColor: SCRIM,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
  },
  noteSlot: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    alignItems: 'center',
  },
  note: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.4),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: BorderRadius.md,
    minHeight: 46,
    marginTop: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
});
