import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPlus, ArrowRight } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import { signInWithGoogleNative } from '../../services/googleAuth';
import { toUserMessage } from '../../services/errorMessages';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  PortalFontSizes,
  PortalFontSizeMultipliers,
  MAX_CONTENT_WIDTH,
  useResponsive,
} from '../../config/theme';

export default function OnboardingAuthChoiceScreen({ route, navigation }: any) {
  const { colors, isDark } = useThemeColor();
  const { login } = useAuth();
  const { isTablet } = useResponsive();
  const detectedLocation = route?.params?.detectedLocation;

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleLoadingText, setGoogleLoadingText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
    Keyboard.dismiss();
    setGoogleLoading(true);
    setGoogleLoadingText('Connecting with Google...');
    setErrorMessage(null);

    try {
      const googleUser = await signInWithGoogleNative();
      if (!googleUser) {
        setGoogleLoading(false);
        setGoogleLoadingText(null);
        return;
      }

      setGoogleLoadingText('Signing in...');
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
          detectedLocation,
        });
      } else {
        const userPayload = data.user || data;
        await AsyncStorage.setItem('@sugo_customer_onboarding_completed', 'true');
        await AsyncStorage.setItem('@sugo_pending_onboarding_location_setup', 'true');
        if (detectedLocation) {
          try {
            await AsyncStorage.setItem(
              '@sugo_onboarding_location_draft',
              JSON.stringify(detectedLocation)
            );
          } catch {}
        }
        await login(userPayload, data.token, data.refreshToken);
        navigation.replace('CustomerPortal', {
          user: userPayload,
          triggerOnboardingLocationSetup: true,
          detectedLocation,
        });
      }
    } catch (err: any) {
      if (err?.message && err.message.includes('Google Sign-In')) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(toUserMessage(err, 'register'));
      }
    } finally {
      setGoogleLoading(false);
      setGoogleLoadingText(null);
    }
  };

  const handleCreateAccount = () => {
    navigation.navigate('Register', { detectedLocation });
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bgApp }]}
      edges={['top', 'bottom']}
    >
      <View style={[styles.container, isTablet && styles.tabletContainer]}>
        {/* Hero Copy */}
        <View style={styles.heroSection}>
          <Text
            style={[styles.headline, { color: colors.textDark }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
          >
            Welcome to Sugo Express
          </Text>
          <Text
            style={[styles.subheadline, { color: colors.textMedium }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          >
            Create an account or sign in to start ordering errands.
          </Text>

          {errorMessage ? (
            <View
              style={[
                styles.errorContainer,
                {
                  backgroundColor: isDark
                    ? 'rgba(239, 68, 68, 0.12)'
                    : '#FEE2E2',
                  borderColor: isDark
                    ? 'rgba(239, 68, 68, 0.3)'
                    : '#FCA5A5',
                },
              ]}
            >
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Action Group */}
        <View style={styles.actionsSection}>
          {/* 1. Google Sign-Up Button */}
          <GoogleSignInButton
            testID="onboarding-google-signup-btn"
            onPress={handleGoogleSignUp}
            loading={googleLoading}
            loadingText={googleLoadingText}
            text="Sign Up with Google"
          />

          {/* 2. Create an Account (Direct) */}
          <TouchableOpacity
            testID="onboarding-create-account-btn"
            style={[
              styles.createAccountBtn,
              {
                backgroundColor: colors.primary,
                borderColor: 'rgba(255, 255, 255, 0.22)',
                borderTopColor: 'rgba(255, 255, 255, 0.40)',
              },
            ]}
            onPress={handleCreateAccount}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Create an Account"
          >
            <View style={styles.btnInnerRow}>
              <UserPlus size={18} color="#FFFFFF" strokeWidth={2.2} />
              <Text
                style={styles.createAccountBtnText}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
              >
                Create an Account
              </Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View
              style={[
                styles.dividerLine,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#E2E8F0',
                },
              ]}
            />
            <Text
              style={[styles.dividerText, { color: colors.textGray }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
            >
              or
            </Text>
            <View
              style={[
                styles.dividerLine,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#E2E8F0',
                },
              ]}
            />
          </View>

          {/* 3. Email or Username (Already have an account) */}
          <TouchableOpacity
            testID="onboarding-login-btn"
            style={[
              styles.loginLinkBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.06)'
                  : '#FFFFFF',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.10)'
                  : '#E2E8F0',
                borderTopColor: isDark
                  ? 'rgba(255, 255, 255, 0.22)'
                  : '#FFFFFF',
                shadowOpacity: isDark ? 0.25 : 0.06,
              },
            ]}
            onPress={handleLogin}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Log in with your email or username"
          >
            <Text
              style={[styles.loginLinkText, { color: colors.textDark }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            >
              Already have an account?
            </Text>
            <Text
              style={[styles.loginSubtext, { color: colors.textGray }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
            >
              Log in with your email or username
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  tabletContainer: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  headline: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  subheadline: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.body,
    lineHeight: 22,
  },
  errorContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
    lineHeight: 18,
  },
  actionsSection: {
    width: '100%',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  createAccountBtn: {
    height: 54,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  createAccountBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.body,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontFamily: FontFamily.bold,
    fontSize: 12,
  },
  loginLinkBtn: {
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  loginLinkText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.body,
  },
  loginSubtext: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    marginTop: 2,
  },
});
