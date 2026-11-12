import React from 'react';
import { createRoot } from 'react-dom/client';
import LoginScreen from '../../src/screens/LoginScreen';
import OnboardingAuthChoiceScreen from '../../src/screens/onboarding/OnboardingAuthChoiceScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
const navigation = { navigate() {}, replace() {}, goBack() {}, addListener: () => () => {}, isFocused: () => true };
const screen = new URLSearchParams(location.search).get('screen');
createRoot(document.getElementById('root')).render(
  <SafeAreaProvider>{screen === 'onboarding' ? <OnboardingAuthChoiceScreen navigation={navigation} route={{ params: {} }} /> : <LoginScreen navigation={navigation} />}</SafeAreaProvider>
);
