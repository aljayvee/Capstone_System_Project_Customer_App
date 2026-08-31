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
  Keyboard,
  Platform,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  User,
  Calendar as CalendarIcon,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react-native';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAuthHeroGradient } from '../hooks/useAuthHeroGradient';
import CalendarPickerModal from '../components/CalendarPickerModal';
import AuthHeroPattern from '../components/AuthHeroPattern';

// Matches LoginScreen: the white sheet is pulled up over the hero's bottom edge
// by this much, and the hero pads the same amount back so nothing hides under it.
const SHEET_OVERLAP = 34;

const TOTAL_STEPS = 5;
// Fallback only. The real wait comes from the server's `retryAfterSeconds`,
// which doubles with each code sent to the same address.
const RESEND_COOLDOWN_FALLBACK_SECONDS = 60;

type VerificationChannel = 'EMAIL' | 'PHONE';

export default function RegisterScreen({ navigation }: any) {
  const { login } = useAuth();
  const { colors, isDark } = useThemeColor();
  const heroGradient = useAuthHeroGradient();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Active step: 1 to 5
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Pinned to EMAIL: there is no SMS gateway wired up.
  const [verificationChannel] = useState<VerificationChannel>('EMAIL');
  const [otpCode, setOtpCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI / Async State
  const [loading, setLoading] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);

  // Errors & Shaking
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  // 60/90/120 FPS Native Animation Nodes
  const introFade = useRef(new Animated.Value(0)).current;
  const sheetRise = useRef(new Animated.Value(24)).current;
  const expandProgress = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;

  const isSmallScreen = screenHeight < 680;
  const heroHeight = Math.max(195, Math.min(screenHeight * 0.28, 255)) + SHEET_OVERLAP;
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
    const duration = customDuration && customDuration > 0 ? customDuration : isOpening ? 280 : 240;
    const easing = isOpening
      ? Easing.bezier(0.2, 0.0, 0.0, 1.0)
      : Easing.bezier(0.4, 0.0, 0.2, 1.0);

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
      animateExpand(1, e?.duration);
    };

    const onKeyboardHide = (e?: any) => {
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

  // Adaptive native transforms
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
      newErrors.firstName = 'First name required!';
      hasError = true;
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name required!';
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

  // Step 2: Birthdate Validation & Next
  const handleStep2Next = () => {
    if (!birthdate.trim()) {
      setErrors({ birthdate: 'Birthdate required!' });
      triggerShake();
      return;
    }
    setErrors({});
    goToStep(3, 'forward');
  };

  // Step 3: Contact Info Validation & Send OTP (Email or Phone)
  const handleStep3Next = async () => {
    const newErrors: Record<string, string | null> = {};
    let hasError = false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email address required!';
      hasError = true;
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Enter a valid email address!';
      hasError = true;
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number required!';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      triggerShake();
      return;
    }

    const target = verificationChannel === 'EMAIL' ? email.trim().toLowerCase() : phone.trim();

    // Same recipient, code still fresh: go straight back to the code screen
    if (otpSentTo === target && cooldown > 0) {
      setErrors({});
      setGlobalError(null);
      goToStep(4, 'forward');
      return;
    }

    setLoading(true);
    setGlobalError(null);
    try {
      const res =
        verificationChannel === 'EMAIL'
          ? await apiClient.post('/customers/send-registration-otp', { email: target })
          : await apiClient.post('/customers/send-registration-phone-otp', { phone: target });
      setErrors({});
      setCooldown(res.data?.retryAfterSeconds ?? RESEND_COOLDOWN_FALLBACK_SECONDS);
      setOtpSentTo(target);
      goToStep(4, 'forward');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Could not send verification code.';
      setGlobalError(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verify OTP Code
  const handleStep4Verify = async () => {
    if (otpCode.trim().length !== 6) {
      setErrors({ otp: 'Enter 6-digit code!' });
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
      goToStep(5, 'forward');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Invalid or expired code.';
      setGlobalError(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 4
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
      const msg = error.response?.data?.error || error.message || 'Could not resend code.';
      setGlobalError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Final Registration Submit
  const handleStep5Submit = async () => {
    const newErrors: Record<string, string | null> = {};
    let hasError = false;

    if (!username.trim()) {
      newErrors.username = 'Username required!';
      hasError = true;
    }
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedPassword.length === 0) {
      newErrors.password = 'Password required!';
      hasError = true;
    } else if (trimmedPassword.length < 6) {
      newErrors.password = 'Min 6 characters!';
      hasError = true;
    }
    if (trimmedPassword !== trimmedConfirm) {
      newErrors.confirmPassword = 'Passwords do not match!';
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
        birthdate: birthdate.trim(),
        phone: phone.trim(),
        emailVerified: true,
      });

      const data = response.data;
      const userPayload = data.user || data;

      if (data.token) {
        await login(userPayload, data.token, data.refreshToken);
        navigation.replace('CustomerPortal', { user: userPayload });
      } else {
        navigation.replace('Login');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Registration failed. Please try again.';
      setGlobalError(msg);
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
    'When were you born?',
    'Account Verification',
    'Enter 6-Digit Code',
    'Create Credentials',
  ][currentStep - 1];

  const heroSubtitle =
    currentStep === 4 ? (
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
        'Your birthdate is used to verify eligibility and personalize your experience.',
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

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {/* GRADIENT HERO — back, progress, and this step's question */}
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
                  <Text style={styles.heroStepPillText}>
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

              <Text style={styles.heroTitle}>{heroTitle}</Text>
              {heroSubtitle ? <Text style={styles.heroSubtitleText}>{heroSubtitle}</Text> : null}
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
                minHeight: screenHeight + shiftDistance + 300,
                paddingBottom: insets.bottom + Spacing.xl + 300,
                opacity: introFade,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              {/* GLOBAL API ERROR BANNER */}
              {globalError ? (
                <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: colors.danger }]}>
                  <AlertCircle size={16} color={colors.danger} />
                  <Text style={[styles.errorBannerText, { color: colors.danger }]}>{globalError}</Text>
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
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>FIRST NAME *</Text>
                      {errors.firstName ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.firstName}</Text>
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
                      <User size={18} color={errors.firstName ? colors.danger : colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Enter first name"
                        placeholderTextColor={colors.textLight}
                        value={firstName}
                        onChangeText={(text) => {
                          setFirstName(text);
                          clearError('firstName');
                        }}
                        onFocus={() => animateExpand(1, 260)}
                        autoCapitalize="words"
                      />
                    </View>

                    {/* MIDDLE NAME (OPTIONAL) */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>MIDDLE NAME (OPTIONAL)</Text>
                    </View>
                    <View style={[styles.inputWrapper, { backgroundColor: inputFill, borderColor: inputHairline }]}>
                      <User size={18} color={colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Enter middle name"
                        placeholderTextColor={colors.textLight}
                        value={middleName}
                        onChangeText={setMiddleName}
                        onFocus={() => animateExpand(1, 260)}
                        autoCapitalize="words"
                      />
                    </View>

                    {/* LAST NAME */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>LAST NAME *</Text>
                      {errors.lastName ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.lastName}</Text>
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
                      <User size={18} color={errors.lastName ? colors.danger : colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Enter last name"
                        placeholderTextColor={colors.textLight}
                        value={lastName}
                        onChangeText={(text) => {
                          setLastName(text);
                          clearError('lastName');
                        }}
                        onFocus={() => animateExpand(1, 260)}
                        autoCapitalize="words"
                      />
                    </View>

                    {/* NEXT BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
                      onPress={handleStep1Next}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryBtnText}>Continue</Text>
                      <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* ========================================================================= */}
                {/* STEP 2: BIRTHDATE */}
                {/* ========================================================================= */}
                {currentStep === 2 && (
                  <View style={styles.stepContent}>
                    {/* BIRTHDATE SELECTOR */}
                    <View style={styles.labelHeaderRow}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>BIRTHDATE (YYYY-MM-DD) *</Text>
                      {errors.birthdate ? (
                        <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                          <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.birthdate}</Text>
                        </View>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: inputFill,
                          borderColor: errors.birthdate ? colors.danger : inputHairline,
                        },
                      ]}
                      onPress={() => setShowCalendarModal(true)}
                      activeOpacity={0.8}
                    >
                      <CalendarIcon size={18} color={colors.primary} />
                      <Text
                        style={[
                          styles.dateSelectText,
                          { color: birthdate ? colors.textDark : colors.textLight },
                        ]}
                      >
                        {birthdate || 'Tap to choose birthdate from calendar'}
                      </Text>
                    </TouchableOpacity>

                    {/* CALENDAR PICKER MODAL */}
                    <CalendarPickerModal
                      visible={showCalendarModal}
                      onClose={() => setShowCalendarModal(false)}
                      initialDate={birthdate}
                      onSelectDate={(d) => {
                        setBirthdate(d);
                        clearError('birthdate');
                      }}
                    />

                    {/* HELPER CARD */}
                    <View style={[styles.infoCard, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.08)' : '#FFF5F8', borderColor: isDark ? 'rgba(246, 36, 89, 0.2)' : '#FCE7F0' }]}>
                      <Sparkles size={18} color={colors.primary} />
                      <Text style={[styles.infoCardText, { color: colors.textMedium }]}>
                        We use your birthdate to secure account recovery and verify legal capacity for errand orders.
                      </Text>
                    </View>

                    {/* NEXT BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp]}
                      onPress={handleStep2Next}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryBtnText}>Continue</Text>
                      <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* ========================================================================= */}
                {/* STEP 3: CONTACT & VERIFICATION METHOD CHOICE */}
                {/* ========================================================================= */}
                {currentStep === 3 && (
                  <View style={styles.stepContent}>
                    {/* EMAIL ADDRESS */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.md }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>
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
                      <Mail size={18} color={errors.email ? colors.danger : colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="name@example.com"
                        placeholderTextColor={colors.textLight}
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          clearError('email');
                        }}
                        onFocus={() => animateExpand(1, 260)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    {/* PHONE NUMBER */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>
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
                      <Phone size={18} color={errors.phone ? colors.danger : colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="09123456789"
                        placeholderTextColor={colors.textLight}
                        value={phone}
                        onChangeText={(text) => {
                          setPhone(text);
                          clearError('phone');
                        }}
                        onFocus={() => animateExpand(1, 260)}
                        keyboardType="phone-pad"
                      />
                    </View>

                    {/* SEND OTP BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp, loading && { opacity: 0.7 }]}
                      onPress={handleStep3Next}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText}>
                            {otpSentTo === email.trim().toLowerCase() && cooldown > 0
                              ? 'Back to Code'
                              : verificationChannel === 'EMAIL'
                                ? 'Send Code via Email'
                                : 'Send Code via SMS'}
                          </Text>
                          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* ========================================================================= */}
                {/* STEP 4: OTP VERIFICATION */}
                {/* ========================================================================= */}
                {currentStep === 4 && (
                  <View style={styles.stepContent}>
                    {/* OTP INPUT */}
                    <View style={styles.labelHeaderRow}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>VERIFICATION CODE *</Text>
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
                      onFocus={() => animateExpand(1, 260)}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />

                    {/* VERIFY CODE ACTION BUTTON */}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primary }, Shadows.liftedUp, loading && { opacity: 0.7 }]}
                      onPress={handleStep4Verify}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText}>Verify & Proceed</Text>
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
                      <Text style={[styles.resendText, { color: cooldown > 0 ? colors.textLight : colors.primary }]}>
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't receive the code? Resend Code"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ========================================================================= */}
                {/* STEP 5: USERNAME & PASSWORD CREATION */}
                {/* ========================================================================= */}
                {currentStep === 5 && (
                  <View style={styles.stepContent}>
                    {/* USERNAME */}
                    <View style={styles.labelHeaderRow}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>USERNAME *</Text>
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
                      <User size={18} color={errors.username ? colors.danger : colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Choose a username"
                        placeholderTextColor={colors.textLight}
                        value={username}
                        onChangeText={(text) => {
                          setUsername(text);
                          clearError('username');
                        }}
                        onFocus={() => animateExpand(1, 260)}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    {/* PASSWORD */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>PASSWORD *</Text>
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
                      <Lock size={18} color={errors.password ? colors.danger : colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Create a strong password (min 6)"
                        placeholderTextColor={colors.textLight}
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          clearError('password');
                        }}
                        onFocus={() => animateExpand(1, 260)}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
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
                      <Text style={[styles.spaceHint, { color: colors.textGray }]} testID="password-space-hint">
                        Spaces at the start and end are ignored. Spaces inside your password still count.
                      </Text>
                    ) : null}

                    {/* CONFIRM PASSWORD */}
                    <View style={[styles.labelHeaderRow, { marginTop: Spacing.sm }]}>
                      <Text style={[styles.inputLabel, { color: colors.textMedium }]}>CONFIRM PASSWORD *</Text>
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
                      <Lock size={18} color={errors.confirmPassword ? colors.danger : colors.textGray} />
                      <TextInput
                        style={[styles.input, { color: colors.textDark }]}
                        placeholder="Re-enter your password"
                        placeholderTextColor={colors.textLight}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          clearError('confirmPassword');
                        }}
                        onFocus={() => animateExpand(1, 260)}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
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
                      onPress={handleStep5Submit}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryBtnText}>Complete Account Creation</Text>
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
                <Text style={[styles.footerText, { color: colors.textGray }]}>
                  Already have an account?{' '}
                  <Text style={{ color: colors.primary, fontFamily: FontFamily.bold }}>Log In</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
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
    fontSize: FontSizes.xs - 1,
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
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
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
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
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
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  labelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: scaledFontSize(FontSizes.xs - 1, 0.2),
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
    fontSize: scaledFontSize(FontSizes.xs - 1, 0.2),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.sm + 4,
    minHeight: moderateScale(48, 0.2),
  },
  input: {
    flex: 1,
    paddingVertical: moderateScale(Spacing.sm + 2, 0.2),
    fontSize: scaledFontSize(FontSizes.base, 0.2),
    fontFamily: FontFamily.regular,
  },
  dateSelectText: {
    flex: 1,
    fontSize: scaledFontSize(FontSizes.base, 0.2),
    fontFamily: FontFamily.medium,
    paddingVertical: moderateScale(Spacing.sm + 2, 0.2),
  },
  eyeBtn: {
    padding: Spacing.xs,
    justifyContent: 'center',
  },
  otpInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.xl + 4,
    paddingVertical: moderateScale(Spacing.md, 0.2),
    fontSize: scaledFontSize(22, 0.2),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: Spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginVertical: Spacing.sm,
  },
  infoCardText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: moderateScale(16, 0.2),
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: moderateScale(Spacing.md, 0.2),
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
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
  footerLink: {
    marginTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
});
