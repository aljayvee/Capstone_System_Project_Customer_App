import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_STORAGE_KEY = '@sugo_app_device_id';

export interface DeviceInfo {
  deviceId: string;
  brand: string | null;
  modelName: string | null;
  deviceName: string | null;
  osName: string | null;
  osVersion: string | null;
  isPhysical: boolean;
  platform: string;
}

let cachedDeviceId: string | null = null;
let cachedDeviceInfo: DeviceInfo | null = null;

/**
 * Generates a standard RFC4122 v4 UUID without external dependencies.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves the persistent unique Device ID from AsyncStorage.
 * If none exists, generates a new UUID and persists it securely.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }

    const newId = `DEV-${Platform.OS.toUpperCase()}-${generateUUID()}`;
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    cachedDeviceId = newId;
    return newId;
  } catch {
    // Fallback in-memory ID if storage fails
    const fallbackId = `DEV-FALLBACK-${generateUUID()}`;
    cachedDeviceId = fallbackId;
    return fallbackId;
  }
}

/**
 * Returns comprehensive device metadata for security auditing, session tracking,
 * and adaptive rate limiting.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  if (cachedDeviceInfo) {
    return cachedDeviceInfo;
  }

  const deviceId = await getDeviceId();

  const info: DeviceInfo = {
    deviceId,
    brand: Device.brand || null,
    modelName: Device.modelName || Device.productName || null,
    deviceName: Device.deviceName || null,
    osName: Device.osName || Platform.OS,
    osVersion: Device.osVersion || String(Platform.Version),
    isPhysical: Device.isDevice ?? true,
    platform: Platform.OS,
  };

  cachedDeviceInfo = info;
  return info;
}

/**
 * Prepares standard security headers for Axios API client requests.
 */
export async function getDeviceHeaders(): Promise<Record<string, string>> {
  const info = await getDeviceInfo();
  return {
    'x-device-id': info.deviceId,
    'x-device-model': `${info.brand || ''} ${info.modelName || 'Unknown Device'}`.trim(),
    'x-device-os': `${info.osName} ${info.osVersion || ''}`.trim(),
    'x-device-platform': info.platform,
    'x-device-physical': String(info.isPhysical),
  };
}
