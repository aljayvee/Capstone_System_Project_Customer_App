import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSocket } from '../services/socketClient';
import { ref, onValue } from 'firebase/database';
import { MessageCircle, Bike, FileText, ChevronLeft, ShieldCheck, Package, CheckCircle, RotateCcw } from 'lucide-react-native';
import { database } from '../firebase/config';
import { RootStackScreenProps } from '../navigation/types';
import { apiClient } from '../services/apiClient';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, Spacing, BorderRadius, FontFamily, Shadows } from '../config/theme';
import { formatErrandId } from '../utils/formatErrandId';

// ─── Humanized status map ────────────────────────────────────────────────────
const HUMAN_STATUS: Record<string, string> = {
  PENDING: '⏳ Finding a Dispatcher...',
  ACCEPTED: '✅ Dispatcher Ready!',
  Assigned: '✅ Dispatcher Ready!',
  'In Progress': '✅ Dispatcher Ready!',
  ASSIGNED: '✅ Dispatcher Ready!',
};

function humanStatus(raw: string): string {
  return HUMAN_STATUS[raw] ?? raw;
}

function matchesErrand(candidateId: unknown, targetErrandId: unknown): boolean {
  const candidate = String(candidateId ?? '');
  const target = String(targetErrandId ?? '');
  if (!candidate || !target) return false;
  return candidate === target || candidate.includes(target);
}

// ─── What Happens Next steps ─────────────────────────────────────────────────
const FULFILLMENT_STEPS = [
  {
    icon: MessageCircle,
    label: 'Dispatcher Reviews',
    desc: 'Reviews your item list & confirms via in-app chat',
    color: '#6366F1',
  },
  {
    icon: Bike,
    label: 'Rider is Assigned',
    desc: 'A verified rider picks up and purchases your items',
    color: '#F59E0B',
  },
  {
    icon: Package,
    label: 'Delivered to You',
    desc: 'Rider delivers to your address — pay cash on arrival',
    color: '#10B981',
  },
];

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
  const hasNavigatedRef = useRef(false);

  // Pulsing beacon animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

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

  /**
   * Three outcomes, not two.
   *
   * This screen used to derive a single `isAccepted` boolean, which left it
   * with no way to represent a request that had been turned down: a declined
   * errand sat here saying "Finding a Dispatcher…" indefinitely, animating a
   * beacon for a search that had already ended. Now that a dispatcher can
   * decline with a reason, that state has to exist here or the screen actively
   * lies to the customer.
   */
  const phase: 'waiting' | 'accepted' | 'declined' = (() => {
    const norm = String(errandStatus || '').toUpperCase();
    if (norm === 'CANCELLED') return 'declined';
    if (['ACCEPTED', 'ASSIGNED', 'IN PROGRESS', 'IN_TRANSIT'].includes(norm)) return 'accepted';
    return 'waiting';
  })();

  const isAccepted = phase === 'accepted';
  const isDeclined = phase === 'declined';

  /**
   * Why it was declined, read from the record the server keeps.
   *
   * Fetched rather than taken from the socket payload because a customer can
   * arrive here long after the event — reopening the app, or tapping the
   * notification — and the reason has to survive that.
   */
  const [declineReason, setDeclineReason] = useState<string | null>(null);

  useEffect(() => {
    if (!isDeclined) return;
    let cancelled = false;
    apiClient
      .get(`/errands/${errandId}/decline-reasons`)
      .then((res) => {
        const latest = Array.isArray(res.data) ? res.data[0] : null;
        if (!cancelled && latest?.reason) setDeclineReason(String(latest.reason));
      })
      .catch(() => {
        // The screen still explains the cancellation without a reason; a
        // missing explanation is worse than none but not worth an error state.
      });
    return () => {
      cancelled = true;
    };
  }, [isDeclined, errandId]);

  // Auto-navigate to chat once dispatcher accepts.
  //
  // Deliberately NOT done on decline. Being thrown into a conversation is the
  // right move when someone has just taken your errand on and is waiting to
  // talk; doing the same after a refusal removes the customer's chance to read
  // what happened and decide for themselves what to do next.
  useEffect(() => {
    if (!isAccepted || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    const timer = setTimeout(() => {
      navigation.replace('CustomerChat', { user, errandId });
    }, 900);
    return () => clearTimeout(timer);
  }, [isAccepted, navigation, user, errandId]);

  // ─── Stepper data ─────────────────────────────────────────────────────────
  const STEPS = ['Choose', 'Add Items', 'Submitted'];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bgApp }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      {/* ── NAV HEADER ────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.navHeaderRow,
          { borderBottomColor: colors.border, backgroundColor: colors.bgApp },
        ]}
      >
        <TouchableOpacity
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'CustomerPortal', params: { user } }] })
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]}>Errand Status</Text>
        <View style={styles.navRightPlaceholder} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── GOAL-GRADIENT STEPPER ─────────────────────────────────────── */}
        <View style={styles.stepperWrap}>
          {STEPS.map((label, idx) => {
            const isCompleted = idx < 2; // Steps 0 & 1 are done
            const isActive = idx === 2;  // Step 2 (Submitted) is current
            return (
              <React.Fragment key={`step-${idx}`}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      isCompleted
                        ? { backgroundColor: '#10B981' }
                        : isActive
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' },
                    ]}
                  >
                    {isCompleted ? (
                      <CheckCircle size={12} color="#FFFFFF" strokeWidth={2.5} />
                    ) : (
                      <Text
                        style={[
                          styles.stepDotNum,
                          { color: isActive ? '#FFFFFF' : colors.textGray },
                        ]}
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: isCompleted
                          ? '#10B981'
                          : isActive
                          ? colors.primary
                          : colors.textGray,
                        fontFamily: isActive ? FontFamily.bold : FontFamily.regular,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
                {idx < STEPS.length - 1 && (
                  <View
                    style={[
                      styles.stepConnector,
                      { backgroundColor: idx < 2 ? '#10B981' : (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB') },
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* ── DISPATCHER SOCIAL PROOF PILL ──────────────────────────────── */}
        <View style={styles.socialProofWrap}>
          <View style={[styles.socialProofPill, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5', borderColor: isDark ? '#065F46' : '#A7F3D0' }]}>
            <View style={styles.onlineDot} />
            <ShieldCheck size={13} color="#10B981" strokeWidth={2.2} />
            <Text style={[styles.socialProofText, { color: isDark ? '#34D399' : '#065F46' }]}>
              Dispatchers are online and active
            </Text>
          </View>
        </View>

        {/* ── STATUS HERO CARD ──────────────────────────────────────────── */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isAccepted
                ? (isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5')
                : (isDark ? 'rgba(246,36,89,0.08)' : '#FFF1F2'),
              borderColor: isAccepted
                ? (isDark ? '#059669' : '#A7F3D0')
                : (isDark ? '#9F1239' : '#FECDD3'),
            },
          ]}
        >
          {/* Pulsing beacon ring */}
          {!isAccepted && !isDeclined && (
            <View style={styles.beaconWrap}>
              <Animated.View
                style={[
                  styles.beaconRing,
                  { borderColor: colors.primary, transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={[styles.beaconCore, { backgroundColor: colors.primary }]} />
            </View>
          )}

          <View style={[styles.heroIconCircle, { backgroundColor: isDark ? colors.card : '#FFFFFF' }, Shadows.soft]}>
            {isAccepted ? (
              <MessageCircle size={28} color="#10B981" strokeWidth={2.2} />
            ) : (
              <Bike size={28} color={colors.primary} strokeWidth={2.2} />
            )}
          </View>

          <Text
            style={[
              styles.heroTitle,
              {
                color: isAccepted
                  ? (isDark ? '#34D399' : '#065F46')
                  : (isDark ? '#FDA4AF' : '#9F1239'),
              },
            ]}
          >
            {isDeclined
              ? 'Errand cancelled'
              : isAccepted
              ? 'Dispatcher Ready!'
              : 'Finding a Dispatcher...'}
          </Text>

          <Text
            style={[
              styles.heroSubtitle,
              {
                color: isDeclined
                  ? (isDark ? '#FCA5A5' : '#B91C1C')
                  : isAccepted
                  ? (isDark ? '#A7F3D0' : '#047857')
                  : (isDark ? '#FECDD3' : '#BE123C'),
              },
            ]}
          >
            {isDeclined
              ? declineReason
                ? `Reason: ${declineReason}`
                : 'A dispatcher was unable to take this request on.'
              : isAccepted
              ? `${dispatcherName ?? 'A dispatcher'} has accepted your request and is ready to assist.`
              : 'Your errand is in the queue. A dispatcher typically responds within 2–5 minutes.'}
          </Text>

          {!isAccepted && !isDeclined && (
            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.waitingText, { color: isDark ? '#FDA4AF' : '#9F1239' }]}>
                Waiting for dispatcher to accept...
              </Text>
            </View>
          )}
        </View>

        {/* ── WHAT HAPPENS NEXT CARD ────────────────────────────────────── */}
        {!isAccepted && !isDeclined && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
            <Text style={[styles.cardTitle, { color: colors.textDark }]}>What Happens Next</Text>
            {FULFILLMENT_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <View key={`fulfillment-${idx}`} style={styles.fulfillmentRow}>
                  <View style={[styles.fulfillmentIconBox, { backgroundColor: `${step.color}18` }]}>
                    <StepIcon size={16} color={step.color} strokeWidth={2.2} />
                  </View>
                  <View style={styles.fulfillmentTextCol}>
                    <Text style={[styles.fulfillmentLabel, { color: colors.textDark }]}>
                      {`Step ${idx + 1} — ${step.label}`}
                    </Text>
                    <Text style={[styles.fulfillmentDesc, { color: colors.textGray }]}>
                      {step.desc}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── ERRAND SUMMARY CARD ───────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
          <View style={styles.cardTitleRow}>
            <FileText size={17} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.cardTitle, { color: colors.textDark }]}>Errand Summary</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textGray }]}>Errand ID:</Text>
            <Text style={[styles.infoValBold, { color: colors.primary }]}>
              {formatErrandId(errandId)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textGray }]}>Service:</Text>
            <Text style={[styles.infoVal, { color: colors.textDark }]}>Pabili (Personal Shopper)</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textGray }]}>Status:</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isAccepted
                    ? (isDark ? 'rgba(16,185,129,0.2)' : '#D1FAE5')
                    : (isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7'),
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: isAccepted
                      ? (isDark ? '#34D399' : '#065F46')
                      : (isDark ? '#FCD34D' : '#92400E'),
                  },
                ]}
              >
                {humanStatus(errandStatus)}
              </Text>
            </View>
          </View>

          <View style={[styles.fareNotice, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB', borderColor: colors.border }]}>
            <Text style={[styles.fareNoticeLabel, { color: colors.textGray }]}>Delivery Fare:</Text>
            <Text style={[styles.fareNoticeVal, { color: colors.textDark }]}>
              Pending Completion
            </Text>
          </View>
          <Text style={[styles.fareFootnote, { color: colors.textGray }]}>
            * Fare is collected upon rider delivery (Cash on Delivery)
          </Text>
        </View>

        {/* ── PRIMARY CTA: Chat ─────────────────────────────────────────── */}
        <TouchableOpacity
          testID={isDeclined ? 'place-new-errand-button' : 'open-chat-button'}
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
          onPress={() =>
            isDeclined
              ? navigation.navigate('ErrandForm', { user })
              : navigation.navigate('CustomerChat', { user, errandId })
          }
        >
          <View style={styles.btnRow}>
            {isDeclined ? (
              <RotateCcw size={18} color="#FFFFFF" strokeWidth={2.2} />
            ) : (
              <MessageCircle size={18} color="#FFFFFF" strokeWidth={2.2} />
            )}
            <Text style={styles.primaryBtnText}>
              {isDeclined
                ? 'Place a new errand'
                : isAccepted
                ? `Chat with ${dispatcherName ?? 'your dispatcher'}`
                : 'Open chat'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── SECONDARY CTA: Dashboard ──────────────────────────────────── */}
        <TouchableOpacity
          testID="back-to-dashboard-button"
          activeOpacity={0.8}
          style={[
            styles.secondaryBtn,
            {
              backgroundColor: 'transparent',
              borderColor: colors.border,
            },
          ]}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'CustomerPortal', params: { user } }] })
          }
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textGray }]}>
            Return to Dashboard
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg,
    textAlign: 'center',
  },
  navRightPlaceholder: {
    width: 36,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  // ── Stepper ────────────────────────────────────────────────────────────────
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotNum: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
  },
  stepLabel: {
    fontSize: FontSizes.xs - 1,
    textAlign: 'center',
    maxWidth: 64,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 1,
    minWidth: 20,
  },
  // ── Social Proof ────────────────────────────────────────────────────────────
  socialProofWrap: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  socialProofPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  socialProofText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
  },
  // ── Hero Card ───────────────────────────────────────────────────────────────
  heroCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  beaconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    width: 60,
    height: 60,
  },
  beaconRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    opacity: 0.4,
  },
  beaconCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  heroIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: 8,
  },
  waitingText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs,
  },
  // ── Cards ───────────────────────────────────────────────────────────────────
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  // ── Fulfillment Steps ────────────────────────────────────────────────────────
  fulfillmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  fulfillmentIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fulfillmentTextCol: {
    flex: 1,
    gap: 2,
  },
  fulfillmentLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
  fulfillmentDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    lineHeight: 17,
  },
  // ── Info Rows ────────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
  },
  infoLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
  },
  infoVal: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.sm,
  },
  infoValBold: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
  },
  fareNotice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  fareNoticeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
  },
  fareNoticeVal: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  fareFootnote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs - 1,
    marginBottom: 2,
  },
  // ── CTAs ─────────────────────────────────────────────────────────────────────
  primaryBtn: {
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.md,
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
});
