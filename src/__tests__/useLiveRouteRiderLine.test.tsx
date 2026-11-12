import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLiveRoute } from '../hooks/useLiveRoute';
import { fetchDrivingRoute, type DirectionsResult } from '../services/directionsService';
import type { RiderLine } from '../hooks/useRiderLine';

/**
 * Once the rider is heading to the door, the Track map draws the very line
 * Sugo Rider is following, and stops calculating one of its own: no 30-second
 * redraw, no new road every few metres. When the rider bypasses the route,
 * the line changes once, with theirs.
 */

jest.mock('../services/directionsService', () => ({
  fetchDrivingRoute: jest.fn(),
}));

let mockRiderLine: RiderLine | null = null;
const mockUseRiderLine = jest.fn((_errandId: unknown, _enabled: unknown) => mockRiderLine);
jest.mock('../hooks/useRiderLine', () => ({
  useRiderLine: (errandId: unknown, enabled: unknown) => mockUseRiderLine(errandId, enabled),
}));

const mockedFetch = fetchDrivingRoute as jest.MockedFunction<typeof fetchDrivingRoute>;

const customer = { latitude: 6.7, longitude: 124.67 };
const start = { latitude: 6.69, longitude: 124.67 };
// Due north, about 1.1 km, in two equal stretches.
const road = [start, { latitude: 6.695, longitude: 124.67 }, customer];

const lineOf = (overrides: Partial<RiderLine> = {}): RiderLine => ({
  version: 4,
  coordinates: road,
  distanceMeters: 1200,
  durationSeconds: 240,
  lineEngine: 'osrm',
  reroutedAt: null,
  ...overrides,
});

const ownRoute: DirectionsResult = {
  coordinates: [start, { latitude: 6.695, longitude: 124.672 }, customer],
  pickupLegCoordinates: null,
  deliveryLegCoordinates: null,
  legs: [{ distanceMeters: 1300, durationSeconds: 260 }],
  distanceMeters: 1300,
  durationSeconds: 260,
  provider: 'osrm',
  degraded: false,
  selection: { strategy: 'fastest', chosen: 'osrm', drawnWith: 'osrm', candidates: [] },
};

type Props = {
  origin: { latitude: number; longitude: number };
  provider?: 'osrm' | 'google';
  waypoints?: { latitude: number; longitude: number }[];
};

const track = (initialProps: Props) =>
  renderHook(
    ({ origin, provider, waypoints = [] }: Props) =>
      useLiveRoute(origin, customer, waypoints, { choose: 'fastest', errandId: 'errand-1', provider }),
    { initialProps }
  );

beforeEach(() => {
  mockedFetch.mockReset().mockResolvedValue(ownRoute);
  mockUseRiderLine.mockClear();
  mockRiderLine = null;
});

describe('useLiveRoute and the rider\'s own line', () => {
  it('draws the rider\'s line and calculates none of its own', async () => {
    mockRiderLine = lineOf();
    const { result } = await track({ origin: start, provider: 'osrm' });

    expect(result.current.source).toBe('rider');
    expect(result.current.deliveryLegCoordinates).toEqual(road);
    expect(result.current.lineEngine).toBe('osrm');
    expect(result.current.distanceMeters).toBe(1200);
    expect(result.current.routeKey).toBe('rider:4');
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('asks for the rider\'s line only once no store is left ahead', async () => {
    await track({ origin: start, waypoints: [{ latitude: 6.68, longitude: 124.66 }] });
    expect(mockUseRiderLine).toHaveBeenLastCalledWith('errand-1', false);

    await track({ origin: start });
    expect(mockUseRiderLine).toHaveBeenLastCalledWith('errand-1', true);
  });

  it('trims the line at the rider and quotes only what is left of it', async () => {
    mockRiderLine = lineOf();
    const { result, rerender } = await track({ origin: start, provider: 'osrm' });

    // Halfway, a few metres beside the road.
    const halfway = { latitude: 6.695, longitude: 124.67003 };
    await act(async () => {
      await rerender({ origin: halfway, provider: 'osrm' });
    });

    const ahead = result.current.deliveryLegCoordinates!;
    expect(ahead[0].latitude).toBeCloseTo(6.695, 4);
    expect(ahead[ahead.length - 1]).toEqual(customer);
    expect(result.current.distanceMeters).toBeCloseTo(600, -1);
    expect(result.current.durationSeconds).toBeCloseTo(120, -1);
    // The same route, so the camera is not re-framed.
    expect(result.current.routeKey).toBe('rider:4');
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('does not trim at a rider who is well off the line', async () => {
    mockRiderLine = lineOf();
    const { result } = await track({ origin: { latitude: 6.695, longitude: 124.6715 }, provider: 'osrm' });

    expect(result.current.deliveryLegCoordinates).toEqual(road);
    expect(result.current.distanceMeters).toBe(1200);
  });

  it('switches to the new line when the rider is rerouted, and says when', async () => {
    mockRiderLine = lineOf();
    const { result, rerender } = await track({ origin: start, provider: 'osrm' });

    const side = { latitude: 6.693, longitude: 124.6706 };
    mockRiderLine = lineOf({ version: 5, coordinates: [side, customer], reroutedAt: 1_700_000_000_000 });
    await act(async () => {
      await rerender({ origin: side, provider: 'osrm' });
    });

    expect(result.current.routeKey).toBe('rider:5');
    expect(result.current.routeUpdatedAt).toBe(1_700_000_000_000);
    expect(result.current.deliveryLegCoordinates?.[result.current.deliveryLegCoordinates.length - 1]).toEqual(customer);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('calculates its own line when the rider\'s is on the other map\'s roads', async () => {
    mockRiderLine = lineOf({ lineEngine: 'google' });
    const { result } = await track({ origin: start, provider: 'osrm' });

    await waitFor(() => expect(result.current.lineEngine).toBe('osrm'));
    expect(result.current.source).toBe('own');
    expect(mockedFetch).toHaveBeenCalled();
  });

  it('goes back to calculating its own line when the rider\'s goes away', async () => {
    mockRiderLine = lineOf();
    const { result, rerender } = await track({ origin: start, provider: 'osrm' });
    expect(mockedFetch).not.toHaveBeenCalled();

    mockRiderLine = null;
    await act(async () => {
      await rerender({ origin: start, provider: 'osrm' });
    });

    await waitFor(() => expect(result.current.source).toBe('own'));
    await waitFor(() => expect(result.current.deliveryLegCoordinates).toEqual(ownRoute.coordinates));
    expect(result.current.routeKey).toBeNull();
  });
});
