const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage.clear();
    return Promise.resolve();
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import {
  compareVersions,
  getInstalledAppVersion,
  checkCustomerAppUpdate,
  checkNewlyUpdatedApp,
  CACHE_KEY_LAST_RUN_VERSION,
  openDirectApkDownload,
  openLandingPageDownload,
} from '../services/appUpdateService';

// Mock Linking
jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(true),
}));

// Mock Constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
  },
}));

describe('appUpdateService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    // Reset global fetch
    (globalThis as any).fetch = undefined;
  });

  describe('compareVersions', () => {
    it('correctly detects newer remote versions', () => {
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('v1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.1-beta', '1.0.0')).toBe(1);
    });

    it('correctly detects older remote versions', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
    });

    it('returns 0 for identical versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.0', '1.0')).toBe(0);
    });
  });

  describe('getInstalledAppVersion', () => {
    it('returns the configured expo version', () => {
      expect(getInstalledAppVersion()).toBe('1.0.0');
    });
  });

  describe('checkCustomerAppUpdate', () => {
    it('successfully detects when an update is available from server', async () => {
      const mockRelease = {
        target: 'customer',
        appName: 'Sugo Express Customer',
        packageName: 'com.sugo.customer',
        version: '1.0.2',
        minAndroid: 'Android 8.0+',
        fileSize: '125 MB',
        fileSizeBytes: 131072000,
        fileName: 'sugo-customer-v1.0.2.apk',
        downloadUrl: 'https://api.sugo-express.org/api/app-releases/download/customer',
        updatedAt: '2026-10-10T00:00:00Z',
        whatsNew: ['Feature 1', 'Fix 1'],
        features: ['Feature 1'],
        fixes: ['Fix 1'],
        logs: ['Log 1'],
      };

      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          releases: {
            customer: mockRelease,
          },
        }),
      });

      const result = await checkCustomerAppUpdate();
      expect(result.installedVersion).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.2');
      expect(result.isUpdateAvailable).toBe(true);
      expect(result.release?.features).toEqual(['Feature 1']);
      expect(result.isOffline).toBe(false);

      // Verify cached in AsyncStorage
      const cached = await AsyncStorage.getItem('@sugo_customer_latest_release_v1');
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!).version).toBe('1.0.2');
    });

    it('falls back to cache when network request fails', async () => {
      const cachedRelease = {
        target: 'customer',
        appName: 'Sugo Express Customer',
        packageName: 'com.sugo.customer',
        version: '1.0.3',
        minAndroid: 'Android 8.0+',
        fileSize: '125 MB',
        fileSizeBytes: 131072000,
        fileName: 'sugo-customer-v1.0.3.apk',
        downloadUrl: 'https://api.sugo-express.org/api/app-releases/download/customer',
        updatedAt: '2026-10-10T00:00:00Z',
        whatsNew: ['Cached Feature'],
        features: ['Cached Feature'],
        fixes: [],
        logs: [],
      };

      await AsyncStorage.setItem(
        '@sugo_customer_latest_release_v1',
        JSON.stringify(cachedRelease)
      );

      (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network offline'));

      const result = await checkCustomerAppUpdate();
      expect(result.installedVersion).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.3');
      expect(result.isUpdateAvailable).toBe(true);
      expect(result.isOffline).toBe(true);
      expect(result.release?.version).toBe('1.0.3');
    });

    it('returns graceful offline fallback when no cache and network fails', async () => {
      (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

      const result = await checkCustomerAppUpdate();
      expect(result.installedVersion).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.0');
      expect(result.isUpdateAvailable).toBe(false);
      expect(result.isOffline).toBe(true);
      expect(result.release).toBeNull();
    });
  });

  describe('openDirectApkDownload', () => {
    it('calls Linking.openURL with the target URL', async () => {
      const success = await openDirectApkDownload('https://api.sugo-express.org/api/app-releases/download/customer');
      expect(Linking.canOpenURL).toHaveBeenCalledWith('https://api.sugo-express.org/api/app-releases/download/customer');
      expect(Linking.openURL).toHaveBeenCalledWith('https://api.sugo-express.org/api/app-releases/download/customer');
      expect(success).toBe(true);
    });
  });

  describe('checkNewlyUpdatedApp', () => {
    it('sets initial baseline version on first run without triggering update dialog', async () => {
      const res = await checkNewlyUpdatedApp();
      expect(res.isNewlyUpdated).toBe(false);
      expect(res.currentVersion).toBe('1.0.0');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(CACHE_KEY_LAST_RUN_VERSION, '1.0.0');
    });

    it('detects when the app is launched after upgrading from an older version', async () => {
      await AsyncStorage.setItem(CACHE_KEY_LAST_RUN_VERSION, '0.9.8');

      const res = await checkNewlyUpdatedApp();
      expect(res.isNewlyUpdated).toBe(true);
      expect(res.currentVersion).toBe('1.0.0');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(CACHE_KEY_LAST_RUN_VERSION, '1.0.0');
    });

    it('does not trigger update dialog on subsequent launches of the same version', async () => {
      await AsyncStorage.setItem(CACHE_KEY_LAST_RUN_VERSION, '1.0.0');

      const res = await checkNewlyUpdatedApp();
      expect(res.isNewlyUpdated).toBe(false);
      expect(res.currentVersion).toBe('1.0.0');
    });
  });

  describe('openLandingPageDownload', () => {
    it('opens landing page url in browser', async () => {
      const success = await openLandingPageDownload();
      expect(Linking.openURL).toHaveBeenCalledWith('https://sugoonthego.online/#download');
      expect(success).toBe(true);
    });
  });
});
