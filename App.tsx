import React from 'react';
import { LogBox } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

LogBox.ignoreLogs(['FIREBASE WARNING: Missing appcheck token']);

export default function App() {
  return <AppNavigator />;
}
