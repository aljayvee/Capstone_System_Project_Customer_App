import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RotateCw, WifiOff, MessageSquare, Sparkles } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, FontFamily, Spacing, BorderRadius, Shadows } from '../config/theme';
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
          { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2', borderColor: colors.danger },
          Shadows.soft,
        ]}
        testID="connection-error-banner"
      >
        <WifiOff size={28} color={colors.danger} strokeWidth={2} />
        <Text style={[styles.errorTitle, { color: colors.danger }]}>Connection to Server Dropped</Text>
        <Text style={[styles.errorSubtitle, { color: colors.textGray }]}>
          Unable to connect to live dispatch services. Check your internet connection and try again.
        </Text>
        {onRefresh && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.refreshBtn, { backgroundColor: colors.danger }]}
            onPress={onRefresh}
            testID="tap-to-refresh-connection-btn"
          >
            <RotateCw size={14} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.refreshBtnTextWhite}>Tap to Refresh</Text>
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
          <Text style={[styles.circularText, { color: colors.textGray }]}>
            Still connecting to live dispatch server...
          </Text>
          {onRefresh && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.refreshBtnOutline, { borderColor: colors.primary, marginTop: Spacing.md }]}
              onPress={onRefresh}
            >
              <RotateCw size={14} color={colors.primary} />
              <Text style={[styles.refreshBtnTextPrimary, { color: colors.primary }]}>Tap to Refresh</Text>
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
            backgroundColor: colors.card,
            borderColor: isDark ? colors.border : '#EDEFF2',
          },
          Shadows.soft,
        ]}
      >
        <View
          style={[
            styles.emptyIconHalo,
            {
              backgroundColor: isDark
                ? 'rgba(246, 36, 89, 0.12)'
                : '#FFF0F5',
            },
          ]}
        >
          <MessageSquare size={34} color={colors.primary} strokeWidth={2} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textDark }]}>
          No Active Errand Chats
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textGray }]}>
          {emptyText ||
            'Chats are automatically opened when you place an errand to review item pricing and coordinate live with your dispatcher.'}
        </Text>

        {/* 3-Step Fulfillment Flow Recap */}
        <View style={[styles.miniFlowContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray }]}>
          <Text style={[styles.miniFlowTitle, { color: colors.textMedium }]}>How It Works:</Text>
          <View style={styles.flowStepsRow}>
            <View style={styles.flowStepItem}>
              <Text style={[styles.flowStepNum, { color: colors.primary }]}>1</Text>
              <Text style={[styles.flowStepText, { color: colors.textDark }]}>List Items</Text>
            </View>
            <Text style={[styles.flowArrow, { color: colors.textLight }]}>➔</Text>
            <View style={styles.flowStepItem}>
              <Text style={[styles.flowStepNum, { color: colors.primary }]}>2</Text>
              <Text style={[styles.flowStepText, { color: colors.textDark }]}>Upfront Rate</Text>
            </View>
            <Text style={[styles.flowArrow, { color: colors.textLight }]}>➔</Text>
            <View style={styles.flowStepItem}>
              <Text style={[styles.flowStepNum, { color: colors.primary }]}>3</Text>
              <Text style={[styles.flowStepText, { color: colors.textDark }]}>COD Delivery</Text>
            </View>
          </View>
        </View>

        {onNewErrandPress && (
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }, Shadows.soft]}
            onPress={onNewErrandPress}
            testID="empty-request-errand-btn"
          >
            <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.emptyBtnText}>Request a New Errand</Text>
          </TouchableOpacity>
        )}
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
        <TouchableOpacity activeOpacity={0.7} style={styles.bottomRefreshLink} onPress={onRefresh}>
          <RotateCw size={13} color={colors.textGray} />
          <Text style={[styles.bottomRefreshText, { color: colors.textGray }]}>Refresh Channel Status</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: { gap: Spacing.xs },
  circularContainer: { padding: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  circularText: { fontFamily: FontFamily.medium, fontSize: FontSizes.xs, marginTop: Spacing.sm, textAlign: 'center' },
  errorContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.xs,
  },
  errorTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, marginTop: Spacing.xs },
  errorSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 0.5,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl + 8,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginTop: Spacing.xs,
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
    fontSize: FontSizes.md + 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 0.5,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 18,
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
    fontSize: 10,
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
    fontSize: 11,
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: 'rgba(246, 36, 89, 0.1)',
  },
  flowStepText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
  },
  flowArrow: {
    fontSize: 10,
    opacity: 0.6,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  emptyBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  refreshBtnTextWhite: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs, color: '#FFFFFF' },
  refreshBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  refreshBtnTextPrimary: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs },
  bottomRefreshLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    paddingVertical: 4,
  },
  bottomRefreshText: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs },
});
