import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import InlineFieldError from '../components/InlineFieldError';
import { useAuth } from '../context/AuthContext';
import { FontFamily, FontSizes, Spacing, BorderRadius, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { RootStackScreenProps } from '../navigation/types';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen({ route, navigation }: RootStackScreenProps<'VerifyEmail'>) {
  const { login } = useAuth();
  const { colors, isDark } = useThemeColor();
  const { customerId, email, pendingUser, pendingToken, pendingRefreshToken } = route.params;

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Inline rather than Alert.alert. A native dialog for a wrong digit makes a
  // typo feel like a fault, and it used to print the raw axios message.
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Enter all 6 digits');
      return;
    }
    setError(null);
    setNotice(null);
    setIsVerifying(true);
    try {
      await apiClient.post('/customers/verify-email', { customerId, code: code.trim() });
      // Only now do we complete the authenticated swap — see RegisterScreen.tsx's note.
      await login(pendingUser, pendingToken, pendingRefreshToken);
    } catch (err: any) {
      setError(toUserMessage(err, 'otp'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setIsResending(true);
    try {
      await apiClient.post('/customers/resend-verification-email', { customerId });
      setNotice('New code sent. Check your email.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(toUserMessage(err, 'otp'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    // The content is centred, which put the Verify button under the number pad.
    // Padding by the keyboard's height re-centres it in the space left above.
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: colors.bgApp }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.primary }]} maxFontSizeMultiplier={1.15}>Verify Your Email</Text>
        <Text style={[styles.subtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
          We sent a 6-digit code to {email}. Enter it below to finish creating your account.
        </Text>

        <TextInput
          style={[
            styles.codeInput,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textDark,
            },
          ]}
          placeholder="000000"
          placeholderTextColor={colors.textLight}
          value={code}
          onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          maxFontSizeMultiplier={1.15}
          testID="verification-code-input"
        />

        <InlineFieldError error={error} />
        {notice && !error ? (
          <Text style={[styles.notice, { color: colors.success }]} maxFontSizeMultiplier={1.2}>
            {notice}
          </Text>
        ) : null}

        <TouchableOpacity
          testID="verify-code-button"
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText} maxFontSizeMultiplier={1.15}>Verify Code</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          testID="resend-code-button"
          onPress={handleResend}
          disabled={isResending || cooldown > 0}
          style={styles.resendButton}
        >
          <Text
            style={[
              styles.linkText,
              { color: colors.primary },
              (isResending || cooldown > 0) && { color: colors.textLight },
            ]}
            maxFontSizeMultiplier={1.15}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : isResending ? 'Sending...' : "Didn't get a code? Resend"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    padding: Spacing.xl,
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: scaledFontSize(22, 0.2),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  notice: {
    fontSize: FontSizes.sm,
    fontFamily: FontFamily.medium,
    marginTop: 4,
  },
  codeInput: {
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    fontSize: scaledFontSize(22, 0.2),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    minHeight: moderateScale(50, 0.2),
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.base, 0.2),
  },
  resendButton: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  linkText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
});
