import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle2, Trash2, Lock } from 'lucide-react-native';
import TrueNativeModal from './transitions/TrueNativeModal';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows } from '../config/theme';

export type ModalVariant = 'confirm' | 'info' | 'error' | 'warning' | 'success';
export type ModalIcon = 'info' | 'error' | 'warning' | 'success' | 'trash' | 'lock' | null;

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  singleButton?: boolean;
  variant?: ModalVariant;
  icon?: ModalIcon;
  primaryButton?: 'confirm' | 'cancel';
  buttonLayout?: 'horizontal' | 'vertical';
  onConfirm: () => void;
  onCancel?: () => void;
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
  singleButton = false,
  variant,
  icon,
  primaryButton = 'confirm',
  buttonLayout = 'horizontal',
  onConfirm,
  onCancel,
  testID = 'confirm-modal',
}: ConfirmModalProps) {
  const { colors, isDark } = useThemeColor();
  const isCancelPrimary = primaryButton === 'cancel';
  const isVertical = buttonLayout === 'vertical';
  const effectiveConfirmLabel = singleButton && confirmLabel === 'Sign Out' ? 'OK' : confirmLabel;
  const handleDismiss = onCancel || onConfirm;

  const primaryBtnStyle = [
    styles.btnBase,
    styles.primaryBtn,
    {
      backgroundColor:
        isCancelPrimary || !destructive ? colors.primary : colors.danger,
    },
    Shadows.soft,
    loading && { opacity: 0.7 },
  ];

  const secondaryBtnStyle = [
    styles.btnBase,
    styles.secondaryBtn,
    {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
    },
  ];

  const renderCancelButton = () => (
    <TouchableOpacity
      activeOpacity={0.82}
      style={isCancelPrimary ? primaryBtnStyle : secondaryBtnStyle}
      onPress={onCancel}
      disabled={loading}
      testID="confirm-modal-cancel"
      accessibilityRole="button"
      accessibilityLabel={cancelLabel}
    >
      <Text
        style={[
          styles.btnTextBase,
          isCancelPrimary
            ? styles.primaryBtnText
            : [styles.secondaryBtnText, { color: isDark ? 'rgba(255,255,255,0.70)' : colors.textGray }],
        ]}
      >
        {cancelLabel}
      </Text>
    </TouchableOpacity>
  );

  const renderIcon = () => {
    const resolvedIcon =
      icon !== undefined
        ? icon
        : variant === 'error'
        ? 'error'
        : variant === 'warning'
        ? 'warning'
        : variant === 'success'
        ? 'success'
        : variant === 'info'
        ? 'info'
        : destructive && variant === 'confirm'
        ? 'trash'
        : null;

    if (!resolvedIcon) return null;

    let IconComp = Info;
    let iconColor = colors.primary;
    let iconBg = isDark ? 'rgba(246, 36, 89, 0.15)' : 'rgba(246, 36, 89, 0.08)';

    if (resolvedIcon === 'trash' || resolvedIcon === 'error') {
      IconComp = resolvedIcon === 'trash' ? Trash2 : AlertCircle;
      iconColor = colors.danger;
      iconBg = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)';
    } else if (resolvedIcon === 'warning') {
      IconComp = AlertTriangle;
      iconColor = isDark ? '#FBBF24' : '#D97706';
      iconBg = isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(217, 119, 6, 0.08)';
    } else if (resolvedIcon === 'success') {
      IconComp = CheckCircle2;
      iconColor = isDark ? '#34D399' : '#059669';
      iconBg = isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(5, 150, 105, 0.08)';
    } else if (resolvedIcon === 'lock') {
      IconComp = Lock;
      iconColor = colors.primary;
      iconBg = isDark ? 'rgba(246, 36, 89, 0.15)' : 'rgba(246, 36, 89, 0.08)';
    } else if (resolvedIcon === 'info') {
      IconComp = Info;
      iconColor = isDark ? '#38BDF8' : '#0284C7';
      iconBg = isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.08)';
    }

    return (
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <IconComp size={24} color={iconColor} strokeWidth={2} />
      </View>
    );
  };

  const renderConfirmButton = () => (
    <TouchableOpacity
      activeOpacity={0.82}
      style={isCancelPrimary ? secondaryBtnStyle : primaryBtnStyle}
      onPress={onConfirm}
      disabled={loading}
      testID="confirm-modal-submit"
      accessibilityRole="button"
      accessibilityLabel={effectiveConfirmLabel}
    >
      {loading ? (
        <ActivityIndicator
          color={isCancelPrimary ? (isDark ? '#FFFFFF' : colors.textDark) : '#FFFFFF'}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.btnTextBase,
            isCancelPrimary
              ? [styles.secondaryBtnText, { color: isDark ? 'rgba(255,255,255,0.70)' : colors.textGray }]
              : styles.primaryBtnText,
          ]}
        >
          {effectiveConfirmLabel}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <TrueNativeModal
      visible={visible}
      onClose={handleDismiss}
      testID={testID}
      containerStyle={{ paddingHorizontal: Spacing.lg }}
    >
      <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
        {/* TOP RIGHT CLOSE BUTTON */}
        <TouchableOpacity
          style={[styles.closeIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
          onPress={handleDismiss}
        >
          <X size={16} color={colors.textDark} />
        </TouchableOpacity>

        {/* STATUS ICON */}
        {renderIcon()}

        {/* TITLE & MESSAGE */}
        <Text style={[styles.title, { color: colors.textDark, marginTop: Spacing.xs }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.textGray }]}>{message}</Text>

        {/* ACTION BUTTONS */}
        <View style={[styles.buttonContainer, singleButton ? styles.buttonRow : isVertical ? styles.buttonColumn : styles.buttonRow]}>
          {singleButton ? (
            renderConfirmButton()
          ) : isVertical ? (
            isCancelPrimary ? (
              <>
                {renderCancelButton()}
                {renderConfirmButton()}
              </>
            ) : (
              <>
                {renderConfirmButton()}
                {renderCancelButton()}
              </>
            )
          ) : (
            isCancelPrimary ? (
              <>
                {renderConfirmButton()}
                {renderCancelButton()}
              </>
            ) : (
              <>
                {renderCancelButton()}
                {renderConfirmButton()}
              </>
            )
          )}
        </View>
      </View>
    </TrueNativeModal>
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
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
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
  buttonContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: Spacing.sm + 2,
  },
  btnBase: {
    minHeight: 46,
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  primaryBtn: {
    borderWidth: 0,
  },
  secondaryBtn: {
    borderWidth: 1,
  },
  btnTextBase: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  secondaryBtnText: {
    fontFamily: FontFamily.semibold,
  },
});
