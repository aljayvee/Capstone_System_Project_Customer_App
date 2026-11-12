import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RotateCw, WifiOff } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { RETRY_LABEL } from '../services/errorMessages';
import {
  FontFamily,
  Spacing,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import ErrandChannelRow from './ErrandChannelRow';
import { ChannelListSkeleton } from './ChatSkeleton';
import type { ErrandSummary } from '../hooks/useActiveErrands';

export interface ErrandChannelListProps {
  errands: ErrandSummary[];
  loading?: boolean;
  error?: boolean;
  onSelect: (errandId: string, status?: string) => void;
  onRefresh?: () => void;
  onNewErrandPress?: () => void;
  emptyText?: string;
  emptyTitle?: string;
}

export default function ErrandChannelList({
  errands,
  loading,
  error,
  onSelect,
  onRefresh,
  onNewErrandPress,
  emptyText,
  emptyTitle = 'No Active Errand Chats',
}: ErrandChannelListProps) {
  const { colors, isDark } = useThemeColor();
  const brandColor = isDark ? colors.primary : colors.primaryStrong;
  const [showCircularFallback, setShowCircularFallback] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (loading) {
      setShowCircularFallback(false);
      timer = setTimeout(() => {
        setShowCircularFallback(true);
      }, 3000);
    } else {
      setShowCircularFallback(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  // Case 1: Server Connection Dropped / Network Issue
  if (error) {
    return (
      <View
        style={styles.errorContainer}
        testID="connection-error-banner"
      >
        <WifiOff size={24} color={colors.textGray} strokeWidth={1.8} />
        <Text style={[styles.errorTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
          We could not load your chats
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
          Check your Wi-Fi or mobile data, then try again.
        </Text>
        {onRefresh && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.refreshBtn, { backgroundColor: brandColor }]}
            onPress={onRefresh}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID="tap-to-refresh-connection-btn"
            accessibilityRole="button"
            accessibilityLabel="Try loading conversations again"
          >
            <RotateCw size={14} color={colors.onPrimary} strokeWidth={2.2} />
            <Text style={[styles.refreshBtnTextWhite, { color: colors.onPrimary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>{RETRY_LABEL}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Case 2: Loading State Machine (0-3s Skeleton, >3s Circular Spinner)
  if (loading) {
    if (showCircularFallback) {
      return (
        <View style={styles.circularContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.circularText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            Slow connection. Still loading your chats...
          </Text>
          {onRefresh && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.refreshBtnOutline, { borderColor: brandColor, marginTop: Spacing.md }]}
              onPress={onRefresh}
              hitSlop={PortalTouchTargets.compactHitSlop}
            >
              <RotateCw size={14} color={brandColor} />
              <Text style={[styles.refreshBtnTextPrimary, { color: brandColor }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                {RETRY_LABEL}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return <ChannelListSkeleton />;
  }

  // Case 3: Empty Channels List (No active errand chats)
  if (errands.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.emptyTitle, { color: colors.textDark }]}>
          {emptyTitle}
        </Text>
        {emptyText ? (
          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.emptySubtitle, { color: colors.textGray }]}>
            {emptyText}
          </Text>
        ) : null}
      </View>
    );
  }

  // Case 4: Live Channel Rows
  return (
    <View style={styles.listContainer}>
      {errands.map((errand) => (
        <ErrandChannelRow key={errand.id} errand={errand} onSelect={onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: { gap: 0 },
  circularContainer: { padding: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  circularText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.3),
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  errorContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.huge + Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 1.25),
    marginTop: Spacing.xs,
  },
  errorSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.huge + Spacing.xl,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 1.25),
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
    textAlign: 'center',
    marginBottom: Spacing.md,
    maxWidth: 280,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: 10,
  },
  refreshBtnTextWhite: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.2),
    color: '#FFFFFF',
  },
  refreshBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  refreshBtnTextPrimary: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.2),
  },
});
