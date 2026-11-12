import { apiClient } from '../services/apiClient';
import {
  clearNearbyEstablishmentCache,
  isWithinSupportedServiceArea,
  searchEstablishments,
} from '../services/establishments';

/**
 * Dual-zone service area (2026-11-09): Tacurong City and Banga, South Cotabato.
 * The app's box check only skips a request the server would refuse; the
 * server's polygon check stays the real answer.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const TACURONG = { latitude: 6.6873, longitude: 124.6752 };
const BANGA = { latitude: 6.4232, longitude: 124.7762 };
const GENERAL_SANTOS = { latitude: 6.1164, longitude: 125.1716 };
const ISULAN = { latitude: 6.6297, longitude: 124.6049 };

describe('isWithinSupportedServiceArea', () => {
  it('accepts a point in Tacurong or in Banga', () => {
    expect(isWithinSupportedServiceArea(TACURONG)).toBe(true);
    expect(isWithinSupportedServiceArea(BANGA)).toBe(true);
  });

  it('refuses a point outside both boxes', () => {
    expect(isWithinSupportedServiceArea(GENERAL_SANTOS)).toBe(false);
    expect(isWithinSupportedServiceArea(ISULAN)).toBe(false);
  });

  it('lets a missing point through and refuses coordinates that are not numbers', () => {
    expect(isWithinSupportedServiceArea(null)).toBe(true);
    expect(isWithinSupportedServiceArea({ latitude: NaN, longitude: 124.7 })).toBe(false);
  });
});

describe('searching for stores from Banga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearNearbyEstablishmentCache();
  });

  it('asks the server instead of answering "not in your area" on the phone', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { google: 'ok', items: [], hasMore: false } });
    await searchEstablishments({ near: BANGA });
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('still skips the request for a point outside every zone', async () => {
    const result = await searchEstablishments({ near: GENERAL_SANTOS });
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(result.outsideServiceArea).toBe(true);
  });
});
