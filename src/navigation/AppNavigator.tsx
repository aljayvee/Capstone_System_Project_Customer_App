import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import ServiceListScreen from '../screens/ServiceListScreen';
import OrderFormScreen from '../screens/OrderFormScreen';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';
import WaitingForDispatcherScreen from '../screens/WaitingForDispatcherScreen';
import CustomerChatScreen from '../screens/CustomerChatScreen';
import CustomerLocationScreen from '../screens/CustomerLocationScreen';

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
          name="OrderConfirmation"
          component={OrderConfirmationScreen}
          options={{ title: 'Order Confirmation', headerBackVisible: false }}
        />
        <Stack.Screen
          name="WaitingForDispatcher"
          component={WaitingForDispatcherScreen}
          options={{ title: 'Order Status', headerBackVisible: false }}
        />
        <Stack.Screen
          name="CustomerChat"
          component={CustomerChatScreen}
          options={{ title: 'Live Chat' }}
        />
        <Stack.Screen
          name="CustomerLocation"
          component={CustomerLocationScreen}
          options={{ title: 'Delivery Locations' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
