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
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, AtSign, Lock, ArrowRight, Bike, AlertCircle } from 'lucide-react-native';
import AuthHeroPattern from '../components/AuthHeroPattern';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
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
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const shakeIdentifier = useRef(new Animated.Value(0)).current;
  const shakePassword = useRef(new Animated.Value(0)).current;

  // Entrance animations
  const introFade = useRef(new Animated.Value(0)).current;
  const sheetRise = useRef(new Animated.Value(24)).current;

  // Expanding & collapsing layout animation for keyboard adaptation (60/90/120 fps native driver)
  const expandProgress = useRef(new Animated.Value(0)).current;

  const isSmallScreen = screenHeight < 680;
  const heroHeight = Math.max(200, Math.min(screenHeight * 0.32, 270)) + SHEET_OVERLAP;
  const shiftDistance = Math.max(0, heroHeight - SHEET_OVERLAP - insets.top);

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

  const animateExpand = (toValue: number, customDuration?: number) => {
    const isOpening = toValue === 1;
    // Balanced timing curve calibrated for 60Hz, 90Hz, and 120Hz display refresh rates
    const duration = customDuration && customDuration > 0 ? customDuration : isOpening ? 280 : 240;
    const easing = isOpening
      ? Easing.bezier(0.2, 0.0, 0.0, 1.0) // Material 3 Decelerate (responsive start, smooth landing)
      : Easing.bezier(0.4, 0.0, 0.2, 1.0); // Standard Motion (balanced exit)

    Animated.timing(expandProgress, {
      toValue,
      duration,
      easing,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (e?: any) => {
      setIsKeyboardOpen(true);
      animateExpand(1, e?.duration);
    };

    const onKeyboardHide = (e?: any) => {
      setIsKeyboardOpen(false);
      animateExpand(0, e?.duration);
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    const didShowSub = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidShow', onKeyboardShow) : null;
    const didHideSub = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidHide', onKeyboardHide) : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      didShowSub?.remove();
      didHideSub?.remove();
    };
  }, [expandProgress]);

  // Adaptive native transforms for smooth expanding & collapsing
  const heroTranslateY = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -shiftDistance * 0.4],
  });

  const heroOpacity = expandProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.2, 0],
  });

  const sheetTranslateY = Animated.add(
    sheetRise,
    expandProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -shiftDistance],
    })
  );

  // Leading/trailing spaces are trimmed before the password is sent, so an
  // invisible edge keystroke cannot silently fail the sign-in. Spaces INSIDE
  // the password are kept. Saying so beats leaving the customer to wonder
  // whether the space they typed counted.
  const hasEdgeSpace = useMemo(
    () => password.length > 0 && password.trim().length !== password.length,
    [password]
  );

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

    if (!identifier.trim()) {
      setIdentifierError('Required!');
      triggerShake(shakeIdentifier);
      hasError = true;
    }

    // Measured on the trimmed value, which is what actually gets sent: a box
    // holding only spaces is an empty box.
    if (password.trim().length === 0) {
      setPasswordError('Required!');
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

      await login(userPayload, data.token, data.refreshToken);
      navigation.replace('CustomerPortal', { user: userPayload });
    } catch (error: any) {
      const msg = error.message || 'Invalid credentials. Please try again.';
      setApiError(msg);
      triggerShake(shakeIdentifier);
      triggerShake(shakePassword);
    } finally {
      setLoading(false);
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
        barStyle={isKeyboardOpen ? (isDark ? 'light-content' : 'dark-content') : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {/* GRADIENT HERO — brand mark + headline (Collapses smoothly on typing) */}
          <Animated.View
            renderToHardwareTextureAndroid
            needsOffscreenAlphaCompositing={Platform.OS === 'android'}
            style={{
              opacity: heroOpacity,
              transform: [{ translateY: heroTranslateY }],
            }}
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
                  <Text style={styles.brandWordmark} maxFontSizeMultiplier={1.15}>SUGO EXPRESS</Text>
                </View>

                <Text style={[styles.heroHeadline, isSmallScreen && styles.heroHeadlineSmall]} maxFontSizeMultiplier={1.15}>
                  Welcome to Sugo Express{'\n'}
                  <Text style={styles.heroHeadlineSoft} maxFontSizeMultiplier={1.15}>
                    Log in and let a rider{'\n'}run the errand for you.
                  </Text>
                </Text>
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          {/* WHITE SHEET — smoothly expands to fill the screen above keyboard */}
          <Animated.View
            renderToHardwareTextureAndroid
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                marginTop: -SHEET_OVERLAP,
                minHeight: screenHeight + shiftDistance + 300,
                paddingBottom: insets.bottom + Spacing.xxl + 400,
                opacity: introFade,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.15}>Login</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
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
                <Text style={[styles.apiErrorText, { color: colors.danger }]} maxFontSizeMultiplier={1.15}>{apiError}</Text>
              </View>
            ) : null}

            {/* IDENTIFIER — username OR email */}
            <View style={styles.labelRow}>
              <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={1.15}>USERNAME OR EMAIL</Text>
              {identifierError ? renderFieldError(identifierError) : null}
            </View>
            <Animated.View style={{ transform: [{ translateX: shakeIdentifier }] }}>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: inputFill,
                    borderColor: identifierError ? colors.danger : idFocused ? colors.primary : inputHairline,
                  },
                ]}
              >
                <AtSign
                  size={18}
                  color={identifierError ? colors.danger : idFocused ? colors.primary : colors.textGray}
                />
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
                    setIsKeyboardOpen(true);
                    animateExpand(1, 260);
                  }}
                  onBlur={() => setIdFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  maxFontSizeMultiplier={1.15}
                  testID="username-input"
                />
              </View>
            </Animated.View>

            {/* PASSWORD — spaces preserved verbatim */}
            <View style={[styles.labelRow, { marginTop: Spacing.lg }]}>
              <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={1.15}>PASSWORD</Text>
              {passwordError ? renderFieldError(passwordError) : null}
            </View>
            <Animated.View style={{ transform: [{ translateX: shakePassword }] }}>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: inputFill,
                    borderColor: passwordError ? colors.danger : passFocused ? colors.primary : inputHairline,
                  },
                ]}
              >
                <Lock
                  size={18}
                  color={passwordError ? colors.danger : passFocused ? colors.primary : colors.textGray}
                />
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
                    setIsKeyboardOpen(true);
                    animateExpand(1, 260);
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
                  maxFontSizeMultiplier={1.15}
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
              <Text style={[styles.spaceHint, { color: colors.textGray }]} maxFontSizeMultiplier={1.15} testID="password-space-hint">
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
              <Text style={[styles.forgotText, { color: colors.primary }]} maxFontSizeMultiplier={1.15}>Forgot Password?</Text>
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
                  <Text style={styles.buttonText} maxFontSizeMultiplier={1.15}>Log In</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              )}
            </TouchableOpacity>

            {/* SIGN UP */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.linkContainer}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="register-link"
            >
              <Text style={[styles.linkText, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
                Don&apos;t have an account?{' '}
                <Text style={{ color: colors.primary, fontFamily: FontFamily.bold }} maxFontSizeMultiplier={1.15}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
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
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    letterSpacing: 2,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  heroHeadlineSmall: {
    fontSize: 19,
    lineHeight: 25,
  },
  heroHeadlineSoft: {
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.88)',
  },
  sheet: {
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
    fontSize: scaledFontSize(FontSizes.xxl, 0.2),
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
    marginTop: Spacing.xs,
    marginBottom: moderateScale(Spacing.lg, 0.2),
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
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    flex: 1,
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
  },
  input: {
    flex: 1,
    paddingVertical: moderateScale(Spacing.sm + 2, 0.2),
    fontSize: scaledFontSize(FontSizes.base, 0.2),
    fontFamily: FontFamily.regular,
    minHeight: moderateScale(48, 0.2),
  },
  eyeButton: {
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  spaceHint: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
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
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
  },
  button: {
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: moderateScale(48, 0.2),
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
  },
  linkContainer: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  linkText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
});

