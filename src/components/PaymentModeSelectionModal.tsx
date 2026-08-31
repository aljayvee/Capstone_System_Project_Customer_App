import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { X, ShieldCheck } from 'lucide-react-native';
import { apiClient } from '../services/apiClient';
import { PaymentMethodTile } from './PaymentMethodTile';
import { PAYMENT_METHODS, type PaymentMethodId } from '../services/paymentMethodStrategy';
import { canTransition, type PaymentSelectionState } from '../services/paymentSelectionState';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';

interface BackendPaymentMode {
  id: number;
  name: string;
  status: 'Active' | 'Inactive';
}

interface PaymentModeSelectionModalProps {
  visible: boolean;
  errandId: string;
  onClose: () => void;
  onConfirmed: (methodLabel: string) => void;
}

export const PaymentModeSelectionModal: React.FC<PaymentModeSelectionModalProps> = ({
  visible,
  errandId,
  onClose,
  onConfirmed,
}) => {
  const [state, setState] = useState<PaymentSelectionState>('PROMPTED');
  const [selectedId, setSelectedId] = useState<PaymentMethodId | null>(null);
  const [backendModes, setBackendModes] = useState<BackendPaymentMode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setState('SELECTING');
    setSelectedId(null);
    setError(null);

    apiClient
      .get<BackendPaymentMode[]>('/payment-modes')
      .then((res) => setBackendModes(res.data ?? []))
      .catch(() => setError('Could not load payment modes. Please try again.'));
  }, [visible]);

  const transitionTo = (target: PaymentSelectionState) => {
    if (!canTransition(state, target)) return;
    setState(target);
  };

  const handleSelectTile = (methodId: PaymentMethodId) => {
    const method = PAYMENT_METHODS.find((m) => m.id === methodId);
    if (!method?.available) return;
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
      setError('This payment method is not ready yet.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/errands/${errandId}/payment-selection`, { paymentModeId: backendMode.id });
      transitionTo('CONFIRMED');
      onConfirmed(method.label);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not confirm payment mode. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === selectedId);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ShieldCheck size={18} color={Colors.primary} strokeWidth={2.2} />
              <Text style={styles.title} maxFontSizeMultiplier={1.25}>
                {state === 'CONFIRMING' ? 'Confirm Payment Mode' : 'Select Payment Mode'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} testID="payment-modal-close">
              <X size={20} color={Colors.textGray} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>
            {state === 'CONFIRMING'
              ? 'This is for verification only — no payment is being processed right now.'
              : 'Choose how you plan to pay. This is for verification only.'}
          </Text>

          {state === 'CONFIRMING' && selectedMethod ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmLabel} maxFontSizeMultiplier={1.2}>You selected:</Text>
              <Text style={styles.confirmValue} maxFontSizeMultiplier={1.25}>{selectedMethod.label}</Text>
              <Text style={styles.confirmQuestion} maxFontSizeMultiplier={1.2}>Is this final, or would you like to choose again?</Text>

              {error && <Text style={styles.errorText} maxFontSizeMultiplier={1.2}>{error}</Text>}

              <View style={styles.confirmActions}>
                <TouchableOpacity
                  testID="payment-choose-again"
                  style={styles.secondaryBtn}
                  onPress={handleChooseAgain}
                  disabled={isSubmitting}
                >
                  <Text style={styles.secondaryBtnText} maxFontSizeMultiplier={1.2}>Choose Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="payment-confirm-final"
                  style={styles.primaryBtn}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={Colors.textWhite} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.2}>Yes, This Is Final</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {PAYMENT_METHODS.map((method) => (
                <PaymentMethodTile
                  key={method.id}
                  method={method}
                  selected={selectedId === method.id}
                  onPress={() => handleSelectTile(method.id)}
                />
              ))}
              {error && <Text style={styles.errorText} maxFontSizeMultiplier={1.2}>{error}</Text>}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgWhite,
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
  title: { fontSize: scaledFontSize(FontSizes.md, 0.2), fontWeight: FontWeights.bold, color: Colors.textDark },
  subtitle: { fontSize: scaledFontSize(FontSizes.xs, 0.2), color: Colors.textGray, marginBottom: Spacing.md },
  confirmBox: { backgroundColor: Colors.bgGray, borderRadius: BorderRadius.md, padding: Spacing.md },
  confirmLabel: { fontSize: scaledFontSize(FontSizes.xs, 0.2), color: Colors.textGray },
  confirmValue: { fontSize: scaledFontSize(FontSizes.lg, 0.2), fontWeight: FontWeights.extrabold, color: Colors.primary, marginTop: 2, marginBottom: Spacing.xs },
  confirmQuestion: { fontSize: scaledFontSize(FontSizes.xs + 1, 0.2), color: Colors.textMedium, marginBottom: Spacing.sm },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  secondaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  secondaryBtnText: { color: Colors.textMedium, fontWeight: FontWeights.semibold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  primaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  primaryBtnText: { color: Colors.textWhite, fontWeight: FontWeights.bold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  errorText: { color: Colors.danger, fontSize: scaledFontSize(FontSizes.xs, 0.2), marginTop: Spacing.xs },
});
