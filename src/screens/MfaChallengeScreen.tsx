import { usePageLayout } from '../hooks/usePageLayout';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquareText,
  TimerOff,
} from 'lucide-react-native';
import AuthHeroPattern from '../components/AuthHeroPattern';
import RateLimitCountdown from '../components/RateLimitCountdown';
import { apiClient } from '../services/apiClient';
import { toApiError } from '../services/ApiError';
import { isSessionEnded, retryAfterSeconds, toUserMessage } from '../services/errorMessages';
import { verifyLoginBySms } from '../services/phoneVerification';
import { saveMfaTrustToken, type LoginChallenge, type MfaFactor } from '../services/mfaTrust';
import { useAuth } from '../context/AuthContext';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  Shadows,
  MAX_CONTENT_WIDTH,
  moderateScale,
  AuthFontSizes,
  scaledAuthFontSize,
  getAuthLineHeight,
  AuthFontSizeMultipliers,
  AuthContainerHeights,
} from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAuthHeroGradient } from '../hooks/useAuthHeroGradient';
import type { RootStackScreenProps } from '../navigation/types';

const SHEET_OVERLAP = 34;
const CODE_LENGTH = 6;

type Step = 'choose' | 'code' | 'expired';
type Busy = MfaFactor | 'verify' | 'resend' | null;

function lastFour(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '').slice(-4);
}

/**
 * The second sign-in factor. The password or Google check already passed; the
 * server asks for this only on a device that has not passed it in 30 days.
 *
 * SMS opens the portal's verify-phone page (Firebase phone sign-in needs a web
 * reCAPTCHA) and spends its ID token here. Email asks the server to send a
 * code first: with `x-sugo-mfa: 1` it no longer sends one with the challenge.
 * A 401 from either call means the challenge is spent or expired, and the only
 * way on is to sign in again.
 */
export default function MfaChallengeScreen({ navigation, route }: RootStackScreenProps<'MfaChallenge'>) {
  const pageLayout = usePageLayout();
  const { onboarding } = route.params;
  const { login } = useAuth();
  const { colors, isDark } = useThemeColor();
  const heroGradient = useAuthHeroGradient();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [challenge, setChallenge] = useState<LoginChallenge>(route.params.challenge);
  const [step, setStep] = useState<Step>('choose');
  const [busy, setBusy] = useState<Busy>(null);
  const [code, setCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  // One request at a time. `busy` is state, so two taps in one tick both saw it null.
  const busyRef = useRef(false);

  const factors = challenge.factors;
  const phoneHint = lastFour(challenge.phoneHint) || lastFour(challenge.maskedPhone);
  const emailLabel = challenge.maskedEmail ? `Email to ${challenge.maskedEmail}` : 'Email to your address on file';
  const smsLabel = phoneHint ? `Text message to number ending ${phoneHint}` : 'Text message to your mobile number';
  const heroHeight = Math.max(190, Math.min(screenHeight * 0.26, 250)) + SHEET_OVERLAP;
  const inputFill = isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7';
  const inputHairline = isDark ? 'rgba(255,255,255,0.08)' : '#ECEDF0';

  const clearMessages = () => {
    setError(null);
    setNotice(null);
    setWaitSeconds(null);
  };

  const expire = () => {
    clearMessages();
    setCode('');
    setStep('expired');
  };

  // The challenge dies on the server after `expiresInSeconds`. Saying so when
  // it happens beats a failed code later. A resend brings a new token and clock.
  useEffect(() => {
    if (!challenge.expiresInSeconds) return;
    const timer = setTimeout(expire, challenge.expiresInSeconds * 1000);
    return () => clearTimeout(timer);
  }, [challenge]);

  // Back to the screen the sign-in started on, whose fields still hold what was typed.
  const startOver = () => {
    if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Login');
  };

  const handleBack = () => {
    if (step === 'code' && factors.length > 1) {
      clearMessages();
      setStep('choose');
      return;
    }
    startOver();
  };

  const showFailure = (err: unknown, during: 'sms' | 'email') => {
    if (isSessionEnded(err)) {
      expire();
      return;
    }
    if (during === 'sms' && toApiError(err).status === 400) {
      setError(
        phoneHint
          ? `That number isn't the one on your account. Use the number ending ${phoneHint}, or choose email.`
          : "That number isn't the one on your account. Try again, or choose email."
      );
      return;
    }
    setError(toUserMessage(err, 'otp'));
    setWaitSeconds(retryAfterSeconds(err) ?? null);
  };

  const finishSignIn = async (data: any) => {
    await saveMfaTrustToken(data?.mfaTrustToken);
    const userPayload = data.user || data;
    await AsyncStorage.setItem('@sugo_customer_onboarding_completed', 'true');
    if (onboarding) {
      await AsyncStorage.setItem('@sugo_pending_onboarding_location_setup', 'true');
      if (onboarding.detectedLocation) {
        try {
          await AsyncStorage.setItem('@sugo_onboarding_location_draft', JSON.stringify(onboarding.detectedLocation));
        } catch {}
      }
    }
    await login(userPayload, data.token, data.refreshToken);
    navigation.replace(
      'CustomerPortal',
      onboarding
        ? { user: userPayload, triggerOnboardingLocationSetup: true, detectedLocation: onboarding.detectedLocation }
        : { user: userPayload }
    );
  };

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    Keyboard.dismiss();
    clearMessages();
    setBusy(kind);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleSms = () =>
    run('SMS', async () => {
      const result = await verifyLoginBySms(phoneHint);
      if (result.status === 'cancelled') {
        setNotice('The text message check closed before it finished. Try again, or choose another way.');
        return;
      }
      if (result.status === 'failed') {
        setError(toUserMessage(result.error, 'otp'));
        return;
      }
      try {
        const response = await apiClient.post('/auth/verify-login-otp', {
          challengeToken: challenge.challengeToken,
          firebaseIdToken: result.idToken,
        });
        await finishSignIn(response.data);
      } catch (err) {
        showFailure(err, 'sms');
      }
    });

  // Sends the email code. Each send spends the challenge token and returns a new one.
  const sendEmailCode = (kind: 'EMAIL' | 'resend') =>
    run(kind, async () => {
      try {
        const response = await apiClient.post('/auth/resend-login-otp', {
          challengeToken: challenge.challengeToken,
        });
        const next = response.data;
        if (typeof next?.challengeToken === 'string' && next.challengeToken) {
          setChallenge((prev) => ({
            ...prev,
            challengeToken: next.challengeToken,
            expiresInSeconds: typeof next.expiresInSeconds === 'number' ? next.expiresInSeconds : prev.expiresInSeconds,
          }));
        }
        setCode('');
        setStep('code');
        const where = challenge.maskedEmail || 'your email';
        setNotice(
          kind === 'resend'
            ? `We sent a new code to ${where}. Use the newest one.`
            : `We sent a 6-digit code to ${where}. It can take a minute to arrive.`
        );
      } catch (err) {
        showFailure(err, 'email');
      }
    });

  const handleVerifyCode = () => {
    if (code.length !== CODE_LENGTH) {
      clearMessages();
      setError('Enter the 6-digit code from the email.');
      return;
    }
    return run('verify', async () => {
      try {
        const response = await apiClient.post('/auth/verify-login-otp', {
          challengeToken: challenge.challengeToken,
          code,
        });
        await finishSignIn(response.data);
      } catch (err) {
        showFailure(err, 'email');
      }
    });
  };

  const renderMethod = (factor: MfaFactor) => {
    const isSms = factor === 'SMS';
    const Icon = isSms ? MessageSquareText : Mail;
    const label = isSms ? smsLabel : emailLabel;
    return (
      <TouchableOpacity
        key={factor}
        testID={isSms ? 'mfa-method-sms' : 'mfa-method-email'}
        style={[styles.method, { backgroundColor: colors.card, borderColor: inputHairline }]}
        onPress={isSms ? handleSms : () => sendEmailCode('EMAIL')}
        disabled={busy !== null}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={[styles.methodIcon, { backgroundColor: colors.primaryLight }]}>
          <Icon size={20} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={styles.methodText}>
          <Text style={[styles.methodLabel, { color: colors.textDark }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
            {label}
          </Text>
          <Text style={[styles.methodHint, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
            {isSms ? 'Opens a secure page that texts you a code.' : 'We email you a 6-digit code.'}
          </Text>
        </View>
        {busy === factor ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <ChevronRight size={18} color={colors.textLight} />
        )}
      </TouchableOpacity>
    );
  };

  const renderLink = (label: string, onPress: () => void, testID: string) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy !== null}
      style={styles.link}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={testID}
    >
      <Text style={[styles.linkText, { color: colors.primary }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.card }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <KeyboardAwareScrollView
        style={styles.root}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={Spacing.xxl}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { minHeight: heroHeight, paddingTop: insets.top + Spacing.md }, pageLayout.insetStyle]}
        >
          <AuthHeroPattern width={screenWidth} height={heroHeight} />
          <TouchableOpacity
            onPress={handleBack}
            style={styles.heroBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
            testID="mfa-back"
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle} maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}>
            Confirm it&apos;s you
          </Text>
          <Text style={styles.heroSubtitle} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
            This phone needs one more check before you sign in. We ask again only after 30 days.
          </Text>
        </LinearGradient>

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, marginTop: -SHEET_OVERLAP, paddingBottom: insets.bottom + Spacing.xxl }, pageLayout.gutterStyle, pageLayout.frameStyle]}
        >
          {error ? (
            <View
              style={[styles.banner, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: colors.danger }]}
              testID="mfa-error"
            >
              <AlertCircle size={16} color={colors.danger} />
              <Text style={[styles.bannerText, { color: colors.danger }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>
                {error}
              </Text>
            </View>
          ) : null}

          {waitSeconds ? (
            <RateLimitCountdown
              seconds={waitSeconds}
              message="Too many tries. You can try again in:"
              onComplete={() => {
                setWaitSeconds(null);
                setError(null);
              }}
              style={styles.countdown}
            />
          ) : null}

          {notice ? (
            <View style={[styles.notice, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray }]} testID="mfa-notice">
              <Mail size={15} color={colors.textGray} />
              <Text style={[styles.noticeText, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
                {notice}
              </Text>
            </View>
          ) : null}

          {step === 'choose' && (
            <>
              <Text style={[styles.sheetTitle, { color: colors.textDark }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}>
                How should we send your code?
              </Text>
              <View style={styles.methods}>{factors.map(renderMethod)}</View>
            </>
          )}

          {step === 'code' && (
            <>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>
                  VERIFICATION CODE
                </Text>
              </View>
              <TextInput
                style={[
                  styles.otpInput,
                  {
                    backgroundColor: inputFill,
                    borderColor: error ? colors.danger : codeFocused ? colors.primary : inputHairline,
                    color: colors.textDark,
                  },
                ]}
                placeholder="000000"
                placeholderTextColor={colors.textLight}
                value={code}
                onChangeText={(text) => {
                  setCode(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH));
                  if (error) setError(null);
                }}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                onSubmitEditing={handleVerifyCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}
                returnKeyType="go"
                maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                testID="mfa-code-input"
              />

              <TouchableOpacity
                testID="mfa-verify-button"
                style={[styles.button, { backgroundColor: colors.primary }, Shadows.soft, busy !== null && { opacity: 0.7 }]}
                onPress={handleVerifyCode}
                disabled={busy !== null}
                activeOpacity={0.85}
              >
                {busy === 'verify' ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <View style={styles.buttonRow}>
                    <Text style={[styles.buttonText, { color: colors.onPrimary }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>
                      Verify
                    </Text>
                    <ArrowRight size={18} color={colors.onPrimary} strokeWidth={2.5} />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.linkRow}>
                {busy === 'resend' ? (
                  <ActivityIndicator color={colors.primary} style={styles.link} />
                ) : (
                  renderLink('Resend code', () => sendEmailCode('resend'), 'mfa-resend')
                )}
                {factors.includes('SMS')
                  ? renderLink('Text me instead', () => {
                      clearMessages();
                      setStep('choose');
                    }, 'mfa-switch-method')
                  : null}
              </View>
            </>
          )}

          {step === 'expired' && (
            <View style={styles.expired} testID="mfa-expired">
              <View style={[styles.methodIcon, { backgroundColor: colors.primaryLight }]}>
                <TimerOff size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={[styles.sheetTitle, { color: colors.textDark }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}>
                This sign-in timed out
              </Text>
              <Text style={[styles.body, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
                For your security, a sign-in check lasts only a few minutes. Sign in again to get a new code.
              </Text>
              <TouchableOpacity
                testID="mfa-sign-in-again"
                style={[styles.button, styles.fullWidth, { backgroundColor: colors.primary }, Shadows.soft]}
                onPress={startOver}
                activeOpacity={0.85}
              >
                <Text style={[styles.buttonText, { color: colors.onPrimary }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>
                  Sign in again
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step !== 'expired' && (
            <TouchableOpacity
              onPress={startOver}
              style={styles.startOver}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="mfa-start-over"
            >
              <Text style={[styles.startOverText, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
                Not you, or wrong account?{' '}
                <Text style={{ color: colors.primary, fontFamily: FontFamily.bold }} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
                  Start over
                </Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: SHEET_OVERLAP + Spacing.lg,
    overflow: 'hidden',
  },
  heroBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xxl),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xxl), 'heading'),
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  sheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.lg),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.lg), 'heading'),
    marginBottom: Spacing.md,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  bannerText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    flex: 1,
  },
  countdown: {
    marginBottom: Spacing.md,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  noticeText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
    flex: 1,
  },
  methods: {
    gap: Spacing.md,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: AuthContainerHeights.buttonMinHeight + Spacing.lg,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: {
    flex: 1,
  },
  methodLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.base),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.base), 'body'),
  },
  methodHint: {
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'body'),
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  otpInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: moderateScale(Spacing.md, 0.2),
    fontSize: scaledAuthFontSize(22),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(22), 'heading'),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: AuthContainerHeights.buttonMinHeight,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  buttonText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.md),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.md), 'heading'),
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  link: {
    paddingVertical: Spacing.xs,
  },
  linkText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
  expired: {
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  startOver: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  startOverText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
});
