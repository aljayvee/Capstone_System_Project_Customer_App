import React from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SystemUI from 'expo-system-ui';
import { RootStackParamList } from './types';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useThemeColor } from '../hooks/useThemeColor';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import ServiceListScreen from '../screens/ServiceListScreen';
import ErrandFormScreen from '../screens/ErrandFormScreen';
import ErrandItemsScreen from '../screens/ErrandItemsScreen';
import ErrandConfirmationScreen from '../screens/ErrandConfirmationScreen';
import WaitingForDispatcherScreen from '../screens/WaitingForDispatcherScreen';
import CustomerChatScreen from '../screens/CustomerChatScreen';
import ActiveChatsScreen from '../screens/ActiveChatsScreen';
import CustomerLocationScreen from '../screens/CustomerLocationScreen';
import EditAccountScreen from '../screens/EditAccountScreen';
import AccountScreen from '../screens/AccountScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationScreen from '../screens/Notification';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function NavigationContent() {
  const { user, isLoading } = useAuth();
  const { colors, isDark } = useThemeColor();
  const [isSplashComplete, setIsSplashComplete] = React.useState(false);

  React.useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bgApp).catch(() => {});
  }, [colors.bgApp]);

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

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#F62459' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
        {!user ? (
          // Auth Stack - Unauthenticated users
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
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
              name="VerifyEmail"
              component={VerifyEmailScreen}
              options={{ title: 'Verify Email' }}
            />
          </>
        ) : (
          // Main App Stack - Authenticated Customer
          <>
            <Stack.Screen
              name="CustomerPortal"
              component={CustomerPortalScreen}
              options={{ headerShown: false }}
              initialParams={{ user: user as any }}
            />
            <Stack.Screen
              name="ServiceList"
              component={ServiceListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ErrandForm"
              component={ErrandFormScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ErrandItems"
              component={ErrandItemsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ErrandConfirmation"
              component={ErrandConfirmationScreen}
              options={{ title: 'Errand Confirmation', headerBackVisible: false }}
            />
            <Stack.Screen
              name="WaitingForDispatcher"
              component={WaitingForDispatcherScreen}
              options={{ headerShown: false }}
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
              options={{ headerShown: false }}
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
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>

    {!isSplashComplete && (
      <AnimatedSplashScreen
        isAppReady={!isLoading}
        onAnimationComplete={() => setIsSplashComplete(true)}
      />
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
          <AuthProvider>
            <NavigationContent />
          </AuthProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
