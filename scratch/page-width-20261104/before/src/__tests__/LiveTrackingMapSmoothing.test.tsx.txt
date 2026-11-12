import React from 'react';
import { render } from '@testing-library/react-native';
import LiveTrackingMap from '../components/LiveTrackingMap';
import type { RiderLiveLocation } from '../hooks/useRiderLiveLocation';

const CUSTOMER = { latitude: 6.6926, longitude: 124.6759 };

const fix = (latitude: number, longitude: number, heading: number | null = null): RiderLiveLocation => ({
  latitude,
  longitude,
  heading,
  updatedAt: Date.now(),
});

/** The AnimatedRegion the marker is being driven by, straight off its props. */
const regionOf = (res: any) => res.getByTestId('mock-marker-animated').props.coordinate;

// RNTL 14 renders concurrently, so the result is awaited — matching the other
// suites here.
const renderMap = async (riderLocation: RiderLiveLocation | null): Promise<any> =>
  await render(
    <LiveTrackingMap
      customerCoordinate={CUSTOMER}
      riderLocation={riderLocation}
      routeCoordinates={null}
    />
  );

describe('LiveTrackingMap rider marker', () => {
  it('drives the marker through an AnimatedRegion, not a raw coordinate', async () => {
    const res = await renderMap(fix(6.69, 124.675));
    const region = regionOf(res);

    // A plain object here would mean the marker jumps between fixes, which is
    // the bug this replaced.
    expect(typeof region.timing).toBe('function');
    expect(region.__region.latitude).toBeCloseTo(6.69, 6);
  });

  it('places the first fix without animating in from nowhere', async () => {
    const res = await renderMap(fix(6.69, 124.675));
    // Sliding to the first fix would send the marker across the map from the
    // AnimatedRegion's default centre.
    expect(regionOf(res).__timings).toHaveLength(0);
  });

  it('tweens to the next fix instead of jumping', async () => {
    const res = await renderMap(fix(6.69, 124.675));
    const region = regionOf(res);

    // ~33 m north — a normal step between two GPS fixes.
    await res.rerender(
      <LiveTrackingMap
        customerCoordinate={CUSTOMER}
        riderLocation={fix(6.6903, 124.675)}
        routeCoordinates={null}
      />
    );

    expect(region.__timings).toHaveLength(1);
    const [tween] = region.__timings;
    expect(tween.latitude).toBeCloseTo(6.6903, 6);
    expect(tween.duration).toBeGreaterThan(600);
    expect(tween.duration).toBeLessThanOrEqual(2500);
    // Coordinates are not a native-drivable prop.
    expect(tween.useNativeDriver).toBe(false);
  });

  it('jumps rather than sliding when the rider reappears far away', async () => {
    const res = await renderMap(fix(6.69, 124.675));
    const region = regionOf(res);

    // ~5 km away: a signal blackout or a mocked location, not travel. Sliding
    // across that gap would draw a path the rider never took.
    await res.rerender(
      <LiveTrackingMap
        customerCoordinate={CUSTOMER}
        riderLocation={fix(6.735, 124.675)}
        routeCoordinates={null}
      />
    );

    expect(region.__timings).toHaveLength(0);
    expect(region.__region.latitude).toBeCloseTo(6.735, 6);
  });

  it('points the marker along its course when the phone reports no heading', async () => {
    const res = await renderMap(fix(6.69, 124.675, null));
    expect(res.getByTestId('mock-marker-animated').props.rotation).toBe(0);

    // Due east, with no heading supplied — the bearing has to come from the move.
    await res.rerender(
      <LiveTrackingMap
        customerCoordinate={CUSTOMER}
        riderLocation={fix(6.69, 124.6759, null)}
        routeCoordinates={null}
      />
    );

    expect(res.getByTestId('mock-marker-animated').props.rotation).toBeCloseTo(90, 0);
  });

  it('renders no rider marker before the first fix arrives', async () => {
    const res = await renderMap(null);
    expect(res.queryByTestId('mock-marker-animated')).toBeNull();
  });
});
