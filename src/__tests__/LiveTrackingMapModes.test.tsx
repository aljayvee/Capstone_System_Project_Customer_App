import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LiveTrackingMap, { type ErrandStorePinpoint } from '../components/LiveTrackingMap';
import type { RiderLiveLocation } from '../hooks/useRiderLiveLocation';

const CUSTOMER = { latitude: 6.6926, longitude: 124.6759 };

const RIDER: RiderLiveLocation = {
  latitude: 6.689,
  longitude: 124.6788,
  heading: null,
  updatedAt: Date.now(),
};

const STOPS: ErrandStorePinpoint[] = [
  {
    id: 101,
    storeName: 'Jollibee DT Roundball',
    latitude: 6.689,
    longitude: 124.6788,
    sequence: 0,
    geofenceRadiusMeters: 75,
  },
  {
    id: 102,
    storeName: 'Primark Save More',
    latitude: 6.6905,
    longitude: 124.6742,
    sequence: 1,
    geofenceRadiusMeters: 150,
    departedAt: '2026-08-25T01:20:00Z',
  },
];

/** Two points is the minimum a Polyline is drawn from. */
const line = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ latitude: 6.68 + i * 0.001, longitude: 124.67 + i * 0.001 }));

const draw = async (props: Partial<React.ComponentProps<typeof LiveTrackingMap>> = {}) =>
  (await render(
    <LiveTrackingMap
      customerCoordinate={CUSTOMER}
      riderLocation={RIDER}
      pinpoints={STOPS}
      routeCoordinates={null}
      pickupLegCoordinates={line(6)}
      deliveryLegCoordinates={line(8)}
      {...props}
    />
  )) as any;

describe('which line the customer sees', () => {
  it('draws only the orange store run while the rider is still shopping', async () => {
    const res = await draw({ phase: 'shopping' });

    expect(res.getByTestId('route-line-shopping')).toBeTruthy();
    // The line to their own house must not appear while the rider is still
    // queueing at the first shop.
    expect(res.queryByTestId('route-line-delivering')).toBeNull();
  });

  it('draws only the pink-red delivery run once the items are bought', async () => {
    const res = await draw({ phase: 'delivering' });

    expect(res.getByTestId('route-line-delivering')).toBeTruthy();
    // The shopping run is finished work and stops being drawn.
    expect(res.queryByTestId('route-line-shopping')).toBeNull();
  });

  it('colours the shopping run orange and the delivery run brand pink', async () => {
    const shopping = await draw({ phase: 'shopping' });
    expect(shopping.getByTestId('route-line-shopping').props.strokeColor).toBe('#F97316');

    const delivering = await draw({ phase: 'delivering' });
    expect(delivering.getByTestId('route-line-delivering').props.strokeColor).toBe('#F62459');
  });

  it('falls back to the overview route when no leg split arrived', async () => {
    const res = await draw({
      phase: 'shopping',
      pickupLegCoordinates: null,
      deliveryLegCoordinates: null,
      routeCoordinates: line(5),
    });
    expect(res.getByTestId('route-line-shopping')).toBeTruthy();
  });

  it('still colours the delivery run correctly when the route has only one leg', async () => {
    // Once every store is done the route is fetched with no waypoints, so the
    // whole delivery run comes back as leg 0 — which the server calls "pickup".
    // Colouring by leg index would paint it orange here.
    const res = await draw({
      phase: 'delivering',
      pickupLegCoordinates: line(9),
      deliveryLegCoordinates: null,
    });
    expect(res.getByTestId('route-line-delivering').props.strokeColor).toBe('#F62459');
  });

  it('draws nothing rather than a stub when there is no route yet', async () => {
    const res = await draw({
      phase: 'shopping',
      pickupLegCoordinates: line(1),
      deliveryLegCoordinates: null,
      routeCoordinates: null,
    });
    expect(res.queryByTestId('route-line-shopping')).toBeNull();
  });
});

describe('Focus and Full', () => {
  it('opens in Full so the viewer gets their bearings first', async () => {
    const res = await draw();
    // The toggle offers the move INTO focus, which means it is not in it.
    expect(res.getByTestId('map-mode-toggle').props.accessibilityLabel).toBe('Follow the rider');
  });

  it('switches into Focus when the toggle is pressed', async () => {
    const res = await draw();
    await fireEvent.press(res.getByTestId('map-mode-toggle'));
    expect(res.getByTestId('map-mode-toggle').props.accessibilityLabel).toBe('Show the whole route');
  });

  it('switches back to Full from the same control', async () => {
    const res = await draw();
    await fireEvent.press(res.getByTestId('map-mode-toggle'));
    await fireEvent.press(res.getByTestId('map-mode-toggle'));
    expect(res.getByTestId('map-mode-toggle').props.accessibilityLabel).toBe('Follow the rider');
  });

  it('drops out of Focus when the viewer pans the map', async () => {
    // Taking hold of the map takes the camera back, visibly, rather than the
    // follow silently ceasing with nothing on screen to say so.
    const res = await draw();
    await fireEvent.press(res.getByTestId('map-mode-toggle'));
    expect(res.getByTestId('map-mode-toggle').props.accessibilityLabel).toBe('Show the whole route');

    await fireEvent(res.getByTestId('mock-map-view'), 'panDrag');
    expect(res.getByTestId('map-mode-toggle').props.accessibilityLabel).toBe('Follow the rider');
  });

  it('keeps the re-frame control available in Full', async () => {
    const res = await draw();
    expect(res.getByTestId('map-recenter-btn')).toBeTruthy();
  });
});

describe('the stores on the map', () => {
  it('keeps a finished stop visible rather than removing it', async () => {
    // Only the ROUTING drops a completed store; the marker stays so the
    // customer can see where the rider has been.
    const res = await draw();

    // Both stops keep a circle and a numbered badge; the finished one is ticked
    // rather than removed.
    expect(res.getAllByTestId('mock-circle')).toHaveLength(2);
    expect(res.getByText('1')).toBeTruthy();
    expect(res.getByText('✓')).toBeTruthy();
  });
});
