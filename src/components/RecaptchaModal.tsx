import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { ShieldCheck, Check, Lock, RefreshCw, X } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows } from '../config/theme';

interface RecaptchaModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
  title?: string;
  subtitle?: string;
}

export default function RecaptchaModal({
  visible,
  onClose,
  onSuccess,
  title = 'Security Verification',
  subtitle = 'Please verify that you are human before saving your updated account details.',
}: RecaptchaModalProps) {
  const { colors, isDark } = useThemeColor();
  const [isChecked, setIsChecked] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsChecked(false);
      setVerifying(false);
    }
  }, [visible]);

  const handleCheckboxPress = () => {
    if (isChecked || verifying) return;

    setVerifying(true);
    // Simulate reCAPTCHA token verification handshake
    setTimeout(() => {
      setVerifying(false);
      setIsChecked(true);
    }, 900);
  };

  const handleConfirm = () => {
    if (!isChecked) return;
    const mockToken = `recaptcha_v3_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    onSuccess(mockToken);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                Shadows.liftedUp,
              ]}
            >
              {/* CLOSE BUTTON */}
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={colors.textDark} />
              </TouchableOpacity>

              {/* HEADER BADGE */}
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight },
                ]}
              >
                <ShieldCheck size={28} color={colors.primary} />
              </View>

              <Text style={[styles.title, { color: colors.textDark }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: colors.textGray }]}>{subtitle}</Text>

              {/* RECAPTCHA BOX */}
              <View
                style={[
                  styles.recaptchaBox,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                    borderColor: isChecked ? '#10B981' : colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isChecked ? '#10B981' : colors.border,
                      backgroundColor: isChecked ? '#10B981' : 'transparent',
                    },
                  ]}
                  onPress={handleCheckboxPress}
                  disabled={isChecked || verifying}
                  activeOpacity={0.8}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : isChecked ? (
                    <Check size={16} color="#FFFFFF" strokeWidth={3} />
                  ) : null}
                </TouchableOpacity>

                <View style={styles.recaptchaTextContainer}>
                  <Text style={[styles.recaptchaLabel, { color: colors.textDark }]}>
                    {isChecked ? 'Verification Confirmed' : "I'm not a robot"}
                  </Text>
                  <Text style={[styles.recaptchaSub, { color: colors.textLight }]}>
                    Protected by reCAPTCHA Enterprise
                  </Text>
                </View>

                <View style={styles.logoCol}>
                  <View style={[styles.miniLogoBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
                    <Lock size={12} color={colors.textGray} />
                  </View>
                  <Text style={[styles.privacyText, { color: colors.textLight }]}>Privacy • Terms</Text>
                </View>
              </View>

              {/* ACTION BUTTONS */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textDark }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor: isChecked ? colors.primary : colors.textLight,
                      opacity: isChecked ? 1 : 0.6,
                    },
                    isChecked && Shadows.liftedUp,
                  ]}
                  onPress={handleConfirm}
                  disabled={!isChecked}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xl + 4,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 1,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  recaptchaBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recaptchaTextContainer: {
    flex: 1,
  },
  recaptchaLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  recaptchaSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs - 2,
    marginTop: 2,
  },
  logoCol: {
    alignItems: 'center',
  },
  miniLogoBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  privacyText: {
    fontFamily: FontFamily.regular,
    fontSize: 8,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  confirmBtn: {
    flex: 1.4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
});
