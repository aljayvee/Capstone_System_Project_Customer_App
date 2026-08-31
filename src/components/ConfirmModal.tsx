import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows } from '../config/theme';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Sign Out',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
  testID = 'confirm-modal',
}: ConfirmModalProps) {
  const { colors, isDark } = useThemeColor();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      testID={testID}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onCancel} />
        
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
          {/* TOP RIGHT CLOSE BUTTON */}
          <TouchableOpacity
            style={[styles.closeIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
            onPress={onCancel}
          >
            <X size={16} color={colors.textDark} />
          </TouchableOpacity>

          {/* TITLE & MESSAGE */}
          <Text style={[styles.title, { color: colors.textDark, marginTop: Spacing.xs }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textGray }]}>{message}</Text>

          {/* ACTION BUTTONS */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray, borderColor: colors.border }]}
              onPress={onCancel}
              disabled={loading}
              testID="confirm-modal-cancel"
            >
              <Text style={[styles.cancelBtnText, { color: colors.textDark }]}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.confirmBtn,
                { backgroundColor: destructive ? colors.danger : colors.primary },
                Shadows.soft,
                loading && { opacity: 0.7 },
              ]}
              onPress={onConfirm}
              disabled={loading}
              testID="confirm-modal-submit"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl + 4,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  closeIconBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xl,
    textAlign: 'center',
    marginBottom: Spacing.xs + 2,
  },
  message: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.sm,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  confirmBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
  },
});
