import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RotateCw, WifiOff } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { RETRY_LABEL } from '../services/errorMessages';
import {
  FontSizes,
  FontFamily,
  Spacing,
  BorderRadius,
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
}

export default function ErrandChannelList({
  errands,
  loading,
  error,
  onSelect,
  onRefresh,
  onNewErrandPress,
  emptyText,
}: ErrandChannelListProps) {
  const { colors, isDark } = useThemeColor();
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
        style={[
          styles.errorContainer,
          { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2' },
        ]}
        testID="connection-error-banner"
      >
        <WifiOff size={28} color={colors.danger} strokeWidth={2} />
        <Text style={[styles.errorTitle, { color: colors.danger }]} maxFontSizeMultiplier={1.2}>
          We could not load your chats
        </Text>
        <Text style={[styles.errorSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
          Check your Wi-Fi or mobile data, then try again.
        </Text>
        {onRefresh && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.refreshBtn, { backgroundColor: colors.danger }]}
            onPress={onRefresh}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID="tap-to-refresh-connection-btn"
          >
            <RotateCw size={14} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.refreshBtnTextWhite} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>{RETRY_LABEL}</Text>
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
              style={[styles.refreshBtnOutline, { borderColor: colors.primary, marginTop: Spacing.md }]}
              onPress={onRefresh}
              hitSlop={PortalTouchTargets.compactHitSlop}
            >
              <RotateCw size={14} color={colors.primary} />
              <Text style={[styles.refreshBtnTextPrimary, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
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
      <View
        style={[
          styles.emptyCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
          },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.textDark }]}>
          No Active Errand Chats
        </Text>
        {emptyText ? (
          <Text style={[styles.emptySubtitle, { color: colors.textGray }]}>
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
      {onRefresh && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.bottomRefreshLink}
          onPress={onRefresh}
          hitSlop={PortalTouchTargets.compactHitSlop}
        >
          <RotateCw size={13} color={colors.textGray} />
          <Text
            style={[styles.bottomRefreshText, { color: colors.textGray }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          >
            Refresh Channel Status
          </Text>
        </TouchableOpacity>
      )}
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
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.xs,
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl + 8,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.md,
  },
  emptyIconHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
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
  miniFlowContainer: {
    width: '100%',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  miniFlowTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.2),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  flowStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  flowStepItem: {
    alignItems: 'center',
    gap: 2,
  },
  flowStepNum: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    backgroundColor: 'rgba(246, 36, 89, 0.1)',
  },
  flowStepText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.2),
  },
  flowArrow: {
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    opacity: 0.6,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: PortalTouchTargets.buttonHeight,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  emptyBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.2),
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: PortalTouchTargets.compact,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
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
    gap: 6,
    minHeight: PortalTouchTargets.compact,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  refreshBtnTextPrimary: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.2),
  },
  bottomRefreshLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    paddingVertical: 8,
    minHeight: 44,
  },
  bottomRefreshText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.2),
  },
});
