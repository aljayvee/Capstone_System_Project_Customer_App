import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from '../config/api';

const CACHE_KEY_LATEST_RELEASE = '@sugo_customer_latest_release_v1';
const LANDING_PAGE_DOWNLOAD_URL = 'https://sugoonthego.online/#download';

export interface AppReleaseMetadata {
  target: 'customer' | 'rider';
  appName: string;
  packageName: string;
  version: string;
  minAndroid: string;
  fileSize: string;
  fileSizeBytes: number;
  fileName: string;
  downloadUrl: string;
  updatedAt: string;
  whatsNew: string[];
  features?: string[];
  fixes?: string[];
  logs?: string[];
  sha256?: string;
}

export interface AppUpdateCheckResult {
  installedVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  release: AppReleaseMetadata | null;
  error?: string | null;
  isOffline?: boolean;
}

/**
 * Cleanly extracts the currently running runtime version of the Customer App.
 */
export function getInstalledAppVersion(): string {
  const version =
    Constants.expoConfig?.version ||
    (Constants as any)?.nativeAppVersion ||
    '1.0.0';
  return version;
}

/**
 * Strict semver comparison algorithm.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 * Handles prefixes ('v1.0.1'), build tags ('1.0.1-rc1'), and uneven components.
 */
export function compareVersions(v1: string, v2: string): number {
  const parseParts = (v: string): number[] => {
    return (v || '')
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
      });
  };

  const parts1 = parseParts(v1);
  const parts2 = parseParts(v2);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Fetches the latest published release from the backend server with offline fallback.
 */
export async function checkCustomerAppUpdate(timeoutMs = 6000): Promise<AppUpdateCheckResult> {
  const installedVersion = getInstalledAppVersion();

  // 1. Try reading cached release first for instant offline readiness
  let cachedRelease: AppReleaseMetadata | null = null;
  try {
    const rawCache = await AsyncStorage.getItem(CACHE_KEY_LATEST_RELEASE);
    if (rawCache) {
      cachedRelease = JSON.parse(rawCache) as AppReleaseMetadata;
    }
  } catch {
    // Ignore cache parse failures
  }

  // 2. Fetch live release from server
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const publicUrl = `${API_BASE_URL}/api/app-releases/public`;
    const response = await fetch(publicUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const customerRelease = data?.releases?.customer as AppReleaseMetadata | undefined;

    if (!customerRelease || !customerRelease.version) {
      throw new Error('Invalid release metadata format received from server.');
    }

    // Persist fresh release to local cache
    await AsyncStorage.setItem(
      CACHE_KEY_LATEST_RELEASE,
      JSON.stringify(customerRelease)
    ).catch(() => {});

    const isUpdateAvailable = compareVersions(customerRelease.version, installedVersion) > 0;

    return {
      installedVersion,
      latestVersion: customerRelease.version,
      isUpdateAvailable,
      release: customerRelease,
      isOffline: false,
      error: null,
    };
  } catch (err: any) {
    // Fall back smoothly to cached release if available
    if (cachedRelease && cachedRelease.version) {
      const isUpdateAvailable = compareVersions(cachedRelease.version, installedVersion) > 0;
      return {
        installedVersion,
        latestVersion: cachedRelease.version,
        isUpdateAvailable,
        release: cachedRelease,
        isOffline: true,
        error: err?.message || 'Could not connect to update server.',
      };
    }

    // Default baseline when entirely offline without cache
    return {
      installedVersion,
      latestVersion: installedVersion,
      isUpdateAvailable: false,
      release: null,
      isOffline: true,
      error: err?.message || 'Unable to check for updates.',
    };
  }
}

export const CACHE_KEY_LAST_RUN_VERSION = '@sugo_customer_last_run_version';

export interface NewlyUpdatedCheckResult {
  isNewlyUpdated: boolean;
  currentVersion: string;
}

/**
 * Checks if the app is newly running an updated version compared to its previous launch.
 * Automatically saves the current version in storage.
 */
export async function checkNewlyUpdatedApp(): Promise<NewlyUpdatedCheckResult> {
  const currentVersion = getInstalledAppVersion();
  try {
    const storedVersion = await AsyncStorage.getItem(CACHE_KEY_LAST_RUN_VERSION);
    if (!storedVersion) {
      // First run on device - record baseline version without false "update" alert
      await AsyncStorage.setItem(CACHE_KEY_LAST_RUN_VERSION, currentVersion);
      return { isNewlyUpdated: false, currentVersion };
    }

    if (compareVersions(currentVersion, storedVersion) > 0) {
      // App was upgraded from an older version!
      await AsyncStorage.setItem(CACHE_KEY_LAST_RUN_VERSION, currentVersion);
      return { isNewlyUpdated: true, currentVersion };
    }

    // App is running same or older version
    return { isNewlyUpdated: false, currentVersion };
  } catch (err) {
    console.warn('[AppUpdateService] Error checking newly updated state:', err);
    return { isNewlyUpdated: false, currentVersion };
  }
}

/**
 * Triggers direct APK download via Android system download manager.
 */
export async function openDirectApkDownload(targetUrl?: string): Promise<boolean> {
  let downloadUrl = (targetUrl || '').trim();
  if (!downloadUrl) {
    downloadUrl = `${API_BASE_URL}/api/app-releases/download/customer`;
  } else if (downloadUrl.startsWith('/')) {
    downloadUrl = `${API_BASE_URL}${downloadUrl}`;
  }

  try {
    const supported = await Linking.canOpenURL(downloadUrl);
    if (supported) {
      await Linking.openURL(downloadUrl);
      return true;
    }
  } catch (err) {
    console.warn('[AppUpdateService] Failed to open direct download:', err);
  }

  // Fallback to direct server download URL
  const fallbackUrl = `${API_BASE_URL}/api/app-releases/download/customer`;
  try {
    await Linking.openURL(fallbackUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the public landing page download section in the user's mobile browser.
 */
export async function openLandingPageDownload(): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(LANDING_PAGE_DOWNLOAD_URL);
    if (supported) {
      await Linking.openURL(LANDING_PAGE_DOWNLOAD_URL);
      return true;
    }
  } catch (err) {
    console.warn('[AppUpdateService] Failed to open landing page:', err);
  }
  return false;
}

