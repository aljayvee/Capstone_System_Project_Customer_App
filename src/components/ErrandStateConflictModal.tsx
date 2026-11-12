import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { RefreshCw, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, FontFamily, Spacing } from '../config/theme';

interface ErrandStateConflictModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onSync: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const ErrandStateConflictModal: React.FC<ErrandStateConflictModalProps> = ({
  visible,
  title = 'Your dispatcher changed this errand',
  message = 'The details or price moved while you were looking. Load the latest before you continue.',
  onSync,
  onCancel,
  isLoading = false,
}) => {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconBox, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
            <AlertTriangle size={24} color={colors.warning} />
          </View>

          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.title, { color: colors.textDark }]}>{title}</Text>
          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.message, { color: colors.textGray }]}>{message}</Text>

          <View style={styles.buttonRow}>
            {onCancel && (
              <TouchableOpacity
                onPress={onCancel}
                style={[styles.cancelButton, { borderColor: colors.border }]}
              >
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.cancelText, { color: colors.textGray }]}>Dismiss</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onSync}
              disabled={isLoading}
              style={[styles.syncButton, { backgroundColor: colors.primary }]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <RefreshCw size={15} color={colors.onPrimary} />
                  <Text style={[styles.syncButtonText, { color: colors.onPrimary }]} maxFontSizeMultiplier={1.15}>Show me the latest</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.title), 'heading'),
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.semibold,
  },
  syncButton: {
    flex: 1.2,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  syncButtonText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.bold,
  },
});

export default ErrandStateConflictModal;
