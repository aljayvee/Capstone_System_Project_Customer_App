import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  StatusBar,
  useWindowDimensions,
  Platform,
  Easing,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Mail,
  Smartphone,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import AuthHeroPattern from '../components/AuthHeroPattern';

// Matches LoginScreen: the white sheet is pulled up over the hero's bottom edge
// by this much, and the hero pads the same amount back so nothing hides under it.
const SHEET_OVERLAP = 34;

const TOTAL_STEPS = 4;
// Fallback only. The real wait comes from the server's `retryAfterSeconds`,
// which doubles with each code sent to the same address.
const RESEND_COOLDOWN_FALLBACK_SECONDS = 60;

type VerificationChannel = 'EMAIL' | 'PHONE';

export default function RegisterScreen({ navigation, route }: any) {
  const { login } = useAuth();
  const { colors, isDark } = useThemeColor();
  const heroGradient = useAuthHeroGradient();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Active step: 1 to 4
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationChannel, setVerificationChannel] = useState<VerificationChannel>('EMAIL');
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI / Async State
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);

  // Errors & Shaking
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // 60/90/120 FPS Native Animation Nodes
  const introFade = useRef(new Animated.Value(0)).current;
  const sheetRise = useRef(new Animated.Value(24)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;

  const isSmallScreen = screenHeight < 680;
  const heroHeight = Math.max(195, Math.min(screenHeight * 0.28, 255)) + SHEET_OVERLAP;

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

  const goToStep = (nextStep: number, direction: 'forward' | 'backward' = 'forward') => {
    stepFade.setValue(0);
    stepSlide.setValue(direction === 'forward' ? 24 : -24);
    setCurrentStep(nextStep);
    Animated.parallel([
      Animated.timing(stepFade, {
        toValue: 1,
        duration: 260,
        easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
        useNativeDriver: true,
      }),
      Animated.timing(stepSlide, {
        toValue: 0,
        duration: 260,
        easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (globalError) setGlobalError(null);
  };

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);


  // Step 1: Personal Info Validation & Next
  const handleStep1Next = () => {
    const newErrors: Record<string, string | null> = {};
    let hasError = false;

    if (!firstName.trim()) {
      newErrors.firstName = 'Required';
      hasError = true;
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Required';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      triggerShake();
      return;
    }

    setErrors({});
    goToStep(2, 'forward');
  };

  // Step 2: Contact Info Validation & Send OTP (Email or Phone)
  const handleStep2Next = async () => {
    const newErrors: Record<string, string | null> = {};
    let hasError = false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Required';
      hasError = true;
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Check this address';
      hasError = true;
    }

    if (!phone.trim()) {
      newErrors.phone = 'Required';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      triggerShake();
      return;
    }

    if (verificationChannel === 'PHONE') {
      await handleVerifyPhoneWithFirebase();
      return;
    }

    const target = email.trim().toLowerCase();

    // Same recipient, code still fresh: go straight back to the code screen
    if (otpSentTo === target && cooldown > 0) {
      setErrors({});
      setGlobalError(null);
      goToStep(3, 'forward');
      return;
    }

    setLoading(true);
    setGlobalError(null);
    try {
      const res = await apiClient.post('/customers/send-registration-otp', { email: target });
      setErrors({});
      setCooldown(res.data?.retryAfterSeconds ?? RESEND_COOLDOWN_FALLBACK_SECONDS);
      setOtpSentTo(target);
      goToStep(3, 'forward');
    } catch (error: any) {
      setGlobalError(toUserMessage(error, 'otp'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneWithFirebase = async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const cleanPhone = phone.trim();
      const redirectUrl = Linking.createURL('phone-verified');
      const authUrl = `https://portal.sugo-express.org/verify-phone?phone=${encodeURIComponent(cleanPhone)}&redirect=${encodeURIComponent(redirectUrl)}`;

      const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (authResult.type === 'success' && authResult.url) {
        const parsed = Linking.parse(authResult.url);
        const token = (parsed.queryParams?.token as string) || null;
        const verifiedNumber = (parsed.queryParams?.phone as string) || null;

        if (token) {
          setFirebaseIdToken(token);
          setPhoneVerified(true);
          if (verifiedNumber) {
            setPhone(verifiedNumber);
          }
          setErrors({});
          setGlobalError(null);
          goToStep(4, 'forward');
          return;
        }
      } else if (authResult.type === 'cancel') {
        setGlobalError('Phone verification was cancelled.');
      }
    } catch (err: any) {
      setGlobalError(toUserMessage(err, 'otp'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP Code
  const handleStep3Verify = async () => {
    if (otpCode.trim().length !== 6) {
      setErrors({ otp: 'Enter all 6 digits' });
      triggerShake();
      return;
    }

    setLoading(true);
    setGlobalError(null);
    try {
      if (verificationChannel === 'EMAIL') {
        await apiClient.post('/customers/verify-registration-otp', {
          email: email.trim().toLowerCase(),
          code: otpCode.trim(),
        });
      } else {
        await apiClient.post('/customers/verify-registration-phone-otp', {
          phone: phone.trim(),
          code: otpCode.trim(),
        });
      }
      setErrors({});
      goToStep(4, 'forward');
    } catch (error: any) {
      setGlobalError(toUserMessage(error, 'otp'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 3
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setGlobalError(null);
    try {
      const res =
        verificationChannel === 'EMAIL'
          ? await apiClient.post('/customers/send-registration-otp', {
              email: email.trim().toLowerCase(),
            })
          : await apiClient.post('/customers/send-registration-phone-otp', {
              phone: phone.trim(),
            });
      setCooldown(res.data?.retryAfterSeconds ?? RESEND_COOLDOWN_FALLBACK_SECONDS);
      setOtpSentTo(verificationChannel === 'EMAIL' ? email.trim().toLowerCase() : phone.trim());
    } catch (error: any) {
      setGlobalError(toUserMessage(error, 'otp'));
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Final Registration Submit
  const handleStep4Submit = async () => {
    const newErrors: Record<string, string | null> = {};
    let hasError = false;

    if (!username.trim()) {
      newErrors.username = 'Required';
      hasError = true;
    }
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedPassword.length === 0) {
      newErrors.password = 'Required';
      hasError = true;
    } else if (trimmedPassword.length < 6) {
      newErrors.password = 'Use 6+ characters';
      hasError = true;
    }
    if (trimmedPassword !== trimmedConfirm) {
      newErrors.confirmPassword = 'Passwords must match';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      triggerShake();
      return;
    }

    setLoading(true);
    setGlobalError(null);
    try {
      const response = await apiClient.post('/customers/register', {
        username: username.trim(),
        password: trimmedPassword,
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        phone: phone.trim(),
        emailVerified: verificationChannel === 'EMAIL',
        phoneVerified: phoneVerified,
        firebaseIdToken: firebaseIdToken || undefined,
      });

      const data = response.data;
      const userPayload = data.user || data;

      if (data.token) {
        await AsyncStorage.setItem('@sugo_customer_onboarding_completed', 'true');
        await AsyncStorage.setItem('@sugo_pending_onboarding_location_setup', 'true');
        if (route?.params?.detectedLocation) {
          try {
            await AsyncStorage.setItem(
              '@sugo_onboarding_location_draft',
              JSON.stringify(route.params.detectedLocation)
            );
          } catch {}
        }
        await login(userPayload, data.token, data.refreshToken);
        navigation.replace('CustomerPortal', {
          user: userPayload,
          triggerOnboardingLocationSetup: true,
          detectedLocation: route?.params?.detectedLocation,
        });
      } else {
        navigation.replace('Login');
      }
    } catch (error: any) {
      setGlobalError(toUserMessage(error, 'register'));
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Top Back Button Handler
  const handleBack = () => {
    if (currentStep > 1) {
      setGlobalError(null);
      setErrors({});
      goToStep(currentStep - 1, 'backward');
    } else {
      navigation.goBack();
    }
  };

  // Each step's question now lives in the gradient hero instead of the scrolling
  // body, so every step reads the same way: the colour band asks, the white
  // sheet takes the answer.
  const heroTitle = [
    "What's your name?",
    'Account Verification',
    'Enter 6-Digit Code',
    'Create Credentials',
  ][currentStep - 1];

  const heroSubtitle =
    currentStep === 3 ? (
      <>
        {verificationChannel === 'EMAIL'
          ? 'We sent a verification code to '
          : 'We sent an SMS verification code to '}
        <Text style={styles.heroSubtitleStrong}>
          {verificationChannel === 'EMAIL' ? email : phone}
        </Text>
        .
      </>
    ) : (
      [
        'Please enter your legal name as it appears on your official ID.',
        "We'll email you a 6-digit verification code.",
        '',
        'Choose your username and secure password to complete account setup.',
      ][currentStep - 1]
    );

  // Edge spaces are trimmed before the password is hashed; inner ones are kept.
  // Flagged here exactly as LoginScreen does, so what gets saved is no surprise.
  const hasEdgeSpace = useMemo(
    () => password.length > 0 && password.trim().length !== password.length,
    [password]
  );

  const inputFill = isDark ? 'rgba(255,255,255,0.05)' : '#F4F5F7';
  const inputHairline = isDark ? 'rgba(255,255,255,0.08)' : '#ECEDF0';

  return (
    <View style={[styles.root, { backgroundColor: colors.card }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Scrolls, and brings the focused field above the keyboard, the same way
          ForgotPasswordScreen does. This used to slide the sheet up a fixed
          distance instead, inside a View that could not scroll: under Android
          edge-to-edge the window no longer shrinks for the keyboard, so on the
          longer steps the lower fields and the Continue button stayed under
          it with no way to reach them. A tap outside a field still closes the
          keyboard ("handled" lets taps on buttons and fields through). */}
      <KeyboardAwareScrollView
        style={[styles.container, { backgroundColor: colors.card }]}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={Spacing.xxl}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          {/* GRADIENT HERO — back, progress, and this step's question */}
          <Animated.View
            renderToHardwareTextureAndroid
            needsOffscreenAlphaCompositing={Platform.OS === 'android'}
          >
            <LinearGradient
              colors={heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.hero,
                { minHeight: heroHeight, paddingTop: insets.top + Spacing.md },
              ]}
            >
              <AuthHeroPattern width={screenWidth} height={heroHeight} />

              <View style={styles.heroTopRow}>
                <TouchableOpacity
                  onPress={handleBack}
                  style={styles.heroBackBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Go back"
                  testID="register-back"
                >
                  <ChevronLeft size={22} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.heroStepPill}>
                  <Text style={styles.heroStepPillText} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>
                    STEP {currentStep} OF {TOTAL_STEPS}
                  </Text>
                </View>
              </View>

              {/* SEGMENTED PROGRESS — one bar per step */}
              <View style={styles.heroProgressRow}>
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.heroProgressSegment,
                      { backgroundColor: i < currentStep ? '#FFFFFF' : 'rgba(255,255,255,0.28)' },
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.heroTitle} maxFontSizeMultiplier={AuthFontSizeMultipliers.heading}>{heroTitle}</Text>
              {heroSubtitle ? <Text style={styles.heroSubtitleText} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>{heroSubtitle}</Text> : null}
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
                paddingBottom: insets.bottom + Spacing.xl,
                opacity: introFade,
                transform: [{ translateY: sheetRise }],
              },
            ]}
          >
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              {/* GLOBAL API ERROR BANNER */}
              {globalError ? (
                <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: colors.danger }]}>
                  <AlertCircle size={16} color={colors.danger} />
                  <Text style={[styles.errorBannerText, { color: colors.danger }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>{globalError}</Text>
                </View>
              ) : null}

              {/* ANIMATED STEP CONTENT WITH 60/90/120 FPS HARDWARE ACCELERATION */}
              <Animated.View
                renderToHardwareTextureAndroid
                style={{
                  opacity: stepFade,
                  transform: [{ translateX: stepSlide }],
                }}
              >
                {/* ========================================================================= */}
                {/* STEP 1: PERSONAL INFORMATION */}
                {/* ========================================================================= */}
                {currentStep === 1 && (
                  <View style={styles.stepContent}>
                    {/* FIRST NAME */}
                    <View style={styles.labelHeaderRow}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>FIRST NAME *</Text>
                      {errors.firstName ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>{errors.firstName}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.firstName ? colors.danger : inputHairline,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Enter first name"
                        placeholderTextColor={colors.textLight}
                        value={firstName}
                        onChangeText={(text) => {
                          setFirstName(text);
                          clearError('firstName');
                        }}
                        autoCapitalize="words"
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                    </View>

                    {/* MIDDLE NAME (OPTIONAL) */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>MIDDLE NAME (OPTIONAL)</Text>
                    </View>
                    <View style={[styles.inputWrapper, { backgroundColor: inputFill, borderColor: inputHairline }]}>
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Enter middle name"
                        placeholderTextColor={colors.textLight}
                        value={middleName}
                        onChangeText={setMiddleName}
                        autoCapitalize="words"
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                    </View>

                    {/* LAST NAME */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>LAST NAME *</Text>
                      {errors.lastName ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>{errors.lastName}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.lastName ? colors.danger : inputHairline,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Enter last name"
                        placeholderTextColor={colors.textLight}
                        value={lastName}
                        onChangeText={(text) => {
                          setLastName(text);
                          clearError('lastName');
                        }}
                        autoCapitalize="words"
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                    </View>

                    {/* NEXT BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
                      onPress={handleStep1Next}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryBtnText} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>Continue</Text>
                      <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* ========================================================================= */}
                {/* STEP 2: CONTACT & VERIFICATION METHOD CHOICE */}
                {/* ========================================================================= */}
                {currentStep === 2 && (
                  <View style={styles.stepContent}>
                    {/* EMAIL ADDRESS */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.md }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>
                        EMAIL ADDRESS *
                      </Text>
                      {errors.email ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.email}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.email ? colors.danger : inputHairline,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="name@example.com"
                        placeholderTextColor={colors.textLight}
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          clearError('email');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                    </View>

                    {/* PHONE NUMBER */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>
                        PHONE NUMBER *
                      </Text>
                      {errors.phone ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.phone}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.phone ? colors.danger : inputHairline,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="09123456789"
                        placeholderTextColor={colors.textLight}
                        value={phone}
                        onChangeText={(text) => {
                          setPhone(text);
                          clearError('phone');
                        }}
                        keyboardType="phone-pad"
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                    </View>

                    {/* VERIFICATION METHOD PICKER */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>
                        VERIFY VIA *
                      </Text>
                    </View>
                    <View style={[styles.channelToggleContainer, { borderColor: inputHairline, backgroundColor: inputFill }]}>
                      <TouchableOpacity
                        style={[
                          styles.channelTab,
                          verificationChannel === 'EMAIL' && [
                            styles.channelTabActive,
                            { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.16)' : '#FEE2E2' },
                          ],
                        ]}
                        onPress={() => setVerificationChannel('EMAIL')}
                        activeOpacity={0.8}
                      >
                        <Mail size={16} color={verificationChannel === 'EMAIL' ? colors.primary : colors.textMedium} />
                        <Text
                          style={[
                            styles.channelTabText,
                            { color: verificationChannel === 'EMAIL' ? colors.primary : colors.textMedium },
                          ]}
                          maxFontSizeMultiplier={AuthFontSizeMultipliers.label}
                        >
                          Email OTP
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.channelTab,
                          verificationChannel === 'PHONE' && [
                            styles.channelTabActive,
                            { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.16)' : '#FEE2E2' },
                          ],
                        ]}
                        onPress={() => setVerificationChannel('PHONE')}
                        activeOpacity={0.8}
                      >
                        <Smartphone size={16} color={verificationChannel === 'PHONE' ? colors.primary : colors.textMedium} />
                        <Text
                          style={[
                            styles.channelTabText,
                            { color: verificationChannel === 'PHONE' ? colors.primary : colors.textMedium },
                          ]}
                          maxFontSizeMultiplier={AuthFontSizeMultipliers.label}
                        >
                          SMS (Phone)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* SEND OTP BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp, loading && { opacity: 0.7 }]}
                      onPress={handleStep2Next}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>
                            {verificationChannel === 'PHONE'
                              ? 'Verify Phone via SMS'
                              : otpSentTo === email.trim().toLowerCase() && cooldown > 0
                                ? 'Back to Code'
                                : 'Send Code via Email'}
                          </Text>
                          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* ========================================================================= */}
                {/* STEP 3: OTP VERIFICATION */}
                {/* ========================================================================= */}
                {currentStep === 3 && (
                  <View style={styles.stepContent}>
                    {/* OTP INPUT */}
                    <View style={styles.labelHeaderRow}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>VERIFICATION CODE *</Text>
                      {errors.otp ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.otp}</Text>
                        </View>
                      ) : null}
                    </View>

                    <TextInput
                      style={[
                        styles.otpInput,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.otp ? colors.danger : colors.primary,
                          color: colors.textDark,
                        },
                      ]}
                      placeholder="000000"
                      placeholderTextColor={colors.textLight}
                      value={otpCode}
                      onChangeText={(text) => {
                        setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                        clearError('otp');
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      autoFocus
                    />

                    {/* VERIFY CODE ACTION BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp, loading && { opacity: 0.7 }]}
                      onPress={handleStep3Verify}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>Verify & Proceed</Text>
                          <CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.5} />
                        </>
                      )}
                    </TouchableOpacity>

                    {/* RESEND CODE BUTTON */}
                    <TouchableOpacity
                      onPress={handleResendOtp}
                      disabled={cooldown > 0 || loading}
                      style={styles.resendBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={[styles.resendText, { color: cooldown > 0 ? colors.textLight : colors.primary }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't receive the code? Resend Code"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ========================================================================= */}
                {/* STEP 4: USERNAME & PASSWORD CREATION */}
                {/* ========================================================================= */}
                {currentStep === 4 && (
                  <View style={styles.stepContent}>
                    {phoneVerified ? (
                      <View
                        style={[
                          styles.verifiedBadge,
                          {
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#D1FAE5',
                            borderColor: '#10B981',
                          },
                        ]}
                      >
                        <CheckCircle2 size={16} color="#10B981" />
                        <Text
                          style={[
                            styles.verifiedBadgeText,
                            { color: isDark ? '#34D399' : '#065F46' },
                          ]}
                          maxFontSizeMultiplier={AuthFontSizeMultipliers.body}
                        >
                          Phone Verified: {phone}
                        </Text>
                      </View>
                    ) : null}

                    {/* USERNAME */}
                    <View style={styles.labelHeaderRow}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>USERNAME *</Text>
                      {errors.username ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.username}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.username ? colors.danger : inputHairline,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Choose a username"
                        placeholderTextColor={colors.textLight}
                        value={username}
                        onChangeText={(text) => {
                          setUsername(text);
                          clearError('username');
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                    </View>

                    {/* PASSWORD */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>PASSWORD *</Text>
                      {errors.password ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.password}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.password ? colors.danger : inputHairline,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Create a strong password (min 6)"
                        placeholderTextColor={colors.textLight}
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          clearError('password');
                        }}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword((p) => !p)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {showPassword ? <EyeOff size={18} color={colors.textGray} /> : <Eye size={18} color={colors.textGray} />}
                      </TouchableOpacity>
                    </View>

                    {hasEdgeSpace ? (
                      <Text style={[styles.spaceHint, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body} testID="password-space-hint">
                        Spaces at the start and end are ignored. Spaces inside your password still count.
                      </Text>
                    ) : null}

                    {/* CONFIRM PASSWORD */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.label}>CONFIRM PASSWORD *</Text>
                      {errors.confirmPassword ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.confirmPassword}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.confirmPassword ? colors.danger : inputHairline,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Re-enter your password"
                        placeholderTextColor={colors.textLight}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          clearError('confirmPassword');
                        }}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        maxFontSizeMultiplier={AuthFontSizeMultipliers.input}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword((p) => !p)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {showConfirmPassword ? <EyeOff size={18} color={colors.textGray} /> : <Eye size={18} color={colors.textGray} />}
                      </TouchableOpacity>
                    </View>

                    {/* FINAL SUBMIT BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp, loading && { opacity: 0.7 }]}
                      onPress={handleStep4Submit}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>Complete Account Creation</Text>
                          <CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.5} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>

              {/* FOOTER SIGN IN LINK */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.footerLink}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.footerText, { color: colors.textGray }]} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>
                  Already have an account?{' '}
                  <Text style={{ color: colors.primary, fontFamily: FontFamily.bold }} maxFontSizeMultiplier={AuthFontSizeMultipliers.body}>Log In</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
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
  heroStepPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroStepPillText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    letterSpacing: 1.5,
  },
  heroProgressRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: Spacing.lg,
  },
  heroProgressSegment: {
    flex: 1,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  // Outside the FontSizes scale on purpose — this is the display line, matching
  // LoginScreen's headline treatment.
  heroTitle: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xxl),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xxl), 'heading'),
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  heroSubtitleText: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
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
    paddingTop: Spacing.lg,
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  stepContent: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  spaceHint: {
    fontFamily: FontFamily.medium,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'body'),
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    flex: 1,
  },
  // Unused while verification is email-only. Kept so restoring the Email/SMS
  // toggle is a markup change alone — see the verificationChannel declaration.
  channelToggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: 4,
    marginBottom: Spacing.md,
    gap: 4,
  },
  channelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  channelTabActive: {
    borderRadius: BorderRadius.lg,
  },
  channelTabText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
  },
  labelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
    fontFamily: FontFamily.bold,
    letterSpacing: 0.8,
  },
  shoutBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  shoutText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.xs), 'label'),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.sm + 4,
    minHeight: AuthContainerHeights.inputMinHeight,
  },
  input: {
    flex: 1,
    paddingVertical: moderateScale(Spacing.sm + 2, 0.2),
    fontSize: scaledAuthFontSize(AuthFontSizes.base),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.base), 'input'),
    fontFamily: FontFamily.regular,
  },
  eyeBtn: {
    padding: Spacing.xs,
    justifyContent: 'center',
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
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    minHeight: AuthContainerHeights.buttonMinHeight,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledAuthFontSize(AuthFontSizes.md),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.md), 'heading'),
  },
  resendBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  resendText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
  footerLink: {
    marginTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledAuthFontSize(AuthFontSizes.sm),
    lineHeight: getAuthLineHeight(scaledAuthFontSize(AuthFontSizes.sm), 'body'),
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  verifiedBadgeText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledAuthFontSize(AuthFontSizes.xs),
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
