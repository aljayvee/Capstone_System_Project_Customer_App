import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLiveRoute } from '../hooks/useLiveRoute';
import {
  fetchDrivingRoute,
  type DirectionsResult,
  type RouteRequestOptions,
} from '../services/directionsService';

/**
 * A named map is binding: Google's map gets Google Directions' line,
 * OpenStreetMap gets OSRM's. The server may still answer on the other
 * engine's roads (it could not redraw the rider's path on this map's), and
 * that line, metres beside the painted roads, is never handed to the map.
 */

jest.mock('../services/directionsService', () => ({
  fetchDrivingRoute: jest.fn(),
}));

const mockedFetch = fetchDrivingRoute as jest.MockedFunction<typeof fetchDrivingRoute>;

const rider = { latitude: 6.6813, longitude: 124.6634 };
const customer = { latitude: 6.6961, longitude: 124.6728 };

// A road route whose bend says which engine drew it.
function routeOn(engine: 'osrm' | 'google', from = rider): DirectionsResult {
  const bend = engine === 'osrm' ? 124.665 : 124.666;
  return {
    coordinates: [from, { latitude: 6.688, longitude: bend }, customer],
    pickupLegCoordinates: null,
    deliveryLegCoordinates: null,
    legs: [{ distanceMeters: 2000, durationSeconds: 300 }],
    distanceMeters: 2000,
    durationSeconds: 300,
    provider: engine,
    degraded: false,
    selection: { strategy: 'fastest', chosen: engine, drawnWith: engine, candidates: [] },
  };
}

const guess: DirectionsResult = {
  coordinates: [rider, customer],
  pickupLegCoordinates: null,
  deliveryLegCoordinates: null,
  legs: [],
  distanceMeters: 1900,
  durationSeconds: 400,
  provider: 'haversine',
  degraded: true,
  selection: null,
};

type Props = { origin: typeof rider; provider?: 'osrm' | 'google' };

const track = (initialProps: Props) =>
  renderHook(
    ({ origin, provider }: Props) =>
      useLiveRoute(origin, customer, [], { choose: 'fastest', errandId: 'errand-1', provider }),
    { initialProps }
  );

const requestOf = (call: number): RouteRequestOptions => mockedFetch.mock.calls[call][3] as RouteRequestOptions;

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('useLiveRoute and the engine of the map on screen', () => {
  it('takes the first answer on whatever roads it came, before any map is named', async () => {
    mockedFetch.mockResolvedValue(routeOn('osrm'));
    const { result } = await track({ origin: rider });

    await waitFor(() => expect(result.current.lineEngine).toBe('osrm'));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(requestOf(0)).toEqual({ choose: 'fastest', errandId: 'errand-1', provider: undefined });
    expect(result.current.unroutable).toBeNull();
  });

  it('asks again for the map\'s own engine when the answer is on the other\'s roads', async () => {
    mockedFetch
      .mockResolvedValueOnce(routeOn('osrm'))
      .mockResolvedValueOnce(routeOn('google'));
    const { result } = await track({ origin: rider, provider: 'google' });

    await waitFor(() => expect(result.current.lineEngine).toBe('google'));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    // First the rider's own path, redrawn on Google's roads if it can be.
    expect(requestOf(0)).toEqual({ choose: 'fastest', errandId: 'errand-1', provider: 'google' });
    // Then Google alone. Without the errand: the server would replace `keep`
    // with the rider's verdict, the engine that just could not be drawn here.
    expect(requestOf(1)).toEqual({ choose: 'fastest', provider: 'google', keep: 'google' });
    expect(result.current.deliveryLegCoordinates).toEqual(routeOn('google').coordinates);
    expect(result.current.degraded).toBe(false);
  });

  it('never hands over the other engine\'s line: a dashed guess, and the engine reported unroutable', async () => {
    mockedFetch.mockResolvedValue(routeOn('osrm'));
    const { result } = await track({ origin: rider, provider: 'google' });

    await waitFor(() => expect(result.current.unroutable).toBe('google'));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    // Straight from the rider to the customer, drawn dashed, not OSRM's road.
    expect(result.current.degraded).toBe(true);
    expect(result.current.lineEngine).toBeNull();
    expect(result.current.deliveryLegCoordinates).toEqual([rider, customer]);
  });

  it('keeps the last line drawn on the map\'s engine when that engine stops answering', async () => {
    mockedFetch.mockResolvedValueOnce(routeOn('google'));
    const { result, rerender } = await track({ origin: rider, provider: 'google' });
    await waitFor(() => expect(result.current.lineEngine).toBe('google'));

    // The rider moves on; now only OSRM answers.
    mockedFetch.mockResolvedValue(routeOn('osrm'));
    const moved = { latitude: 6.6833, longitude: 124.6644 };
    await act(async () => {
      await rerender({ origin: moved, provider: 'google' });
    });

    await waitFor(() => expect(result.current.unroutable).toBe('google'));
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(result.current.lineEngine).toBe('google');
    expect(result.current.degraded).toBe(false);
    expect(result.current.deliveryLegCoordinates).toEqual(routeOn('google').coordinates);
  });

  it('lets the server\'s straight-line guess stand whatever map is named', async () => {
    mockedFetch.mockResolvedValue(guess);
    const { result } = await track({ origin: rider, provider: 'osrm' });

    await waitFor(() => expect(result.current.degraded).toBe(true));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(result.current.lineEngine).toBe('haversine');
    expect(result.current.unroutable).toBeNull();
  });

  it('does not fetch the same road again when the map is named after the line on screen', async () => {
    mockedFetch.mockResolvedValue(routeOn('osrm'));
    const { result, rerender } = await track({ origin: rider });
    await waitFor(() => expect(result.current.lineEngine).toBe('osrm'));

    // OpenStreetMap is chosen from that line and named from now on.
    await act(async () => {
      await rerender({ origin: rider, provider: 'osrm' });
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(result.current.lineEngine).toBe('osrm');
  });

  it('asks for the named map\'s roads when the line on screen is another engine\'s', async () => {
    mockedFetch.mockResolvedValueOnce(routeOn('osrm')).mockResolvedValue(routeOn('google'));
    const { result, rerender } = await track({ origin: rider });
    await waitFor(() => expect(result.current.lineEngine).toBe('osrm'));

    // Our tiles stopped answering, so Google is the map.
    await act(async () => {
      await rerender({ origin: rider, provider: 'google' });
    });
    await waitFor(() => expect(result.current.lineEngine).toBe('google'));
    expect(requestOf(1).provider).toBe('google');
  });
});
