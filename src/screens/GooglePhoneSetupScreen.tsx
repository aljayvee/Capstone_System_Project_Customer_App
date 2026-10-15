import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ChevronLeft, Phone, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  Shadows,
  AuthFontSizeMultipliers,
  scaledFontSize,
} from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import type { RootStackScreenProps } from '../navigation/types';

export default function GooglePhoneSetupScreen({
  navigation,
  route,
}: RootStackScreenProps<'GooglePhoneSetup'>) {
  const { googleIdToken, email, firstName, lastName, avatar } = route.params;
  const { login } = useAuth();
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanPhone = phone.replace(/\D/g, '');
  const isPhone10Digits = cleanPhone.length === 10 && cleanPhone.startsWith('9');
  const isPhoneVerified = Boolean(phoneToken);

  const handleVerifyPhone = async () => {
    Keyboard.dismiss();
    setError(null);

    if (!isPhone10Digits) {
      setError('Please enter a valid 10-digit Philippine mobile number starting with 9.');
      return;
    }

    setVerifyingPhone(true);
    try {
      const fullPhone = `+63${cleanPhone}`;
      const verifyUrl = `https://portal.sugo-express.org/verify-phone?phone=${encodeURIComponent(
        fullPhone
      )}&redirect=${encodeURIComponent('customerapp://phone-verified')}`;

      const result = await WebBrowser.openAuthSessionAsync(
        verifyUrl,
        'customerapp://phone-verified'
      );

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const token = parsed.queryParams?.token as string;
        if (token) {
          setPhoneToken(token);
          setError(null);
        } else {
          setError('Verification could not be confirmed. Please try again.');
        }
      }
    } catch (err: any) {
      console.warn('[GooglePhoneSetup] Verification error:', err);
      setError('Failed to open phone verification. Please check your internet connection.');
    } finally {
      setVerifyingPhone(false);
    }
  };

  const handleCompleteSetup = async () => {
    Keyboard.dismiss();
    setError(null);

    if (!isPhoneVerified || !phoneToken) {
      setError('Please verify your mobile number before proceeding.');
      return;
    }

    setSubmitting(true);
    try {
      const fullPhone = `+63${cleanPhone}`;
      const response = await apiClient.post('/customers/google-register', {
        idToken: googleIdToken,
        phone: fullPhone,
        phoneToken,
        firstName,
        lastName,
        avatar: avatar || undefined,
      });

      const data = response.data;
      const userPayload = data.user || data;

      await AsyncStorage.setItem('@sugo_customer_onboarding_completed', 'true');
      await AsyncStorage.setItem('@sugo_pending_onboarding_location_setup', 'true');
      const detLoc = (route as any)?.params?.detectedLocation;
      if (detLoc) {
        try {
          await AsyncStorage.setItem('@sugo_onboarding_location_draft', JSON.stringify(detLoc));
        } catch {}
      }
      await login(userPayload, data.token, data.refreshToken);
      navigation.replace('CustomerPortal', {
        user: userPayload,
        triggerOnboardingLocationSetup: true,
        detectedLocation: detLoc,
      });
    } catch (err: any) {
      setError(toUserMessage(err, 'register'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputFill = isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7';
  const inputHairline = isDark ? 'rgba(255,255,255,0.08)' : '#ECEDF0';

  return (
    <View style={[styles.root, { backgroundColor: colors.card, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* User Identity Preview Card */}
        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
              borderColor: inputHairline,
            },
          ]}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitials}>
                {(firstName?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.identityDetails}>
            <Text
              style={[styles.identityName, { color: colors.textDark }]}
              numberOfLines={1}
              maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}
            >
              {firstName} {lastName}
            </Text>
            <Text
              style={[styles.identityEmail, { color: colors.textGray }]}
              numberOfLines={1}
              maxFontSizeMultiplier={AuthFontSizeMultipliers.body}
            >
              {email}
            </Text>
          </View>
        </View>

        {/* Headline & Guidance */}
        <Text
          style={[styles.title, { color: colors.textDark }]}
          maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}
        >
          Contact Number Required
        </Text>
        <Text
          style={[styles.subtitle, { color: colors.textGray }]}
          maxFontSizeMultiplier={AuthFontSizeMultipliers.body}
        >
          Riders call or text you during errands to confirm purchases and delivery arrivals. Enter your Philippine mobile number to finish setting up your account.
        </Text>

        {/* Error Banner */}
        {error ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: colors.danger },
            ]}
          >
            <AlertCircle size={16} color={colors.danger} />
            <Text
              style={[styles.errorText, { color: colors.danger }]}
              maxFontSizeMultiplier={AuthFontSizeMultipliers.label}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {/* Phone Input */}
        <View style={styles.labelRow}>
          <Text
            style={[styles.label, { color: colors.textMedium }]}
            maxFontSizeMultiplier={AuthFontSizeMultipliers.label}
          >
            PHILIPPINE MOBILE NUMBER
          </Text>
          {isPhoneVerified ? (
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={12} color="#10B981" />
              <Text style={styles.verifiedText}>VERIFIED</Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: inputFill,
              borderColor: isPhoneVerified ? '#10B981' : inputHairline,
            },
          ]}
        >
          <View style={styles.prefixBox}>
            <Phone size={16} color={colors.textGray} />
            <Text style={[styles.prefixText, { color: colors.textDark }]}>+63</Text>
          </View>
          <TextInput
            style={[styles.phoneInput, { color: colors.textDark }]}
            placeholder="9XX XXX XXXX"
            placeholderTextColor={colors.textLight}
            value={phone}
            onChangeText={(val) => {
              setPhone(val);
              setPhoneToken(null);
              setError(null);
            }}
            keyboardType="phone-pad"
            maxLength={10}
            editable={!submitting}
            maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
            testID="google-phone-input"
          />
        </View>

        {/* Verification CTA Button (when unverified) */}
        {!isPhoneVerified ? (
          <TouchableOpacity
            style={[
              styles.verifyButton,
              {
                backgroundColor: isPhone10Digits ? colors.primary : colors.bgGray,
              },
              verifyingPhone && { opacity: 0.7 },
            ]}
            onPress={handleVerifyPhone}
            disabled={!isPhone10Digits || verifyingPhone}
            activeOpacity={0.85}
            testID="google-verify-phone-btn"
          >
            {verifyingPhone ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text
                style={[
                  styles.verifyButtonText,
                  { color: isPhone10Digits ? '#FFFFFF' : colors.textLight },
                ]}
                maxFontSizeMultiplier={AuthFontSizeMultipliers.button}
              >
                Send SMS Verification Code
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        {/* Complete Setup Primary CTA */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: isPhoneVerified ? colors.primary : colors.bgGray,
            },
            Shadows.soft,
            submitting && { opacity: 0.7 },
          ]}
          onPress={handleCompleteSetup}
          disabled={!isPhoneVerified || submitting}
          activeOpacity={0.85}
          testID="google-complete-setup-btn"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.submitRow}>
              <Text
                style={[
                  styles.submitText,
                  { color: isPhoneVerified ? '#FFFFFF' : colors.textLight },
                ]}
                maxFontSizeMultiplier={AuthFontSizeMultipliers.button}
              >
                Complete Account Setup
              </Text>
              <ArrowRight
                size={18}
                color={isPhoneVerified ? '#FFFFFF' : colors.textLight}
                strokeWidth={2.4}
              />
            </View>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 18,
  },
  identityDetails: {
    flex: 1,
  },
  identityName: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(15, 0.2),
  },
  identityEmail: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(13, 0.2),
    marginTop: 2,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(22, 0.25),
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(14, 0.2),
    lineHeight: 20,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(12, 0.2),
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(11, 0.2),
    letterSpacing: 0.6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  verifiedText: {
    color: '#10B981',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(10, 0.2),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: 'rgba(148, 163, 184, 0.2)',
  },
  prefixText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(15, 0.2),
  },
  phoneInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(15, 0.2),
    paddingLeft: Spacing.md,
  },
  verifyButton: {
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  verifyButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(13, 0.2),
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  submitText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(15, 0.2),
  },
});
