import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import {
  checkAndFetchUpdateSilently,
  syncUpdatesInBackground,
  setupUpdateListeners,
  reloadAppForUpdate,
  getUpdateMetadata,
  MIN_CHECK_INTERVAL_MS,
  _resetLastCheckTimestampForTesting,
} from '../services/updatesService';

// Reference the mocked module
const mockUpdates = Updates as jest.Mocked<typeof Updates>;

describe('updatesService', () => {
  const originalDev = (globalThis as any).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetLastCheckTimestampForTesting();
    (globalThis as any).__DEV__ = false;
    (mockUpdates as any).isEnabled = true;
  });

  afterEach(() => {
    (globalThis as any).__DEV__ = originalDev;
  });

  describe('Dev Mode & Disabled Invariant Guards', () => {
    it('bypasses update checks completely when in development mode (__DEV__ = true)', async () => {
      (globalThis as any).__DEV__ = true;

      const result = await checkAndFetchUpdateSilently();

      expect(result).toEqual({ isAvailable: false, isDownloaded: false, isRollBackToEmbedded: false });
      expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
      expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    });

    it('bypasses reload requests when in development mode (__DEV__ = true)', async () => {
      (globalThis as any).__DEV__ = true;

      const reloaded = await reloadAppForUpdate();

      expect(reloaded).toBe(false);
      expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    });

    it('bypasses update checks when expo-updates is disabled (isEnabled = false)', async () => {
      (mockUpdates as any).isEnabled = false;

      const result = await checkAndFetchUpdateSilently();

      expect(result).toEqual({ isAvailable: false, isDownloaded: false, isRollBackToEmbedded: false });
      expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
      expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
    });

    it('bypasses reload requests when expo-updates is disabled (isEnabled = false)', async () => {
      (mockUpdates as any).isEnabled = false;

      const reloaded = await reloadAppForUpdate();

      expect(reloaded).toBe(false);
      expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
    });

    it('returns a no-op cleanup from setupUpdateListeners when in dev mode', () => {
      (globalThis as any).__DEV__ = true;
      const addSpy = jest.spyOn(AppState, 'addEventListener');

      const cleanup = setupUpdateListeners();
      expect(typeof cleanup).toBe('function');
      expect(addSpy).not.toHaveBeenCalled();
      cleanup();
      addSpy.mockRestore();
    });
  });

  describe('Production Update Checking & Fetching', () => {
    it('returns isAvailable=false when no update is deployed on the server', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isAvailable: false,
        isRollBackToEmbedded: false,
        reason: 'noUpdateAvailableOnServer',
      });

      const result = await checkAndFetchUpdateSilently();

      expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
      expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
      expect(result).toEqual({ isAvailable: false, isDownloaded: false, isRollBackToEmbedded: false });
    });

    it('detects and silently fetches update when a newer bundle is available', async () => {
      const mockManifest = { id: 'update-uuid-1234', createdAt: '2026-10-18T00:00:00.000Z' } as any;

      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        manifest: mockManifest,
        isRollBackToEmbedded: false,
      });

      (mockUpdates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isNew: true,
        manifest: mockManifest,
        isRollBackToEmbedded: false,
      });

      const result = await checkAndFetchUpdateSilently();

      expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
      expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        isAvailable: true,
        isDownloaded: true,
        isRollBackToEmbedded: false,
        manifest: mockManifest,
      });
    });

    it('detects and fetches rollback directive when isRollBackToEmbedded is true', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isAvailable: false,
        isRollBackToEmbedded: true,
      });

      (mockUpdates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isNew: false,
        isRollBackToEmbedded: true,
      });

      const result = await checkAndFetchUpdateSilently();

      expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
      expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        isAvailable: false,
        isDownloaded: true,
        isRollBackToEmbedded: true,
      });
    });

    it('handles case where fetch reports isNew=false', async () => {
      const mockManifest = { id: 'update-uuid-existing' } as any;

      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        manifest: mockManifest,
        isRollBackToEmbedded: false,
      });

      (mockUpdates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isNew: false,
        manifest: mockManifest,
        isRollBackToEmbedded: false,
      });

      const result = await checkAndFetchUpdateSilently();

      expect(result).toEqual({
        isAvailable: true,
        isDownloaded: false,
        isRollBackToEmbedded: false,
        manifest: mockManifest,
      });
    });
  });

  describe('Anti-Happy-Path Defensive Error Handling', () => {
    it('catches network errors during checkForUpdateAsync without throwing', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Network request timed out: unable to reach EAS')
      );

      const result = await checkAndFetchUpdateSilently();

      expect(result).toEqual({
        isAvailable: false,
        isDownloaded: false,
        isRollBackToEmbedded: false,
        error: 'Network request timed out: unable to reach EAS',
      });
    });

    it('catches download errors during fetchUpdateAsync without throwing', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        manifest: { id: 'update-123' } as any,
        isRollBackToEmbedded: false,
      });

      (mockUpdates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to download JS bundle due to socket hang up')
      );

      const result = await checkAndFetchUpdateSilently();

      expect(result).toEqual({
        isAvailable: false,
        isDownloaded: false,
        isRollBackToEmbedded: false,
        error: 'Failed to download JS bundle due to socket hang up',
      });
    });

    it('catches download errors during rollback fetch without throwing', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isAvailable: false,
        isRollBackToEmbedded: true,
      });

      (mockUpdates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to fetch rollback instruction')
      );

      const result = await checkAndFetchUpdateSilently();

      expect(result).toEqual({
        isAvailable: false,
        isDownloaded: false,
        isRollBackToEmbedded: false,
        error: 'Failed to fetch rollback instruction',
      });
    });

    it('handles non-Error thrown exceptions cleanly', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce('Critical native failure');

      const result = await checkAndFetchUpdateSilently();

      expect(result).toEqual({
        isAvailable: false,
        isDownloaded: false,
        isRollBackToEmbedded: false,
        error: 'Critical native failure',
      });
    });
  });

  describe('Background Sync & Throttling', () => {
    it('executes syncUpdatesInBackground fire-and-forget without crashing', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Unexpected network failure')
      );

      await expect(syncUpdatesInBackground(true)).resolves.toBeUndefined();
    });

    it('throttles rapid background checks within MIN_CHECK_INTERVAL_MS', async () => {
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
        isAvailable: false,
        isRollBackToEmbedded: false,
      });

      // First check: should run
      await syncUpdatesInBackground(false);
      expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

      // Immediate second check: should be throttled
      await syncUpdatesInBackground(false);
      expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

      // Force check: should bypass throttle
      await syncUpdatesInBackground(true);
      expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(2);
    });

    it('subscribes to AppState and triggers sync on resume to active', () => {
      let listenerCallback: ((state: string) => void) | null = null;
      const removeMock = jest.fn();

      const addSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
        if (event === 'change') {
          listenerCallback = cb as (state: string) => void;
        }
        return { remove: removeMock } as any;
      });

      const cleanup = setupUpdateListeners();

      expect(addSpy).toHaveBeenCalledWith('change', expect.any(Function));
      expect(listenerCallback).not.toBeNull();

      // Simulate foreground resume
      (mockUpdates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
        isAvailable: false,
        isRollBackToEmbedded: false,
      });

      listenerCallback!('active');
      expect(mockUpdates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

      // Cleanup
      cleanup();
      expect(removeMock).toHaveBeenCalledTimes(1);
      addSpy.mockRestore();
    });
  });

  describe('App Reload & Metadata', () => {
    it('executes reloadAppForUpdate successfully in production', async () => {
      (mockUpdates.reloadAsync as jest.Mock).mockResolvedValueOnce(undefined);

      const reloaded = await reloadAppForUpdate();

      expect(reloaded).toBe(true);
      expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
    });

    it('returns false gracefully when reloadAsync fails', async () => {
      (mockUpdates.reloadAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Native reload bridge error')
      );

      const reloaded = await reloadAppForUpdate();

      expect(reloaded).toBe(false);
    });

    it('returns a comprehensive metadata snapshot', () => {
      (mockUpdates as any).updateId = 'test-update-id-5678';
      (mockUpdates as any).channel = 'production';
      (mockUpdates as any).runtimeVersion = '1.2.0';
      (mockUpdates as any).createdAt = new Date('2026-10-18T12:00:00Z');
      (mockUpdates as any).isEmbeddedLaunch = false;
      (mockUpdates as any).isEmergencyLaunch = false;
      (mockUpdates as any).emergencyLaunchReason = null;

      const metadata = getUpdateMetadata();

      expect(metadata).toEqual({
        isEnabled: true,
        updateId: 'test-update-id-5678',
        channel: 'production',
        runtimeVersion: '1.2.0',
        createdAt: new Date('2026-10-18T12:00:00Z'),
        isEmbeddedLaunch: false,
        isEmergencyLaunch: false,
        emergencyLaunchReason: null,
      });
    });
  });
});
