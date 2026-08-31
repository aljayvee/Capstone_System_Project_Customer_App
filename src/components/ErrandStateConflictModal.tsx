import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { RefreshCw, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { FontSizes, FontFamily, Spacing } from '../config/theme';

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
  title = 'Order Updated by Dispatcher',
  message = 'The order details or pricing were modified while you were reviewing. Please refresh to load the latest changes.',
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

          <Text style={[styles.title, { color: colors.textDark }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textGray }]}>{message}</Text>

          <View style={styles.buttonRow}>
            {onCancel && (
              <TouchableOpacity
                onPress={onCancel}
                style={[styles.cancelButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelText, { color: colors.textGray }]}>Dismiss</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onSync}
              disabled={isLoading}
              style={[styles.syncButton, { backgroundColor: colors.primary }]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <RefreshCw size={15} color="#FFFFFF" />
                  <Text style={styles.syncButtonText}>Sync Latest</Text>
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
    fontSize: FontSizes.md,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
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
    fontSize: FontSizes.xs,
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
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.bold,
  },
});

export default ErrandStateConflictModal;
