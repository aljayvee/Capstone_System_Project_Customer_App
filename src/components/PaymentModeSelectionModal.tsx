import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { apiClient } from '../services/apiClient';
import { RETRY_LABEL, toUserMessage } from '../services/errorMessages';
import { PaymentMethodTile } from './PaymentMethodTile';
import {
  PAYMENT_METHODS,
  isMethodAvailable,
  labelForMode,
  offeredMethods,
  type PaymentMethodId,
} from '../services/paymentMethodStrategy';
import { canTransition, type PaymentSelectionState } from '../services/paymentSelectionState';
import { FontSizes, FontWeights, Spacing, BorderRadius, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';

interface BackendPaymentMode {
  id: number;
  name: string;
  status: 'Active' | 'Inactive';
}

interface PaymentModeSelectionModalProps {
  visible: boolean;
  errandId: string;
  /**
   * The way to pay is settled. `wasAlreadyChosen`: it was on record before
   * (chosen before a restart, or on another phone), not chosen just now.
   */
  onConfirmed: (methodLabel: string, opts?: { wasAlreadyChosen?: boolean }) => void;
}

/** The way to pay already on record for this errand, if any. */
async function fetchChosenMode(errandId: string): Promise<string | null> {
  const res = await apiClient.get<{ paymentMode?: { name?: string } } | null>(
    `/errands/${errandId}/payment-selection`
  );
  return res.data?.paymentMode?.name ?? null;
}

/**
 * Choosing how to pay, the step right after approving the order (2026-10-15).
 *
 * It cannot be dismissed: no close button, and Android's back does nothing. An
 * approved order without a way to pay cannot get a rider, so the only way out
 * is through. If the app is closed anyway, the order summary's button reads
 * "Choose payment method" and opens this again.
 */
export const PaymentModeSelectionModal: React.FC<PaymentModeSelectionModalProps> = ({
  visible,
  errandId,
  onConfirmed,
}) => {
  const { colors, isDark } = useThemeColor();
  const [state, setState] = useState<PaymentSelectionState>('PROMPTED');
  const [selectedId, setSelectedId] = useState<PaymentMethodId | null>(null);
  const [backendModes, setBackendModes] = useState<BackendPaymentMode[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The options, and whether a way to pay is already on record: chosen before
  // a restart, or on another phone. Then there is nothing to ask.
  const load = useCallback(() => {
    setLoadState('loading');
    setError(null);
    let cancelled = false;
    Promise.all([
      apiClient.get<BackendPaymentMode[]>('/payment-modes'),
      fetchChosenMode(errandId).catch(() => null),
    ])
      .then(([modes, chosen]) => {
        if (cancelled) return;
        if (chosen) {
          onConfirmed(labelForMode(chosen), { wasAlreadyChosen: true });
          return;
        }
        setBackendModes(modes.data ?? []);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('failed');
        setError("We couldn't load your payment options.");
      });
    return () => {
      cancelled = true;
    };
  }, [errandId, onConfirmed]);

  useEffect(() => {
    if (!visible) return;
    setState('SELECTING');
    setSelectedId(null);
    return load();
    // Once per opening; onConfirmed changing identity must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, errandId]);

  const transitionTo = (target: PaymentSelectionState) => {
    if (!canTransition(state, target)) return;
    setState(target);
  };

  const handleSelectTile = (methodId: PaymentMethodId) => {
    const method = PAYMENT_METHODS.find((m) => m.id === methodId);
    // Availability is the server's, read from the catalogue this modal already
    // fetched. paymentSelectionService re-checks it on submit, so the two can
    // only disagree if this line is wrong.
    if (!method || !isMethodAvailable(method, backendModes)) return;
    setSelectedId(methodId);
    setError(null);
    transitionTo('CONFIRMING');
  };

  const handleChooseAgain = () => {
    setSelectedId(null);
    transitionTo('SELECTING');
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    const method = PAYMENT_METHODS.find((m) => m.id === selectedId);
    const backendMode = backendModes.find((m) => m.name === method?.backendName);
    if (!method || !backendMode) {
      setError('This payment method is not available yet.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/errands/${errandId}/payment-selection`, { paymentModeId: backendMode.id });
      transitionTo('CONFIRMED');
      onConfirmed(method.label);
    } catch (err) {
      // Refused because one is already on record, usually this same choice
      // whose answer was lost (a double tap, a dropped connection): that one
      // stands, so this is done rather than stuck.
      const chosen = await fetchChosenMode(errandId).catch(() => null);
      if (chosen) {
        onConfirmed(labelForMode(chosen));
        return;
      }
      setError(toUserMessage(err, 'payment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === selectedId);
  const methods = offeredMethods(backendModes);

  return (
    // onRequestClose is required on Android and does nothing on purpose: back
    // must not leave an approved order without a way to pay.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]} testID="payment-modal">
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ShieldCheck size={18} color={colors.primary} strokeWidth={2.2} />
              <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
                {state === 'CONFIRMING' ? 'Confirm payment method' : 'Choose payment method'}
              </Text>
            </View>
          </View>

          <Text style={[styles.subtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
            {state === 'CONFIRMING'
              ? 'No payment is taken right now. You pay when your items arrive.'
              : 'Your order is approved. Choose how you will pay so your dispatcher can assign a rider.'}
          </Text>

          {state === 'CONFIRMING' && selectedMethod ? (
            <View style={[styles.confirmBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray }]}>
              <Text style={[styles.confirmLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>You selected:</Text>
              <Text style={[styles.confirmValue, { color: colors.primary }]} maxFontSizeMultiplier={1.25}>{selectedMethod.label}</Text>
              <Text style={[styles.confirmQuestion, { color: colors.textMedium }]} maxFontSizeMultiplier={1.2}>Is this final, or would you like to choose again?</Text>

              {error && <Text style={[styles.errorText, { color: colors.danger }]} maxFontSizeMultiplier={1.2}>{error}</Text>}

              <View style={styles.confirmActions}>
                <TouchableOpacity
                  testID="payment-choose-again"
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  onPress={handleChooseAgain}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.textMedium }]} maxFontSizeMultiplier={1.2}>Choose again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="payment-confirm-final"
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.2}>Yes, this is final</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : loadState === 'loading' ? (
            <View style={styles.loadingBox} testID="payment-modes-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : loadState === 'failed' || methods.length === 0 ? (
            <View style={styles.failedBox}>
              <Text style={[styles.errorText, { color: colors.danger }]} maxFontSizeMultiplier={1.2}>
                {error ?? 'No payment options are open right now.'}
              </Text>
              <TouchableOpacity
                testID="payment-modes-retry"
                style={[styles.secondaryBtn, { borderColor: colors.border, flex: 0 }]}
                onPress={() => load()}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textMedium }]} maxFontSizeMultiplier={1.2}>
                  {RETRY_LABEL}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {methods.map((method) => (
                <PaymentMethodTile
                  key={method.id}
                  method={method}
                  available={isMethodAvailable(method, backendModes)}
                  selected={selectedId === method.id}
                  onPress={() => handleSelectTile(method.id)}
                />
              ))}
              {error && <Text style={[styles.errorText, { color: colors.danger }]} maxFontSizeMultiplier={1.2}>{error}</Text>}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: scaledFontSize(FontSizes.md, 0.2), fontWeight: FontWeights.bold },
  subtitle: { fontSize: scaledFontSize(FontSizes.xs, 0.2), marginBottom: Spacing.md },
  confirmBox: { borderRadius: BorderRadius.md, padding: Spacing.md },
  confirmLabel: { fontSize: scaledFontSize(FontSizes.xs, 0.2) },
  confirmValue: { fontSize: scaledFontSize(FontSizes.lg, 0.2), fontWeight: FontWeights.extrabold, marginTop: 2, marginBottom: Spacing.xs },
  confirmQuestion: { fontSize: scaledFontSize(FontSizes.xs + 1, 0.2), marginBottom: Spacing.sm },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  secondaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  secondaryBtnText: { fontWeight: FontWeights.semibold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  primaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: FontWeights.bold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  errorText: { fontSize: scaledFontSize(FontSizes.xs, 0.2), marginTop: Spacing.xs },
  loadingBox: { paddingVertical: Spacing.xl, alignItems: 'center' },
  failedBox: { gap: Spacing.sm, paddingVertical: Spacing.sm },
});
