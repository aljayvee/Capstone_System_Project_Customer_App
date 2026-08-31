import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  AtSign,
  Lock,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  MailCheck,
} from 'lucide-react-native';
import AuthHeroPattern from '../components/AuthHeroPattern';
import { apiClient } from '../services/apiClient';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAuthHeroGradient } from '../hooks/useAuthHeroGradient';

const SHEET_OVERLAP = 34;
// Fallback only. The real wait comes from the server's `retryAfterSeconds`,
// which doubles with each code sent to the same recipient — the client must not
// invent its own schedule or the countdown will disagree with what the API
// actually enforces.
const RESEND_COOLDOWN_FALLBACK_SECONDS = 60;

// The flow still has four states internally. The counter that used to surface
// them in the hero was removed on request: a customer now discovers the length
// of the reset only by walking it. `handleBack` and the hero back button are
// untouched, so no step is a one-way door.
type Step = 1 | 2 | 3 | 4;

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors, isDark } = useThemeColor();
  const heroGradient = useAuthHeroGradient();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(1);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // THE HONEYPOT.
  //
  // Rendered off-screen with no label, zero size and no keyboard focus path, so
  // no sighted or screen-reader user can reach it — but a form-filling bot walks
  // the DOM/view tree and populates every input it finds. Whatever lands here is
  // sent to the server verbatim; the server treats any non-empty value as a bot
  // signature, logs it against the caller's IP, and returns the same success
  // response a human would get. It must never be pre-filled, and its state must
  // never be cleared between steps.
  const [website, setWebsite] = useState('');

  const [resetToken, setResetToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Which identifier the live code was sent to. Going back to step 1 and
  // pressing Send again must NOT quietly issue a second code for the same
  // account: issuing retires the previous one, so the code already open in the
  // customer's inbox would stop working. Tracked per-identifier because editing
  // the field means a different account, where a fresh code IS correct.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const introFade = useRef(new Animated.Value(0)).current;

  const heroHeight = Math.max(200, Math.min(screenHeight * 0.28, 270)) + SHEET_OVERLAP;

  const inputFill = isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7';
  const inputHairline = isDark ? 'rgba(255,255,255,0.08)' : '#ECEDF0';

  useEffect(() => {
    Animated.timing(introFade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [introFade]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const hasEdgeSpace = useMemo(
    () => password.length > 0 && password.trim().length !== password.length,
    [password]
  );

  const triggerShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const fail = (message: string) => {
    setApiError(message);
    triggerShake();
  };

  const clearMessages = () => {
    setFieldError(null);
    setApiError(null);
  };

  // STEP 1 — ask for the code.
  const handleRequestCode = async () => {
    clearMessages();
    if (!identifier.trim()) {
      setFieldError('Required!');
      triggerShake();
      return;
    }

    const target = identifier.trim();

    // Same account, code still fresh: go straight back to the code screen
    // without asking for another one. The server enforces this too — this guard
    // exists so the customer is told what is happening rather than tapping a
    // button that appears to do nothing.
    if (codeSentTo === target && cooldown > 0) {
      setNotice(`We already sent a code to this account. Check your email, or ask for a new one in ${cooldown}s.`);
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/customers/forgot-password', {
        identifier: target,
        website,
      });
      // The server answers identically whether or not the account exists, so
      // there is nothing to branch on — advance either way. `maskedEmail` is the
      // only differing field and it is display-only.
      setMaskedEmail(res.data?.maskedEmail ?? null);
      setNotice(res.data?.message ?? null);
      setCooldown(res.data?.retryAfterSeconds ?? RESEND_COOLDOWN_FALLBACK_SECONDS);
      setCodeSentTo(target);
      setStep(2);
    } catch (error: any) {
      fail(error.message || 'Could not start the reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 — prove the mailbox.
  const handleVerifyCode = async () => {
    clearMessages();
    if (code.trim().length !== 6) {
      setFieldError('Enter the 6 digits!');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/customers/verify-reset-code', {
        identifier: identifier.trim(),
        code: code.trim(),
      });
      setResetToken(res.data?.resetToken ?? '');
      setNotice(null);
      setStep(3);
    } catch (error: any) {
      fail(error.message || 'That code did not work. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    clearMessages();
    setLoading(true);
    try {
      const res = await apiClient.post('/customers/forgot-password', {
        identifier: identifier.trim(),
        website,
      });
      setNotice(res.data?.message ?? 'A new code is on its way.');
      setCooldown(res.data?.retryAfterSeconds ?? RESEND_COOLDOWN_FALLBACK_SECONDS);
      setCodeSentTo(identifier.trim());
    } catch (error: any) {
      fail(error.message || 'Could not resend the code.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3 — set the new password.
  const handleResetPassword = async () => {
    clearMessages();
    // Trimmed exactly as LoginScreen and RegisterScreen do: edge spaces go, the
    // ones inside stay, and the minimum is counted on what actually gets sent.
    const trimmed = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmed.length === 0) {
      setFieldError('Password required!');
      triggerShake();
      return;
    }
    if (trimmed.length < 6) {
      setFieldError('Min 6 characters!');
      triggerShake();
      return;
    }
    if (trimmed !== trimmedConfirm) {
      setFieldError('Passwords do not match!');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/customers/reset-password', { resetToken, password: trimmed });
      setStep(4);
    } catch (error: any) {
      fail(error.message || 'Could not update your password. Please start again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    clearMessages();
    if (step === 2) return setStep(1);
    if (step === 3) return setStep(2);
    navigation.navigate('Login');
  };

  const heroTitle = [
    'Forgot your password?',
    'Check your email',
    'Set a new password',
    'All set',
  ][step - 1];

  const heroSubtitle =
    step === 2 && maskedEmail ? (
      <>
        We sent a 6-digit code to <Text style={styles.heroSubtitleStrong}>{maskedEmail}</Text>.
      </>
    ) : (
      [
        "Tell us the username or email on your account and we'll send a verification code.",
        'Enter the 6-digit code from your email to continue.',
        'Choose a password you have not used before.',
        'Your password has been updated. Sign in with it now.',
      ][step - 1]
    );

  const renderErrorPill = (message: string) => (
    <View style={[styles.errorPill, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2' }]}>
      <AlertCircle size={11} color={colors.danger} strokeWidth={2.4} />
      <Text style={[styles.errorPillText, { color: colors.danger }]}>{message}</Text>
    </View>
  );

  const renderLabel = (label: string) => (
    <View style={styles.labelRow}>
      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>{label}</Text>
      {fieldError ? renderErrorPill(fieldError) : null}
    </View>
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
          style={[styles.hero, { minHeight: heroHeight, paddingTop: insets.top + Spacing.md }]}
        >
          <AuthHeroPattern width={screenWidth} height={heroHeight} />

          <Animated.View style={{ opacity: introFade }}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                onPress={handleBack}
                style={styles.heroBackBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Go back"
                testID="forgot-back"
              >
                <ChevronLeft size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroSubtitleText}>{heroSubtitle}</Text>
          </Animated.View>
        </LinearGradient>

        <View
          style={[
            styles.sheet,
            Shadows.liftedUp,
            {
              backgroundColor: colors.card,
              marginTop: -SHEET_OVERLAP,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={styles.grabber} />

          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            {apiError ? (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: colors.danger },
                ]}
              >
                <AlertCircle size={16} color={colors.danger} />
                <Text style={[styles.bannerText, { color: colors.danger }]}>{apiError}</Text>
              </View>
            ) : null}

            {/* STEP 1 — IDENTIFIER */}
            {step === 1 && (
              <>
                {renderLabel('USERNAME OR EMAIL')}
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: inputFill,
                      borderColor: fieldError ? colors.danger : inputHairline,
                    },
                  ]}
                >
                  <AtSign size={18} color={fieldError ? colors.danger : colors.textGray} />
                  <TextInput
                    style={[styles.input, { color: colors.textDark }]}
                    placeholder="Enter your username or email"
                    placeholderTextColor={colors.textLight}
                    value={identifier}
                    onChangeText={(text) => {
                      setIdentifier(text);
                      clearMessages();
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    returnKeyType="go"
                    onSubmitEditing={handleRequestCode}
                    testID="forgot-identifier-input"
                  />
                </View>

                {/* HONEYPOT — see the `website` state declaration above. Parked
                    off-screen rather than display:none because a bot that reads
                    styles skips hidden inputs; one that reads the view tree does
                    not. Excluded from accessibility so no assistive technology
                    can land on it. */}
                <View style={styles.honeypot} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <TextInput
                    value={website}
                    onChangeText={setWebsite}
                    autoComplete="off"
                    autoCorrect={false}
                    testID="forgot-honeypot"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.soft, loading && { opacity: 0.7 }]}
                  onPress={handleRequestCode}
                  disabled={loading}
                  activeOpacity={0.85}
                  testID="forgot-submit"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>
                        {codeSentTo === identifier.trim() && cooldown > 0 ? 'Back to Code' : 'Send Code'}
                      </Text>
                      <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* STEP 2 — CODE */}
            {step === 2 && (
              <>
                {notice ? (
                  <View style={[styles.notice, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray }]}>
                    <MailCheck size={15} color={colors.textGray} />
                    <Text style={[styles.noticeText, { color: colors.textGray }]}>{notice}</Text>
                  </View>
                ) : null}

                {renderLabel('VERIFICATION CODE')}
                <TextInput
                  style={[
                    styles.otpInput,
                    {
                      backgroundColor: inputFill,
                      borderColor: fieldError ? colors.danger : colors.primary,
                      color: colors.textDark,
                    },
                  ]}
                  placeholder="000000"
                  placeholderTextColor={colors.textLight}
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                    clearMessages();
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  testID="forgot-code-input"
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.soft, loading && { opacity: 0.7 }]}
                  onPress={handleVerifyCode}
                  disabled={loading}
                  activeOpacity={0.85}
                  testID="forgot-submit"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Verify Code</Text>
                      <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResend}
                  disabled={cooldown > 0 || loading}
                  style={styles.resendBtn}
                  testID="forgot-resend"
                >
                  <Text
                    style={[
                      styles.resendText,
                      { color: cooldown > 0 ? colors.textLight : colors.primary },
                    ]}
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* STEP 3 — NEW PASSWORD */}
            {step === 3 && (
              <>
                {renderLabel('NEW PASSWORD')}
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: inputFill,
                      borderColor: fieldError ? colors.danger : inputHairline,
                    },
                  ]}
                >
                  <Lock size={18} color={fieldError ? colors.danger : colors.textGray} />
                  <TextInput
                    style={[styles.input, { color: colors.textDark }]}
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.textLight}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      clearMessages();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="new-password"
                    testID="forgot-password-input"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((p) => !p)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={colors.textGray} />
                    ) : (
                      <Eye size={18} color={colors.textGray} />
                    )}
                  </TouchableOpacity>
                </View>

                {hasEdgeSpace ? (
                  <Text style={[styles.spaceHint, { color: colors.textGray }]} testID="password-space-hint">
                    Spaces at the start and end are ignored. Spaces inside your password still count.
                  </Text>
                ) : null}

                <View style={[styles.labelRow, { marginTop: Spacing.lg }]}>
                  <Text style={[styles.inputLabel, { color: colors.textMedium }]}>CONFIRM PASSWORD</Text>
                </View>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: inputFill, borderColor: inputHairline },
                  ]}
                >
                  <Lock size={18} color={colors.textGray} />
                  <TextInput
                    style={[styles.input, { color: colors.textDark }]}
                    placeholder="Re-enter your new password"
                    placeholderTextColor={colors.textLight}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      clearMessages();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    testID="forgot-confirm-input"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.soft, loading && { opacity: 0.7 }]}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.85}
                  testID="forgot-submit"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Update Password</Text>
                      <CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* STEP 4 — DONE */}
            {step === 4 && (
              <View style={styles.doneBlock} testID="forgot-done">
                <View
                  style={[
                    styles.doneBadge,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray },
                  ]}
                >
                  <CheckCircle2 size={32} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.doneText, { color: colors.textGray }]}>
                  You can sign in with your new password now.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.soft, { width: '100%' }]}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.85}
                  testID="forgot-back-to-login"
                >
                  <Text style={styles.primaryBtnText}>Back to Login</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            )}

            {step < 4 ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.footerLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="forgot-login-link"
              >
                <Text style={[styles.footerText, { color: colors.textGray }]}>
                  Remembered it?{' '}
                  <Text style={{ color: colors.primary, fontFamily: FontFamily.bold }}>Log In</Text>
                </Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
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
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heroBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  heroSubtitleText: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    lineHeight: 18,
  },
  heroSubtitleStrong: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(128,128,128,0.25)',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
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
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    flex: 1,
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
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
    flex: 1,
    lineHeight: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: scaledFontSize(FontSizes.xs - 1, 0.2),
    fontFamily: FontFamily.bold,
    letterSpacing: 0.8,
  },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  errorPillText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs - 1, 0.2),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    minHeight: moderateScale(48, 0.2),
  },
  input: {
    flex: 1,
    paddingVertical: moderateScale(Spacing.sm + 2, 0.2),
    fontSize: scaledFontSize(FontSizes.base, 0.2),
    fontFamily: FontFamily.regular,
  },
  eyeBtn: {
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  // Parked far off-screen. Absolute + negative offset rather than width/height
  // zero, so the field still "exists" to a naive scraper — which is the point.
  honeypot: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.xl + 4,
    paddingVertical: moderateScale(Spacing.md, 0.2),
    fontSize: scaledFontSize(22, 0.2),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    letterSpacing: 8,
  },
  spaceHint: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginTop: Spacing.xs,
    marginLeft: Spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
    minHeight: moderateScale(50, 0.2),
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.base, 0.2),
  },
  resendBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  resendText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
  doneBlock: {
    alignItems: 'center',
  },
  doneBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  doneText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
});
