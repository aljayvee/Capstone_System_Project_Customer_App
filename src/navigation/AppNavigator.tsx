import React from 'react';
import { View, ActivityIndicator, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SystemUI from 'expo-system-ui';
import { NavigationBar } from 'expo-navigation-bar';
import { BlurView } from 'expo-blur';
import { RootStackParamList } from './types';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useThemeColor } from '../hooks/useThemeColor';

import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingLocationScreen from '../screens/onboarding/OnboardingLocationScreen';
import OnboardingAuthChoiceScreen from '../screens/onboarding/OnboardingAuthChoiceScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import GooglePhoneSetupScreen from '../screens/GooglePhoneSetupScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import ServiceListScreen from '../screens/ServiceListScreen';
import ErrandFormScreen from '../screens/ErrandFormScreen';
import PopularStoresScreen from '../screens/PopularStoresScreen';
import StoreSearchScreen from '../screens/StoreSearchScreen';
import ActiveErrandsScreen from '../screens/ActiveErrandsScreen';
import NearbyStoresScreen from '../screens/NearbyStoresScreen';
import MerchantCategoryStoresScreen from '../screens/errand/MerchantCategoryStoresScreen';
import PabiliHubScreen from '../screens/pabili/PabiliHubScreen';
import PabiliStoreEditorScreen from '../screens/pabili/PabiliStoreEditorScreen';
import PabiliReviewScreen from '../screens/pabili/PabiliReviewScreen';
import ErrandConfirmationScreen from '../screens/ErrandConfirmationScreen';
import WaitingForDispatcherScreen from '../screens/WaitingForDispatcherScreen';
import CustomerChatScreen from '../screens/CustomerChatScreen';
import ActiveChatsScreen from '../screens/ActiveChatsScreen';
import CustomerLocationScreen from '../screens/CustomerLocationScreen';
import EditAccountScreen from '../screens/EditAccountScreen';
import AccountScreen from '../screens/AccountScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationScreen from '../screens/Notification';
import ErrandDetailsScreen from '../screens/ErrandDetailsScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import LegalDocumentScreen from '../screens/LegalDocumentScreen';
import * as SplashScreen from 'expo-splash-screen';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';
import OfflineGate from '../components/OfflineGate';
import HalfPaymentPrompt from '../components/HalfPaymentPrompt';
import GlobalAlertModal from '../components/GlobalAlertModal';
import { navigationRef } from './navigationRef';
import MobileErrorBoundary from '../components/MobileErrorBoundary';
import { NetworkProvider } from '../context/NetworkContext';
import { NotificationProvider } from '../context/NotificationContext';

const hideSystemSplash = () => {
  SplashScreen.hideAsync().catch(() => {});
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function NavigationContent() {
  const { user, isLoading } = useAuth();
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const [isSplashComplete, setIsSplashComplete] = React.useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (user) {
      setHasCompletedOnboarding(true);
      void AsyncStorage.setItem('@sugo_customer_onboarding_completed', 'true').catch(() => {});
      return;
    }

    AsyncStorage.getItem('@sugo_customer_onboarding_completed')
      .then((val) => {
        const completed = val === 'true';
        // Once onboarding is completed (or user was authenticated), never revert to false on sign out
        setHasCompletedOnboarding((prev) => (prev === true ? true : completed));
        if (!completed) {
          hideSystemSplash();
        }
      })
      .catch(() => setHasCompletedOnboarding(true));
  }, [user]);

  const prevUserRef = React.useRef(user);
  React.useEffect(() => {
    if (prevUserRef.current && !user) {
      const resetToLogin = () => {
        if (navigationRef.isReady()) {
          try {
            navigationRef.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } catch {
            // Stack.Navigator initialRouteName defaults to Login cleanly
          }
        }
      };

      resetToLogin();
      const timer = setTimeout(resetToLogin, 50);
      return () => clearTimeout(timer);
    }
    prevUserRef.current = user;
  }, [user]);

  React.useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bgApp).catch(() => {});
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setStyle(isDark ? 'light' : 'dark');
      } catch {}
    }
  }, [colors.bgApp, isDark]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bgApp,
      card: colors.card,
      text: colors.textDark,
      border: colors.border,
    },
  };

  if (hasCompletedOnboarding === null) {
    return <View style={{ flex: 1, backgroundColor: colors.bgApp }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme} ref={navigationRef}>
        <Stack.Navigator
          initialRouteName={hasCompletedOnboarding === false ? 'OnboardingLocation' : 'Login'}
          screenOptions={{
            headerStyle: { backgroundColor: '#F62459' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
            animation: 'slide_from_right',
            animationDuration: 280,
            gestureEnabled: true,
            fullScreenGestureEnabled: Platform.OS === 'ios',
          }}
        >
        {!user ? (
          // Auth Stack - Unauthenticated users
          hasCompletedOnboarding ? (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false, animation: 'fade', animationDuration: 200 }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="GooglePhoneSetup"
                component={GooglePhoneSetupScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="VerifyEmail"
                component={VerifyEmailScreen}
                options={{ title: 'Verify Email' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="OnboardingLocation"
                component={OnboardingLocationScreen}
                options={{ headerShown: false, animation: 'fade', animationDuration: 200 }}
              />
              <Stack.Screen
                name="OnboardingAuthChoice"
                component={OnboardingAuthChoiceScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false, animation: 'fade', animationDuration: 200 }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="GooglePhoneSetup"
                component={GooglePhoneSetupScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="VerifyEmail"
                component={VerifyEmailScreen}
                options={{ title: 'Verify Email' }}
              />
            </>
          )
        ) : (
          // Main App Stack - Authenticated Customer
          <>
            <Stack.Screen
              name="CustomerPortal"
              component={CustomerPortalScreen}
              options={{ headerShown: false, animation: 'fade', animationDuration: 200 }}
              initialParams={{ user: user as any }}
            />
            <Stack.Screen
              name="ServiceList"
              component={ServiceListScreen}
              options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="ErrandForm"
              component={ErrandFormScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PopularStores"
              component={PopularStoresScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="StoreSearch"
              component={StoreSearchScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ActiveErrands"
              component={ActiveErrandsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NearbyStores"
              component={NearbyStoresScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MerchantCategoryStores"
              component={MerchantCategoryStoresScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ErrandItems"
              component={PabiliHubScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PabiliStoreEditor"
              component={PabiliStoreEditorScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PabiliReview"
              component={PabiliReviewScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ErrandConfirmation"
              component={ErrandConfirmationScreen}
              options={{ title: 'Errand Confirmation', headerBackVisible: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="WaitingForDispatcher"
              component={WaitingForDispatcherScreen}
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="CustomerChat"
              component={CustomerChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ActiveChats"
              component={ActiveChatsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CustomerLocation"
              component={CustomerLocationScreen}
              options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="EditAccount"
              component={EditAccountScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Account"
              component={AccountScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Notification"
              component={NotificationScreen}
              options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="ErrandDetails"
              component={ErrandDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Feedback"
              component={FeedbackScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
        {/* Outside the split: the onboarding consent line (signed out) and
            Settings (signed in) both open the Terms and the Privacy Policy. */}
        <Stack.Screen
          name="LegalDocument"
          component={LegalDocumentScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>

    {hasCompletedOnboarding === true && (!isSplashComplete || isLoading) && (
      <AnimatedSplashScreen
        isAppReady={!isLoading}
        onFirstFrame={hideSystemSplash}
        onAnimationComplete={() => {
          hideSystemSplash();
          if (!isLoading) {
            setIsSplashComplete(true);
          }
        }}
      />
    )}

    {/* A rider waiting on the customer's half-payment, over any screen. Only
        once signed in: it listens on this customer's own socket room. */}
    {user && <HalfPaymentPrompt />}

    {/* Last child, and a native Modal, so nothing paints over it. */}
    <OfflineGate />

    {/* Branded custom alert & confirmation dialog */}
    <GlobalAlertModal />

    {/* Android 3-Button System Navigation Bar Liquid Glass Blur Dock */}
    {Platform.OS === 'android' && insets.bottom >= 24 && (
      <View
        style={[
          styles.systemNavBarBlurDock,
          {
            height: insets.bottom,
          },
        ]}
        pointerEvents="none"
        testID="system-nav-blur-dock"
      >
        <BlurView
          intensity={45}
          tint={isDark ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(0, 0, 0, 0.35)'
                : 'rgba(255, 255, 255, 0.25)',
            },
          ]}
          testID="system-nav-blur-dock-overlay"
        />
      </View>
    )}
  </View>
  );
}

export default function AppNavigator() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {/* KeyboardProvider feeds the keyboard's live height/progress to any
          screen using KeyboardAwareScrollView (currently LoginScreen). It must
          sit above the navigator so the values survive screen transitions. */}
      <KeyboardProvider>
        <ThemeProvider>
          {/* Below ThemeProvider because the offline surfaces are themed, and
              above AuthProvider because logout() does a best-effort network
              call that has no business firing over a dead link. */}
          <NetworkProvider>
            <AuthProvider>
              {/* Inside the providers so the crash screen is themed and can
                  still read connectivity, rather than rendering a stark
                  unstyled fallback at the very moment things look broken. */}
              <NotificationProvider>
                <MobileErrorBoundary>
                  <NavigationContent />
                </MobileErrorBoundary>
              </NotificationProvider>
            </AuthProvider>
          </NetworkProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  systemNavBarBlurDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    overflow: 'hidden',
  },
});
