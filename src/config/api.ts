import { Platform } from 'react-native';
import Constants from 'expo-constants';

declare const process: { env: { [key: string]: string | undefined } };

/**
 * API Base URL for CustomerApp.
 * Priority:
 * 1. Explicit EXPO_PUBLIC_API_BASE_URL environment variable if provided.
 * 2. Dynamic host IP from `Constants.expoConfig?.hostUri` (Works automatically for Expo Go on physical devices & emulators).
 * 3. Android Emulator fallback `http://10.0.2.2:5000`.
 * 4. Localhost fallback `http://localhost:5000`.
 */
const getDynamicHostIp = (): string | null => {
  try {
    const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost || (Constants as any).manifest2?.extra?.expoGo?.developer?.tool;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:5000`;
      }
    }
  } catch (e) {
    // Ignore error in non-expo or test environments
  }
  return null;
};

const rawUrl =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL) ||
  getDynamicHostIp() ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000');

export const API_BASE_URL = rawUrl.replace(/\/+$/, '');

export const ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/users`,
  LOGIN_DIRECT: `${API_BASE_URL}/login`,
  REGISTER_DIRECT: `${API_BASE_URL}/register`,
  CUSTOMER_LOGIN: `${API_BASE_URL}/api/customers/login`,
  CUSTOMER_REGISTER: `${API_BASE_URL}/api/customers/register`,
  SYSTEM_LOGIN: `${API_BASE_URL}/api/system/login`,
  SYSTEM_REGISTER: `${API_BASE_URL}/api/system/register`,
};
