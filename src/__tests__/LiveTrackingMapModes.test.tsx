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

describe('the ETA badge', () => {
  const legs = {
    distanceMeters: 55700,
    durationSeconds: 3300,
    pickupDistanceMeters: 52900,
    pickupDurationSeconds: 3600,
    deliveryDistanceMeters: 2800,
    deliveryDurationSeconds: 300,
  };

  it('quotes the run to the store while shopping, not the whole errand', async () => {
    const res = await draw({ phase: 'shopping', ...legs });
    expect(res.getByText(/To store/)).toBeTruthy();
    expect(res.getByText(/52\.9 km/)).toBeTruthy();
    expect(res.queryByText(/55\.7 km/)).toBeNull();
  });

  it('quotes the run to the customer once delivering', async () => {
    const res = await draw({ phase: 'delivering', ...legs });
    expect(res.getByText(/To you/)).toBeTruthy();
    expect(res.getByText(/2\.8 km/)).toBeTruthy();
  });

  it('falls back to the unlabelled total when no leg figures arrived', async () => {
    const res = await draw({ phase: 'shopping', distanceMeters: 55700, durationSeconds: 3300 });
    expect(res.getByText(/55\.7 km/)).toBeTruthy();
    expect(res.queryByText(/To store/)).toBeNull();
  });
});

describe('the map under the line, the same as the rider sees', () => {
  it('is Google unless the server drew the route on OpenStreetMap', async () => {
    const res = await draw({ phase: 'delivering' });
    expect(res.queryByTestId('osm-tiles')).toBeNull();
    expect(res.getByTestId('mock-map-view').props.mapType).toBe('standard');
  });

  it('draws our OpenStreetMap tiles in place of Google, with the credit', async () => {
    const res = await draw({ phase: 'delivering', mapStyle: 'osm' });
    expect(res.getByTestId('osm-tiles').props.urlTemplate).toMatch(/\/tiles\/\{z\}\/\{x\}\/\{y\}\.png$/);
    expect(res.getByTestId('mock-map-view').props.mapType).toBe('none');
    expect(res.getByText('© OpenStreetMap contributors')).toBeTruthy();
  });

  it('draws the rider from an image, which Android cannot lose on a redraw', async () => {
    const res = await draw({ phase: 'delivering' });
    const rider = res.getByTestId('mock-marker-animated');
    expect(rider.props.image).toBeTruthy();
    expect(rider.props.children).toBeUndefined();
  });
});

describe('the link from the rider to the route', () => {
  // About 50 m south of the rider, as when their phone sits off the road.
  const fromNearby = [
    { latitude: 6.68855, longitude: 124.6788 },
    { latitude: 6.6875, longitude: 124.6788 },
  ];

  it('joins a rider standing off the road to where the route starts', async () => {
    const res = await draw({ phase: 'shopping', pickupLegCoordinates: fromNearby });
    const link = res.getByTestId('route-link');
    expect(link.props.coordinates[0]).toMatchObject({ latitude: RIDER.latitude, longitude: RIDER.longitude });
    expect(link.props.coordinates[1]).toMatchObject(fromNearby[0]);
  });

  it('is not drawn when the route already starts at the rider', async () => {
    const res = await draw({
      phase: 'shopping',
      pickupLegCoordinates: [{ latitude: RIDER.latitude, longitude: RIDER.longitude }, fromNearby[1]],
    });
    expect(res.queryByTestId('route-link')).toBeNull();
  });

  it('is not drawn to a route that starts far from the rider', async () => {
    // line(6) starts over a kilometre away: not a route from here.
    const res = await draw({ phase: 'shopping' });
    expect(res.queryByTestId('route-link')).toBeNull();
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
