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
  Keyboard,
  Platform,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, ArrowRight, Bike, AlertCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthHeroPattern from '../components/AuthHeroPattern';
import { apiClient } from '../services/apiClient';
import { toUserMessage, retryAfterSeconds } from '../services/errorMessages';
import RateLimitCountdown from '../components/RateLimitCountdown';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { signInWithGoogleNative } from '../services/googleAuth';
import { useAuth } from '../context/AuthContext';
import {
  FontFamily,
  FontSizes,
  Spacing,
  BorderRadius,
  Shadows,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  moderateScale,
  AuthFontSizes,
  scaledAuthFontSize,
  getAuthLineHeight,
  AuthFontSizeMultipliers,
  AuthContainerHeights,
} from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAuthHeroGradient } from '../hooks/useAuthHeroGradient';

// The hero owns the top third of the screen in resting state, and the white
// sheet is pulled up over its bottom edge by SHEET_OVERLAP.
const SHEET_OVERLAP = 34;

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { colors, isDark } = useThemeColor();
  const heroGradient = useAuthHeroGradient();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idFocused, setIdFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  // Seconds left on a login lockout, when the server told us. Drives the
  // countdown below the banner so the wait is a visible number, not a guess.
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  // True once the white sheet has scrolled up under the status bar, which then
  // needs dark icons. It used to follow the keyboard, because the keyboard was
  // what slid the sheet up.
  const [sheetUnderStatusBar, setSheetUnderStatusBar] = useState(false);

  const shakeIdentifier = useRef(new Animated.Value(0)).current;
  const shakePassword = useRef(new Animated.Value(0)).current;

  // Entrance animations
  const introFade = useRef(new Animated.Value(0)).current;
  const sheetRise = useRef(new Animated.Value(24)).current;

  const isSmallScreen = screenHeight < 680;
  const heroHeight = Math.max(200, Math.min(screenHeight * 0.32, 270)) + SHEET_OVERLAP;
  const sheetReachesStatusBarAt = Math.max(0, heroHeight - SHEET_OVERLAP - insets.top);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introFade, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(sheetRise, {
        toValue: 0,
        damping: 18,
        stiffness: 150,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [introFade, sheetRise]);

  // Leading/trailing spaces are trimmed before the password is sent, so an
  // invisible edge keystroke cannot silently fail the sign-in. Spaces INSIDE
  // the password are kept. Saying so beats leaving the customer to wonder
  // whether the space they typed counted.
  const hasEdgeSpace = useMemo(
    () => password.length > 0 && password.trim().length !== password.length,
    [password]
  );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const under = e.nativeEvent.contentOffset.y >= sheetReachesStatusBarAt;
    if (under !== sheetUnderStatusBar) setSheetUnderStatusBar(under);
  };

  const triggerShake = (animValue: Animated.Value) => {
    animValue.setValue(0);
    Animated.sequence([
      Animated.timing(animValue, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    let hasError = false;
    setIdentifierError(null);
    setPasswordError(null);
    setApiError(null);
    setLockoutSeconds(null);

    if (!identifier.trim()) {
      setIdentifierError('Required');
      triggerShake(shakeIdentifier);
      hasError = true;
    }

    // Measured on the trimmed value, which is what actually gets sent: a box
    // holding only spaces is an empty box.
    if (password.trim().length === 0) {
      setPasswordError('Required');
      triggerShake(shakePassword);
      hasError = true;
    }

    if (hasError) return;

    Keyboard.dismiss();
    setLoading(true);
    try {
      const response = await apiClient.post('/customers/login', {
        // The wire key stays `username` — the backend accepts a username or an
        // email address in it (see authValidators.customerLoginSchema).
        username: identifier.trim(),
        // Edge-trimmed only — inner spaces are part of the password and reach
        // the server untouched. The server trims identically, so the two agree
        // on exactly which string gets hashed and compared.
        password: password.trim(),
      });
      const data = response.data;
      const userPayload = data.user || data;

      await AsyncStorage.setItem('@sugo_customer_onboarding_completed', 'true');
      await login(userPayload, data.token, data.refreshToken);
      navigation.replace('CustomerPortal', { user: userPayload });
    } catch (error: any) {
      // Never render error.message here. This app talks to a deployed backend
      // whose wording - or a CDN's, in front of it - is not ours to show, and
      // it used to land in this banner verbatim. Decide from the status code.
      setApiError(toUserMessage(error, 'login'));
      setLockoutSeconds(retryAfterSeconds(error) ?? null);
      triggerShake(shakeIdentifier);
      triggerShake(shakePassword);
    } finally {
      setLoading(false);
    }
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleLoadingText, setGoogleLoadingText] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    Keyboard.dismiss();
    setGoogleLoading(true);
    setGoogleLoadingText(null);
    setApiError(null);
    try {
      const googleUser = await signInWithGoogleNative();
      if (!googleUser) {
        return;
      }

      setGoogleLoadingText('Signing In...');

      const response = await apiClient.post('/customers/google-login', {
        idToken: googleUser.firebaseIdToken,
      });

      const data = response.data;
      if (data.status === 'PHONE_SETUP_REQUIRED') {
        navigation.navigate('GooglePhoneSetup', {
          googleIdToken: googleUser.firebaseIdToken,
          email: data.email || googleUser.email,
          firstName: data.firstName || googleUser.firstName,
          lastName: data.lastName || googleUser.lastName,
          googleUid: data.googleUid || googleUser.googleUid,
          avatar: data.avatar || googleUser.photoUrl,
        });
      } else {
        const userPayload = data.user || data;
        await AsyncStorage.setItem('@sugo_customer_onboarding_completed', 'true');
        await login(userPayload, data.token, data.refreshToken);
        navigation.replace('CustomerPortal', { user: userPayload });
      }
    } catch (error: any) {
      if (error?.message && error.message.includes('Google Sign-In')) {
        setApiError(error.message);
      } else {
        setApiError(toUserMessage(error, 'login'));
      }
    } finally {
      setGoogleLoading(false);
      setGoogleLoadingText(null);
    }
  };

  const inputFill = isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7';
  const inputHairline = isDark ? 'rgba(255,255,255,0.08)' : '#ECEDF0';

  const renderFieldError = (message: string) => (
    <View style={[styles.errorPill, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2' }]}>
      <AlertCircle size={11} color={colors.danger} strokeWidth={2.4} />
      <Text style={[styles.errorPillText, { color: colors.danger }]}>{message}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.card }]}>
      <StatusBar
        barStyle={sheetUnderStatusBar ? (isDark ? 'light-content' : 'dark-content') : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Scrolls, and brings the focused field above the keyboard, the same way
          ForgotPasswordScreen does. This used to slide the sheet up a fixed
          distance instead, inside a View that could not scroll: under Android
          edge-to-edge the window no longer shrinks for the keyboard, so with
          an error banner showing the Log In button stayed under it with no way
          to reach it. A tap outside a field still closes the keyboard
          ("handled" lets taps on buttons and fields through). */}
      <KeyboardAwareScrollView
        style={[styles.container, { backgroundColor: colors.card }]}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={Spacing.xxl + 16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
      >
          {/* GRADIENT HERO — brand mark + headline */}
          <Animated.View
            renderToHardwareTextureAndroid
            needsOffscreenAlphaCompositing={Platform.OS === 'android'}
          >
            <LinearGradient
              colors={heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { height: heroHeight, paddingTop: insets.top + Spacing.xl }]}
            >
              <AuthHeroPattern width={screenWidth} height={heroHeight} />

              <Animated.View style={{ opacity: introFade }}>
                <View style={styles.brandRow}>
                  <View style={styles.brandMark}>
                    <Bike size={18} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                  <Text style={styles.brandWordmark} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>SUGO EXPRESS</Text>
                </View>

                <Text style={[styles.heroHeadline, isSmallScreen && styles.heroHeadlineSmall]} maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}>
                  Welcome to Sugo Express{'\n'}
                  <Text style={styles.heroHeadlineSoft} maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}>
                    Log in and let a rider{'\n'}run the errand for you.
                  </Text>
                </Text>
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          {/* WHITE SHEET — overlaps the hero's bottom edge */}
          <Animated.View
            renderToHardwareTextureAndroid
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                marginTop: -SHEET_OVERLAP,
                paddingBottom: insets.bottom + Spacing.xxl,
                opacity: introFade,
                transform: [{ translateY: sheetRise }],
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.textDark }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}>Login</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
              Sign in with your username or email address
            </Text>

            {/* API ERROR BANNER */}
            {apiError ? (
              <View
                style={[
                  styles.apiErrorBanner,
                  { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: colors.danger },
                ]}
              >
                <AlertCircle size={16} color={colors.danger} />
                <Text style={[styles.apiErrorText, { color: colors.danger }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>{apiError}</Text>
              </View>
            ) : null}

            {lockoutSeconds ? (
              <RateLimitCountdown
                seconds={lockoutSeconds}
                message="Too many sign-in attempts. You can try again in:"
                onComplete={() => {
                  setLockoutSeconds(null);
                  setApiError(null);
                }}
                style={styles.lockoutSpacing}
              />
            ) : null}

            {/* IDENTIFIER — username OR email */}
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>USERNAME OR EMAIL</Text>
              {identifierError ? renderFieldError(identifierError) : null}
            </View>
            <Animated.View style={{ transform: [{ translateX: shakeIdentifier }] }}>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: inputFill,
                    borderColor: identifierError ? colors.danger : idFocused ? colors.primary : inputHairline,
                    borderWidth: identifierError || idFocused ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter your username or email"
                  placeholderTextColor={colors.textLight}
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    if (identifierError) setIdentifierError(null);
                    if (apiError) setApiError(null);
                  }}
                  onFocus={() => {
                    setIdFocused(true);
                  }}
                  onBlur={() => setIdFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                  testID="username-input"
                />
              </View>
            </Animated.View>

            {/* PASSWORD — spaces preserved verbatim */}
            <View style={[styles.labelRow, { marginTop: Spacing.lg }]}>
              <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>PASSWORD</Text>
              {passwordError ? renderFieldError(passwordError) : null}
            </View>
            <Animated.View style={{ transform: [{ translateX: shakePassword }] }}>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: inputFill,
                    borderColor: passwordError ? colors.danger : passFocused ? colors.primary : inputHairline,
                    borderWidth: passwordError || passFocused ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textLight}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError(null);
                    if (apiError) setApiError(null);
                  }}
                  onFocus={() => {
                    setPassFocused(true);
                  }}
                  onBlur={() => setPassFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                  testID="password-input"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
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
            </Animated.View>

            {hasEdgeSpace ? (
              <Text style={[styles.spaceHint, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body} testID="password-space-hint">
                Spaces at the start and end are ignored. Spaces inside your password still count.
              </Text>
            ) : null}

            {/* FORGOT PASSWORD */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotRow}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="forgot-password-link"
            >
              <Text style={[styles.forgotText, { color: colors.primary }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* SUBMIT */}
            <TouchableOpacity
              testID="login-button"
              style={[styles.button, { backgroundColor: colors.primary }, Shadows.soft, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.buttonRow}>
                  <Text style={styles.buttonText} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>Log In</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              )}
            </TouchableOpacity>

            {/* DIVIDER */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: inputHairline }]} />
              <Text
                style={[styles.dividerText, { color: colors.textLight }]}
                maxFontSizeMultiplier={AuthFontSizeMultipliers.label}
              >
                OR
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: inputHairline }]} />
            </View>

            {/* GOOGLE SIGN IN */}
            <GoogleSignInButton
              onPress={handleGoogleLogin}
              loading={googleLoading}
              loadingText={googleLoadingText}
              disabled={loading}
              testID="login-google-button"
            />

            {/* SIGN UP */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.linkContainer}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="register-link"
            >
              <Text style={[styles.linkText, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
                Don&apos;t have an account?{' '}
                <Text style={{ color: colors.primary, fontFamily: FontFamily.bold }} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWordmark: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    letterSpacing: 1.5,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xxl),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xxl), 'display'),
    letterSpacing: -0.3,
  },
  heroHeadlineSmall: {
    fontSize: scaledAuthFontSize(AuthFontSizes.xl),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xl), 'heading'),
  },
  heroHeadlineSoft: {
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.88)',
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
    fontSize: scaledAuthFontSize(AuthFontSizes.xxl),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xxl), 'heading'),
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
    marginTop: Spacing.xs,
    marginBottom: moderateScale(Spacing.lg, 0.2),
  },
  lockoutSpacing: {
    marginBottom: Spacing.md,
  },
  apiErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  apiErrorText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    flex: 1,
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
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    minHeight: AuthContainerHeights.inputMinHeight,
  },
  input: {
    flex: 1,
    paddingVertical: moderateScale(Spacing.sm + 2, 0.2),
    fontSize: scaledAuthFontSize(AuthFontSizes.base),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.base), 'input'),
    fontFamily: FontFamily.regular,
    minHeight: AuthContainerHeights.inputMinHeight,
  },
  eyeButton: {
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  spaceHint: {
    fontFamily: FontFamily.medium,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'body'),
    marginTop: Spacing.xs,
    marginLeft: Spacing.md,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  forgotText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
  button: {
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: AuthContainerHeights.buttonMinHeight,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.md),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.md), 'heading'),
  },
  linkContainer: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  linkText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(11, 0.2),
    letterSpacing: 0.8,
  },
});

