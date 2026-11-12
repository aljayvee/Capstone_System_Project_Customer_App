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
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Lock, AlertCircle, LogIn, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import { PortalFontSizeMultipliers, AuthFontSizes, scaledAuthFontSize, getAuthLineHeight, FontSizes, FontFamily, Spacing } from '../config/theme';

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
      setError('Enter your password to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // The wire key is `username`, and the backend accepts a username, an
      // email or a phone number in it - same contract LoginScreen posts under.
      // This used to send `identifier`, which the validator ignored.
      const username = user?.username || user?.email || user?.phone;
      const res = await apiClient.post('/customers/login', {
        username,
        password: password.trim(),
      });

      // respondWithAuth returns { message, user, token, refreshToken, sessionId }.
      // This used to read res.data.customer, which is never set, so even a
      // correct password fell through to the error below.
      if (res.data?.user && res.data?.token) {
        await login(res.data.user, res.data.token, res.data.refreshToken);
        setPassword('');
        onSuccess?.();
      } else {
        throw new Error('SIGN_IN_RESPONSE_INCOMPLETE');
      }
    } catch (err: any) {
      setError(toUserMessage(err, 'login'));
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
        {/* Padding by the keyboard's height re-centres the card in the space
            left above it, so the password field is never underneath. */}
        <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
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
            <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
              Still you?
            </Text>
            <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.description, { color: colors.textGray }]}>
              You have been away a while. Enter your password to pick up exactly where you left off.
            </Text>

            {/* User Chip */}
            <View style={[styles.userChip, { backgroundColor: colors.bgGray, borderColor: colors.border }]}>
              <View style={[styles.avatarBadge, { backgroundColor: colors.border }]}>
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.avatarText, { color: colors.textDark }]}>
                  {user?.firstName?.[0] || user?.name?.[0] || 'C'}
                </Text>
              </View>
              <View style={styles.userTextCol}>
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.userName, { color: colors.textDark }]} numberOfLines={1}>
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.name || 'Customer'}
                </Text>
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.userSub, { color: colors.textLight }]} numberOfLines={1}>
                  {user?.phone || user?.email || 'Logged in'}
                </Text>
              </View>
            </View>

            {/* Input */}
            <View style={styles.formGroup}>
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.label, { color: colors.textDark }]}>Password</Text>
              <TextInput
                maxFontSizeMultiplier={PortalFontSizeMultipliers.input}
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
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* CTAs */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleFullLogout}
                style={[styles.secondaryButton, { borderColor: colors.border }]}
              >
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.secondaryButtonText, { color: colors.textGray }]}>Sign Out</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleReAuth}
                disabled={isLoading}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <>
                    <LogIn size={15} color={colors.onPrimary} />
                    <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Resume</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xxl), 'heading'),
    fontSize: scaledAuthFontSize(AuthFontSizes.xxl),
    fontFamily: FontFamily.bold,
  },
  description: {
    fontSize: scaledAuthFontSize(AuthFontSizes.base),
    fontFamily: FontFamily.regular,
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.base), 'body'),
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
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.base), 'body'),
    fontSize: scaledAuthFontSize(AuthFontSizes.base),
    fontFamily: FontFamily.semibold,
  },
  userSub: {
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'label'),
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    fontFamily: FontFamily.regular,
  },
  formGroup: {
    gap: 4,
  },
  label: {
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    fontFamily: FontFamily.semibold,
  },
  input: {
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.base), 'body'),
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: scaledAuthFontSize(AuthFontSizes.base),
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
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.base), 'body'),
    fontSize: scaledAuthFontSize(AuthFontSizes.base),
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
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.md), 'body'),
    fontSize: scaledAuthFontSize(AuthFontSizes.md),
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
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.md), 'body'),
    color: '#FFFFFF',
    fontSize: scaledAuthFontSize(AuthFontSizes.md),
    fontFamily: FontFamily.bold,
  },
});

export default SessionExpiredSheet;
