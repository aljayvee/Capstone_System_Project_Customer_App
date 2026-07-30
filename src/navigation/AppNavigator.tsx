import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import ServiceListScreen from '../screens/ServiceListScreen';
import OrderFormScreen from '../screens/OrderFormScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#F62459' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
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
          name="CustomerPortal"
          component={CustomerPortalScreen}
          options={{ title: 'Customer Dashboard' }}
        />
        <Stack.Screen
          name="ServiceList"
          component={ServiceListScreen}
          options={{ title: 'Select Service' }}
        />
        <Stack.Screen
          name="OrderForm"
          component={OrderFormScreen}
          options={{ title: 'Order Details' }}
        />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{ title: 'Checkout & Payment' }}
        />
        <Stack.Screen
          name="OrderConfirmation"
          component={OrderConfirmationScreen}
          options={{ title: 'Order Confirmation', headerBackVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
