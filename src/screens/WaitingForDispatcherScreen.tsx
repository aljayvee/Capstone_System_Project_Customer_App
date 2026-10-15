import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSocket } from '../services/socketClient';
import { ref, onValue } from 'firebase/database';
import {
  MessageCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Home,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react-native';
import { database } from '../firebase/config';
import { RootStackScreenProps } from '../navigation/types';
import { apiClient } from '../services/apiClient';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  FontSizes,
  Spacing,
  BorderRadius,
  FontFamily,
  Shadows,
  PortalFontSizes,
  scaledPortalFontSize,
} from '../config/theme';
import { formatErrandId } from '../utils/formatErrandId';

function matchesErrand(candidateId: unknown, targetErrandId: unknown): boolean {
  const candidate = String(candidateId ?? '');
  const target = String(targetErrandId ?? '');
  if (!candidate || !target) return false;
  return candidate === target || candidate.includes(target);
}

export default function WaitingForDispatcherScreen({
  route,
  navigation,
}: RootStackScreenProps<'WaitingForDispatcher'>) {
  const { user, errandId } = route.params || {
    user: { id: 1, username: 'testuser', firstName: 'Customer', lastName: 'User' },
    errandId: 'PABILI-123456',
  };

  const { colors, isDark } = useThemeColor();
  const [errandStatus, setErrandStatus] = useState<string>('PENDING');
  const [dispatcherName, setDispatcherName] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);

  // Smooth pulsing animations
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const badgeScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Entrance bounce
    Animated.spring(badgeScale, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Beacon loop
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.45, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.15, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 1400, useNativeDriver: true }),
        ]),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseScale, pulseOpacity, badgeScale]);

  // Intercept Hardware Back Button (Android) so it returns cleanly to dashboard without Keep Changes modal
  useEffect(() => {
    const handleHardwareBack = () => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'CustomerPortal', params: { user } }],
      });
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => sub.remove();
  }, [navigation, user]);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial REST load
    const loadCustomerErrands = async () => {
      try {
        const response = await apiClient.get(`/errands/user/${user.id}`);
        const userErrands: unknown[] = response.data ?? [];
        const currentErrand = userErrands.find((e) => {
          const errand = e as Record<string, unknown>;
          return matchesErrand(errand.id, errandId);
        });
        if (currentErrand && isMounted) {
          const errand = currentErrand as Record<string, unknown>;
          setErrandStatus(String(errand.status ?? 'PENDING'));
          const logs = errand.dispatchLogs as Array<Record<string, unknown>> | undefined;
          const assignedDispatcher = logs?.[0]?.dispatcher as Record<string, unknown> | undefined;
          if (assignedDispatcher?.name) {
            setDispatcherName(String(assignedDispatcher.name));
          }
        }
      } catch (err: unknown) {
        const e = err as { message?: string };
        console.warn('[WaitingScreen] Error fetching customer errands:', e.message);
      }
    };

    loadCustomerErrands();

    // 2. Real-time Socket.IO listener
    let detachSocket: (() => void) | undefined;

    const onClaimed = (claimedErrand: Record<string, unknown>) => {
      if (matchesErrand(claimedErrand.id, errandId) && isMounted) {
        setErrandStatus(String(claimedErrand.status ?? 'ACCEPTED'));
        const logs = claimedErrand.dispatchLogs as Array<Record<string, unknown>> | undefined;
        const dispatcher = logs?.[0]?.dispatcher as Record<string, unknown> | undefined;
        if (dispatcher?.name) {
          setDispatcherName(String(dispatcher.name));
        }
      }
    };

    const onUpdated = (updatedErrand: Record<string, unknown>) => {
      if (matchesErrand(updatedErrand.id, errandId) && isMounted) {
        setErrandStatus(String(updatedErrand.status ?? 'PENDING'));
      }
    };

    void getSocket().then((socket) => {
      socket.on('order:claimed', onClaimed);
      socket.on('order:updated', onUpdated);
      detachSocket = () => {
        socket.off('order:claimed', onClaimed);
        socket.off('order:updated', onUpdated);
      };
    });

    // 3. Firebase chats/{errandId}/meta listener
    const metaRef = ref(database, `chats/${errandId}/meta`);
    const unsubMeta = onValue(metaRef, (snapshot) => {
      const meta = snapshot.val() as { dispatcherName?: string } | null;
      if (meta?.dispatcherName && isMounted) {
        setDispatcherName(meta.dispatcherName);
        setErrandStatus((current) => (current === 'PENDING' ? 'ACCEPTED' : current));
      }
    });

    return () => {
      isMounted = false;
      detachSocket?.();
      unsubMeta();
    };
  }, [user.id, errandId]);

  const phase: 'waiting' | 'accepted' | 'declined' = (() => {
    const norm = String(errandStatus || '').toUpperCase();
    if (norm === 'CANCELLED') return 'declined';
    if (['ACCEPTED', 'ASSIGNED', 'IN PROGRESS', 'IN_TRANSIT'].includes(norm)) return 'accepted';
    return 'waiting';
  })();

  const isAccepted = phase === 'accepted';
  const isDeclined = phase === 'declined';

  useEffect(() => {
    if (!isDeclined) return;
    let cancelled = false;
    apiClient
      .get(`/errands/${errandId}/decline-reasons`)
      .then((res) => {
        const latest = Array.isArray(res.data) ? res.data[0] : null;
        if (!cancelled && latest?.reason) setDeclineReason(String(latest.reason));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDeclined, errandId]);

  // Auto-navigate to chat once dispatcher accepts
  useEffect(() => {
    if (!isAccepted || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    const timer = setTimeout(() => {
      navigation.replace('CustomerChat', { user, errandId });
    }, 900);
    return () => clearTimeout(timer);
  }, [isAccepted, navigation, user, errandId]);

  const navigateToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerPortal', params: { user } }],
    });
  };

  const navigateToChat = () => {
    navigation.navigate('CustomerChat', { user, errandId });
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bgApp }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerSection}>
          {/* 1. HERO ANIMATED BADGE */}
          <View style={styles.heroBadgeWrapper}>
            {!isDeclined && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    borderColor: isAccepted ? '#10B981' : colors.primary,
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
            )}

            <Animated.View
              style={[
                styles.iconContainerCircle,
                Shadows.liftedUp,
                {
                  backgroundColor: isDeclined
                    ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2')
                    : isAccepted
                    ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7')
                    : (isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFF1F2'),
                  transform: [{ scale: badgeScale }],
                },
              ]}
            >
              {isDeclined ? (
                <AlertCircle size={44} color="#EF4444" strokeWidth={2.2} />
              ) : isAccepted ? (
                <CheckCircle2 size={44} color="#10B981" strokeWidth={2.4} />
              ) : (
                <CheckCircle2 size={44} color={colors.primary} strokeWidth={2.4} />
              )}
            </Animated.View>
          </View>

          {/* 2. ORDER ID CAPSULE */}
          <View
            testID="order-id-capsule"
            style={[
              styles.orderIdCapsule,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
              },
            ]}
          >
            <Sparkles size={13} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.orderIdText, { color: colors.textDark }]}>
              Order {formatErrandId(errandId)}
            </Text>
          </View>

          {/* 3. GRACEFUL HEADLINE */}
          <Text style={[styles.headlineTitle, { color: colors.textDark }]}>
            {isDeclined
              ? 'Errand Request Declined'
              : isAccepted
              ? 'Dispatcher Ready!'
              : 'Your errand has been placed!'}
          </Text>

          {/* 4. GRACEFUL REASSURING SUBTITLE */}
          <Text style={[styles.headlineSubtitle, { color: colors.textGray }]}>
            {isDeclined
              ? declineReason
                ? `Decline reason: ${declineReason}`
                : 'A dispatcher was unable to accept this request at this time.'
              : isAccepted
              ? `${dispatcherName ?? 'A verified dispatcher'} has accepted your request. Connecting to live chat...`
              : "We've sent your request to active dispatchers in Tacurong. A dispatcher will review your order and connect with you in under a minute."}
          </Text>

          {/* 5. LIVE RADAR STATUS PILL */}
          <View
            style={[
              styles.statusRadarCard,
              {
                backgroundColor: isDeclined
                  ? (isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2')
                  : isAccepted
                  ? (isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4')
                  : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC'),
                borderColor: isDeclined
                  ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA')
                  : isAccepted
                  ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#BBF7D0')
                  : colors.border,
              },
            ]}
          >
            {isDeclined ? (
              <View style={styles.radarContentRow}>
                <AlertCircle size={15} color="#EF4444" strokeWidth={2.4} />
                <Text style={[styles.radarStatusText, { color: '#DC2626' }]}>
                  Request cancelled
                </Text>
              </View>
            ) : isAccepted ? (
              <View style={styles.radarContentRow}>
                <CheckCircle2 size={15} color="#10B981" strokeWidth={2.4} />
                <Text style={[styles.radarStatusText, { color: '#059669' }]}>
                  {dispatcherName ? `${dispatcherName} is ready` : 'Dispatcher connected'}
                </Text>
              </View>
            ) : (
              <View style={styles.radarContentRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.radarStatusText, { color: colors.textMedium }]}>
                  Waiting for dispatcher confirmation...
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 6. BOTTOM ACTION BUTTONS */}
        <View style={styles.bottomActionContainer}>
          <TouchableOpacity
            testID={isDeclined ? 'place-new-errand-button' : 'open-chat-button'}
            activeOpacity={0.88}
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
            onPress={isDeclined ? () => navigation.navigate('StoreSearch', { user }) : navigateToChat}
            accessibilityLabel={isDeclined ? 'Place a new errand' : 'Open live chat'}
          >
            <View style={styles.actionBtnRow}>
              {isDeclined ? (
                <RotateCcw size={17} color="#FFFFFF" strokeWidth={2.4} />
              ) : (
                <MessageCircle size={17} color="#FFFFFF" strokeWidth={2.4} />
              )}
              <Text style={styles.primaryActionBtnText}>
                {isDeclined
                  ? 'Place a New Errand'
                  : isAccepted
                  ? `Chat with ${dispatcherName ?? 'Dispatcher'}`
                  : 'Open Live Chat'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="back-to-dashboard-button"
            activeOpacity={0.8}
            style={[
              styles.secondaryActionBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
              },
            ]}
            onPress={navigateToDashboard}
            accessibilityLabel="Return to Dashboard"
          >
            <View style={styles.actionBtnRow}>
              <Home size={16} color={colors.textDark} strokeWidth={2.2} />
              <Text style={[styles.secondaryActionBtnText, { color: colors.textDark }]}>
                Return to Dashboard
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl + 10,
    paddingBottom: Spacing.xxl,
    justifyContent: 'space-between',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xl,
  },
  heroBadgeWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
  },
  iconContainerCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  // Text sizes on the portal scale, 12 pt and up (2026-10-14). This screen,
  // shown after every order, had the smallest text in the app: the order
  // number at 10, the status at 10.5, the subtitle and buttons at 11.5 to 12.
  orderIdText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    letterSpacing: 0.3,
  },
  headlineTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xxl,
    textAlign: 'center',
    marginBottom: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    letterSpacing: -0.3,
  },
  headlineSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  statusRadarCard: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  radarContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radarStatusText: {
    flexShrink: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  bottomActionContainer: {
    gap: 12,
    paddingTop: Spacing.xxl,
  },
  primaryActionBtn: {
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    height: 50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
});
