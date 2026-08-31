import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { Colors, FontFamily, FontSizes, Spacing, BorderRadius, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { RootStackScreenProps } from '../navigation/types';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen({ route, navigation }: RootStackScreenProps<'VerifyEmail'>) {
  const { login } = useAuth();
  const { customerId, email, pendingUser, pendingToken, pendingRefreshToken } = route.params;

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Enter the 6-digit code sent to your email.');
      return;
    }
    setIsVerifying(true);
    try {
      await apiClient.post('/customers/verify-email', { customerId, code: code.trim() });
      // Only now do we complete the authenticated swap — see RegisterScreen.tsx's note.
      await login(pendingUser, pendingToken, pendingRefreshToken);
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await apiClient.post('/customers/resend-verification-email', { customerId });
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      Alert.alert('Could Not Resend', error.message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.title} maxFontSizeMultiplier={1.15}>Verify Your Email</Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.15}>
          We sent a 6-digit code to {email}. Enter it below to finish creating your account.
        </Text>

        <TextInput
          style={styles.codeInput}
          placeholder="000000"
          placeholderTextColor="#9CA3AF"
          value={code}
          onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          maxFontSizeMultiplier={1.15}
          testID="verification-code-input"
        />

        <TouchableOpacity
          testID="verify-code-button"
          style={styles.button}
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
            style={[styles.linkText, (isResending || cooldown > 0) && styles.linkTextDisabled]}
            maxFontSizeMultiplier={1.15}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : isResending ? 'Sending...' : "Didn't get a code? Resend"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F8F8',
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
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.regular,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  codeInput: {
    backgroundColor: '#FFFFFF',
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    color: Colors.textDark,
    fontSize: scaledFontSize(22, 0.2),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    backgroundColor: Colors.primary,
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
    color: Colors.primary,
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
  linkTextDisabled: {
    color: '#9CA3AF',
  },
});
