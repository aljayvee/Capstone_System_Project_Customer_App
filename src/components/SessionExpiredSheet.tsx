import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Lock, AlertCircle, LogIn, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/apiClient';
import { FontSizes, FontFamily, Spacing } from '../config/theme';

interface SessionExpiredSheetProps {
  visible: boolean;
  onSuccess?: () => void;
  onDismiss?: () => void;
}

export const SessionExpiredSheet: React.FC<SessionExpiredSheetProps> = ({
  visible,
  onSuccess,
  onDismiss,
}) => {
  const { user, login, logout } = useAuth();
  const { colors, isDark } = useTheme();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!visible) return null;

  const handleReAuth = async () => {
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const identifier = user?.phone || user?.email || user?.username;
      const res = await apiClient.post('/customers/login', {
        identifier,
        password: password.trim(),
      });

      if (res.data?.customer && res.data?.token) {
        await login(res.data.customer, res.data.token, res.data.refreshToken);
        setPassword('');
        onSuccess?.();
      } else {
        throw new Error('Authentication response invalid.');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Sign-in failed. Please verify your password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullLogout = async () => {
    await logout();
    onDismiss?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleFullLogout}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.bgGray, borderColor: colors.border }]}>
                <Lock size={20} color={colors.textDark} />
              </View>
              <TouchableOpacity
                onPress={handleFullLogout}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.closeButton, { backgroundColor: colors.bgGray }]}
              >
                <X size={16} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            {/* Title & Context */}
            <Text style={[styles.title, { color: colors.textDark }]}>Session Paused</Text>
            <Text style={[styles.description, { color: colors.textGray }]}>
              Your session timed out for your account security. Please verify your password to keep your draft and continue.
            </Text>

            {/* User Chip */}
            <View style={[styles.userChip, { backgroundColor: colors.bgGray, borderColor: colors.border }]}>
              <View style={[styles.avatarBadge, { backgroundColor: colors.border }]}>
                <Text style={[styles.avatarText, { color: colors.textDark }]}>
                  {user?.firstName?.[0] || user?.name?.[0] || 'C'}
                </Text>
              </View>
              <View style={styles.userTextCol}>
                <Text style={[styles.userName, { color: colors.textDark }]} numberOfLines={1}>
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.name || 'Customer'}
                </Text>
                <Text style={[styles.userSub, { color: colors.textLight }]} numberOfLines={1}>
                  {user?.phone || user?.email || 'Logged in'}
                </Text>
              </View>
            </View>

            {/* Input */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.textDark }]}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter password"
                placeholderTextColor={colors.textLight}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgWhite,
                    borderColor: colors.border,
                    color: colors.textDark,
                  },
                ]}
              />
            </View>

            {/* Error banner */}
            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <AlertCircle size={13} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* CTAs */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleFullLogout}
                style={[styles.secondaryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textGray }]}>Sign Out</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleReAuth}
                disabled={isLoading}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <LogIn size={15} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Resume</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
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
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSizes.lg,
    fontFamily: FontFamily.bold,
  },
  description: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSizes.sm,
    fontFamily: FontFamily.bold,
  },
  userTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.semibold,
  },
  userSub: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
  },
  formGroup: {
    gap: 4,
  },
  label: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.semibold,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.sm,
    fontFamily: FontFamily.regular,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.semibold,
  },
  primaryButton: {
    flex: 1.3,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.bold,
  },
});

export default SessionExpiredSheet;
