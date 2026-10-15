import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { ChevronLeft, ChevronRight, ClipboardList, RotateCw } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { useRateConfig } from '../hooks/useRateConfig';
import { apiClient } from '../services/apiClient';
import { formatErrandId } from '../utils/formatErrandId';
import { estimatedFeeOf, isActiveErrand, pesos } from '../utils/activeErrands';
import { LiquidGlass } from '../components/glass/LiquidGlass';
import StatusBadge from '../components/StatusBadge';
import ShimmerWave from '../components/ShimmerWave';
import ErrandDetailsScreen from './ErrandDetailsScreen';
import type { RootStackScreenProps } from '../navigation/types';
import {
  BorderRadius,
  FontFamily,
  MAX_CONTENT_WIDTH,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../config/theme';

const errandIdOf = (errand: any): string => String(errand?.orderId || errand?.id || '');

/**
 * The customer's active errands (2026-10-10), opened from Home's liquid glass
 * button, which replaced the active errand card at the top of Home. Active
 * only: waiting for a rider or being run (utils/activeErrands.ts).
 *
 * One active errand: its Errand Details, right here. Two or more: one liquid
 * glass card each, the errand ID as the heading, then the estimated fee and the
 * status, and a ">" that opens that errand's details (so does the card).
 *
 * Opens on the list Home already has (`errands`), then reads the customer's
 * errands again, and again each time it comes back into view, so an errand
 * that finished meanwhile drops off.
 */
export default function ActiveErrandsScreen({ route, navigation }: RootStackScreenProps<'ActiveErrands'>) {
  const { user, errands: fromHome } = route.params || ({} as any);
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const { baseFee } = useRateConfig();
  const backdropRef = useRef<View>(null);

  const [errands, setErrands] = useState<any[]>(() => (Array.isArray(fromHome) ? fromHome.filter(isActiveErrand) : []));
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(() =>
    Array.isArray(fromHome) && fromHome.some(isActiveErrand) ? 'ready' : 'loading'
  );
  const [refreshing, setRefreshing] = useState(false);
  const left = useRef(false);

  const load = useCallback(
    async (pulled = false) => {
      if (!user?.id) return;
      if (pulled) setRefreshing(true);
      try {
        const res = await apiClient.get(`/customers/${user.id}/transactions`);
        const orders = Array.isArray(res.data?.orders) ? res.data.orders : [];
        setErrands(orders.filter(isActiveErrand));
        setState('ready');
      } catch (err: any) {
        console.warn('[ActiveErrands] Could not load errands:', err?.message);
        // What is on screen stays; the error shows only when there is nothing.
        setState((current) => (current === 'ready' ? current : 'error'));
      } finally {
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Back from an errand's details: read again, it may have moved on.
  useEffect(() => {
    const offBlur = navigation.addListener?.('blur', () => {
      left.current = true;
    });
    const offFocus = navigation.addListener?.('focus', () => {
      if (left.current) load();
    });
    return () => {
      offBlur?.();
      offFocus?.();
    };
  }, [navigation, load]);

  const openDetails = (errand: any) =>
    navigation.navigate('ErrandDetails', { user, errand, errandId: errandIdOf(errand) });

  // One active errand: its details are this screen.
  if (state === 'ready' && errands.length === 1) {
    const only = errands[0];
    return (
      <ErrandDetailsScreen
        key={errandIdOf(only)}
        route={{ key: `${route.key}-details`, name: 'ErrandDetails', params: { user, errand: only, errandId: errandIdOf(only) } } as any}
        navigation={navigation as any}
      />
    );
  }

  const panel = (testID: string, message: string, action: { label: string; onPress: () => void; Icon: any }) => (
    <LiquidGlass radius={BorderRadius.lg} blurTarget={backdropRef} elevated={false} contentStyle={styles.panel} testID={testID}>
      <ClipboardList size={24} color={colors.textLight} />
      <Text style={[styles.panelText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
        {message}
      </Text>
      <TouchableOpacity
        style={[styles.panelBtn, { borderColor: colors.primary }]}
        onPress={action.onPress}
        hitSlop={PortalTouchTargets.compactHitSlop}
        accessibilityRole="button"
        testID={`${testID}-action`}
      >
        <action.Icon size={14} color={colors.primary} />
        <Text style={[styles.panelBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
          {action.label}
        </Text>
      </TouchableOpacity>
    </LiquidGlass>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'left', 'right']}>
      {/* What the glass refracts: the page and two soft brand-coloured glows. */}
      <BlurTargetView ref={backdropRef} style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgApp }]} pointerEvents="none">
        <View style={[styles.glow, styles.glowTop, { backgroundColor: colors.primary, opacity: isDark ? 0.22 : 0.16 }]} />
        <View style={[styles.glow, styles.glowBottom, { backgroundColor: isDark ? '#3B82F6' : '#0B132B', opacity: isDark ? 0.16 : 0.1 }]} />
      </BlurTargetView>

      <View style={styles.navHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          Active Errands
        </Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        testID="active-errands-screen"
      >
        {state === 'loading' ? (
          <View style={styles.list} testID="active-errands-loading">
            {[0, 1].map((i) => (
              <View key={i} style={[styles.shimmerCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <ShimmerWave height={18} width="55%" />
                <ShimmerWave height={13} width="40%" />
                <ShimmerWave height={22} width={90} />
              </View>
            ))}
          </View>
        ) : state === 'error' ? (
          panel('active-errands-error', "We couldn't load your errands. Check your connection, then try again.", {
            label: 'Try again',
            onPress: () => {
              setState('loading');
              load();
            },
            Icon: RotateCw,
          })
        ) : errands.length === 0 ? (
          panel('active-errands-empty', 'You have no active errands right now.', {
            label: 'Back to Home',
            onPress: () => navigation.goBack(),
            Icon: ChevronLeft,
          })
        ) : (
          <View style={styles.list} testID="active-errands-list">
            {errands.map((errand) => {
              const id = errandIdOf(errand);
              const shownId = formatErrandId(id);
              const fee = pesos(estimatedFeeOf(errand, baseFee));
              return (
                <TouchableOpacity
                  key={id}
                  activeOpacity={0.88}
                  onPress={() => openDetails(errand)}
                  accessibilityRole="button"
                  accessibilityLabel={`Errand ${shownId}, estimated fee ${fee}, ${String(errand.status).replace(/_/g, ' ').toLowerCase()}. Open its details`}
                  testID={`active-errand-${id}`}
                >
                  <LiquidGlass radius={BorderRadius.lg} blurTarget={backdropRef} contentStyle={styles.card}>
                    <View style={styles.cardText}>
                      <Text
                        style={[styles.errandId, { color: colors.textDark }]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
                      >
                        {shownId}
                      </Text>
                      <Text style={[styles.feeLine, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                        Estimated Fee{'  '}
                        <Text style={[styles.feeAmount, { color: colors.primary }]} testID={`active-errand-fee-${id}`}>
                          {fee}
                        </Text>
                      </Text>
                      <View style={styles.statusRow}>
                        <StatusBadge status={errand.status} />
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => openDetails(errand)}
                      hitSlop={PortalTouchTargets.compactHitSlop}
                      style={[
                        styles.openBtn,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#F1F5F9',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#E2E8F0',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`View errand ${shownId} details`}
                      testID={`active-errand-open-${id}`}
                    >
                      <ChevronRight size={20} color={colors.textDark} strokeWidth={2.4} />
                    </TouchableOpacity>
                  </LiquidGlass>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  glowTop: {
    top: -90,
    right: -110,
  },
  glowBottom: {
    bottom: 40,
    left: -140,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(17),
    lineHeight: getPortalLineHeight(17, 'heading'),
  },
  navHeaderRightPlaceholder: {
    width: PortalTouchTargets.compact,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  list: {
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm + 2,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  errandId: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    letterSpacing: -0.2,
  },
  feeLine: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.35),
  },
  feeAmount: {
    fontFamily: FontFamily.bold,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  // An action dome: the one control here that is fully round.
  openBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 8,
  },
  panel: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  panelText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.4),
  },
  panelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    minHeight: PortalTouchTargets.pillHeight,
    marginTop: 4,
  },
  panelBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
});
