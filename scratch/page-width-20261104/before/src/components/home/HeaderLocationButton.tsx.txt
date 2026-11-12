import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, MapPin } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import LocationRequiredSpotlight, { type SpotlightRect } from './LocationRequiredSpotlight';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  scaledPortalFontSize,
} from '../../config/theme';

/** The address shown: the saved location's own name ("Home"), else its address. */
export function headerLocationText(label?: string | null, address?: string | null): string {
  return label?.trim() || address?.trim() || 'Set address';
}

/**
 * Where the customer's errands are delivered, in the Home header (2026-10-11):
 * a map pin with "Delivering to" and the saved location's name. Since
 * 2026-10-14 it leads the header on the left, as foodpanda's address does,
 * with the bell and the profile photo on the right. It replaced the "Delivering to" card that opened
 * Home; tapping it opens Saved Locations, as the card did. Help is still in
 * Account and on the Chat tab.
 *
 * It also carries the new customer's "set your delivery location first"
 * spotlight, which rings it (it used to ring the card): `requireLocation` is
 * true only when the customer certainly has no saved location and Home is on
 * screen (CustomerPortalScreen). If the button cannot be measured, the
 * spotlight shows centred after a moment instead.
 */
export function HeaderLocationButton({
  label,
  address,
  onPress,
  requireLocation = false,
}: {
  label?: string | null;
  address?: string | null;
  onPress: () => void;
  requireLocation?: boolean;
}) {
  const { colors } = useThemeColor();
  const ref = useRef<View>(null);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [fallback, setFallback] = useState(false);
  const hasAddress = Boolean(label?.trim() || address?.trim());
  const shown = headerLocationText(label, address);

  const measure = useCallback(() => {
    requestAnimationFrame(() =>
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) setRect({ x, y, width, height });
      })
    );
  }, []);

  useEffect(() => {
    if (!requireLocation) return undefined;
    measure();
    const timer = setTimeout(() => setFallback(true), 1200);
    return () => clearTimeout(timer);
  }, [requireLocation, measure]);

  return (
    <>
      <View ref={ref} collapsable={false} style={styles.wrap} onLayout={requireLocation ? measure : undefined}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          hitSlop={PortalTouchTargets.compactHitSlop}
          // No fill in either theme: light mode lost it on 2026-10-11, dark
          // mode's grey box went on 2026-10-14, so the address sits on the
          // header as foodpanda's does. The pink pin and chevron say it taps.
          // The pin is the brand pink since it leads the header (2026-10-14).
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={hasAddress ? `Delivering to ${shown}. Change your delivery address` : 'Set your delivery address'}
          testID="header-location-btn"
        >
          <MapPin size={22} color={colors.primary} strokeWidth={2.3} />
          <View style={styles.textCol}>
            <Text style={[styles.caption, { color: colors.textGray }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              Delivering to
            </Text>
            <View style={styles.placeRow}>
              <Text
                style={[styles.place, { color: hasAddress ? colors.textDark : colors.primary }]}
                numberOfLines={1}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                testID="header-location-text"
              >
                {shown}
              </Text>
              <ChevronDown size={16} color={colors.primary} strokeWidth={2.6} />
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <LocationRequiredSpotlight visible={requireLocation && (rect !== null || fallback)} target={rect} onSetLocation={onPress} />
    </>
  );
}

const styles = StyleSheet.create({
  // Leads the header now (2026-10-14): as wide as the row allows, no wider
  // than its text, and the place truncates rather than pushing the bell off.
  wrap: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: BorderRadius.md,
    paddingLeft: 4,
    paddingRight: 8,
    minHeight: PortalTouchTargets.compact,
  },
  textCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  caption: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: scaledPortalFontSize(PortalFontSizes.micro) + 3,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  place: {
    flexShrink: 1,
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: scaledPortalFontSize(PortalFontSizes.subheading) + 4,
  },
});
