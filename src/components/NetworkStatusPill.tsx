import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff, CheckCircle2, Signal } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, FontFamily, Spacing } from '../config/theme';

interface NetworkStatusPillProps {
  isOffline?: boolean;
  isSlow?: boolean;
  justReconnected?: boolean;
}

/**
 * The thin strip under the status bar. Never blocks; it only reports.
 *
 * Three states, in priority order, because they are mutually exclusive facts
 * about one connection and stacking them would say two things at once.
 *
 * It used to offer a "Working Offline (N queued)" variant. Nothing in this app
 * queues anything, so that line promised the customer their tap had been saved
 * when it had not - exactly the mock telemetry AGENTS.md forbids. Removed.
 */
export const NetworkStatusPill: React.FC<NetworkStatusPillProps> = ({
  isOffline = false,
  isSlow = false,
  justReconnected = false,
}) => {
  const { colors } = useThemeColor();

  if (!isOffline && !isSlow && !justReconnected) return null;

  if (isOffline) {
    return (
      <View style={[styles.container, { backgroundColor: colors.dangerBg }]}>
        <WifiOff size={13} color={colors.danger} strokeWidth={2.2} />
        <Text style={[styles.text, { color: colors.danger }]} maxFontSizeMultiplier={1.15}>
          No internet connection
        </Text>
      </View>
    );
  }

  if (isSlow) {
    return (
      <View style={[styles.container, { backgroundColor: colors.warningBg }]}>
        <Signal size={13} color={colors.warning} strokeWidth={2.2} />
        <Text style={[styles.text, { color: colors.warning }]} maxFontSizeMultiplier={1.15}>
          Slow connection. Still working...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.successBg }]}>
      <CheckCircle2 size={13} color={colors.success} strokeWidth={2.2} />
      <Text style={[styles.text, { color: colors.success }]} maxFontSizeMultiplier={1.15}>
        Back online
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    gap: 6,
    zIndex: 999,
  },
  text: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.semibold,
  },
});

export default NetworkStatusPill;
