import React from 'react';
import { act, render } from '@testing-library/react-native';
import LiveTrackingMap from '../components/LiveTrackingMap';
import type { RiderLiveLocation } from '../hooks/useRiderLiveLocation';

/**
 * The customer's map draws a road line only on its own engine's map, and is
 * never switched between Google and OpenStreetMap in place: each style is a
 * native map created with that type in its first props (Huawei's Petal Maps
 * ignores a live switch to 'none').
 */

// Every native map created, with the props it was born with and every map
// type it was later handed. The shared mock in jest.setup.js keeps no history.
type MountRecord = { firstMapType: unknown; mapTypes: unknown[] };
const mockMounts: MountRecord[] = [];

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = React.forwardRef((props: any, ref: any) => {
    const record = React.useRef(null as any);
    if (!record.current) {
      record.current = { firstMapType: props.mapType, mapTypes: [] };
      mockMounts.push(record.current);
    }
    record.current.mapTypes.push(props.mapType);
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
      animateCamera: jest.fn(),
      fitToCoordinates: jest.fn(),
    }));
    React.useEffect(() => {
      props.onMapReady?.();
    }, []);
    return React.createElement(View, { ...props, testID: 'mock-map-view' }, props.children);
  });
  const element = (fallbackId: string) => (props: any) =>
    React.createElement(View, { ...props, testID: props.testID || fallbackId }, props.children);
  const Marker: any = element('mock-marker');
  Marker.Animated = element('mock-marker-animated');

  class AnimatedRegion {
    __region: any;
    constructor(region = {}) {
      this.__region = { ...region };
    }
    setValue(region: any) {
      this.__region = { ...region };
    }
    timing(config: any) {
      return { start: () => (this.__region = { ...this.__region, ...config }) };
    }
  }

  return {
    __esModule: true,
    default: MockMapView,
    Marker,
    Polyline: element('mock-polyline'),
    Circle: element('mock-circle'),
    UrlTile: element('mock-url-tile'),
    AnimatedRegion,
    PROVIDER_GOOGLE: 'google',
  };
});

const CUSTOMER = { latitude: 6.6926, longitude: 124.6759 };
const RIDER: RiderLiveLocation = { latitude: 6.689, longitude: 124.6788, heading: null, updatedAt: Date.now() };
const LINE = [
  { latitude: 6.689, longitude: 124.6788 },
  { latitude: 6.691, longitude: 124.677 },
  CUSTOMER,
];

type MapProps = React.ComponentProps<typeof LiveTrackingMap>;
const view = (props: Partial<MapProps>) => (
  <LiveTrackingMap
    customerCoordinate={CUSTOMER}
    riderLocation={RIDER}
    routeCoordinates={LINE}
    deliveryLegCoordinates={LINE}
    phase="delivering"
    {...props}
  />
);
const draw = async (props: Partial<MapProps>) => (await render(view(props))) as any;

beforeEach(() => {
  mockMounts.length = 0;
});

describe('a road line on its own engine\'s map only', () => {
  it('draws Google Directions\' line on the Google map', async () => {
    const res = await draw({ mapStyle: 'google', lineEngine: 'google' });
    expect(res.getByTestId('route-line-delivering')).toBeTruthy();
  });

  it('draws OSRM\'s line on OpenStreetMap', async () => {
    const res = await draw({ mapStyle: 'osm', lineEngine: 'osrm' });
    expect(res.getByTestId('route-line-delivering')).toBeTruthy();
  });

  it('draws no OSRM line on the Google map', async () => {
    const res = await draw({ mapStyle: 'google', lineEngine: 'osrm' });
    expect(res.queryByTestId('route-line-delivering')).toBeNull();
    // Nor the dotted link from the rider to where that line starts.
    expect(res.queryByTestId('route-link')).toBeNull();
  });

  it('draws no Google line on OpenStreetMap', async () => {
    const res = await draw({ mapStyle: 'osm', lineEngine: 'google' });
    expect(res.queryByTestId('route-line-delivering')).toBeNull();
  });

  it('lets a dashed straight-line guess stand on either map', async () => {
    for (const mapStyle of ['google', 'osm'] as const) {
      const res = await draw({ mapStyle, lineEngine: 'haversine', degraded: true });
      expect(res.getByTestId('route-line-delivering').props.lineDashPattern).toEqual([12, 8]);
    }
  });
});

describe('the base map is never switched in place', () => {
  it('shows no map until the first route says which', async () => {
    const res = await draw({ mapStyle: null });
    expect(res.getByTestId('map-placeholder')).toBeTruthy();
    expect(res.queryByTestId('mock-map-view')).toBeNull();
    expect(mockMounts).toHaveLength(0);
  });

  it('creates the OpenStreetMap map with no base map from its first props', async () => {
    await draw({ mapStyle: 'osm', lineEngine: 'osrm' });
    expect(mockMounts).toHaveLength(1);
    expect(mockMounts[0].firstMapType).toBe('none');
  });

  it('creates the Google map as a standard map from its first props', async () => {
    await draw({ mapStyle: 'google', lineEngine: 'google' });
    expect(mockMounts[0].firstMapType).toBe('standard');
  });

  it('makes a new native map when the style changes, never re-typing the live one', async () => {
    const res = await draw({ mapStyle: 'osm', lineEngine: 'osrm' });
    await act(async () => {
      await res.rerender(view({ mapStyle: 'google', lineEngine: 'osrm' }));
    });

    expect(mockMounts).toHaveLength(2);
    expect(mockMounts[1].firstMapType).toBe('standard');
    // Every map kept the type it was born with.
    for (const mount of mockMounts) {
      expect(new Set(mount.mapTypes).size).toBe(1);
    }
    // And the OSRM line still on hand is not drawn on the new Google map.
    expect(res.queryByTestId('route-line-delivering')).toBeNull();
  });

  it('places the map from the placeholder as soon as the style is known', async () => {
    const res = await draw({ mapStyle: null });
    await act(async () => {
      await res.rerender(view({ mapStyle: 'osm', lineEngine: 'osrm' }));
    });
    expect(mockMounts).toHaveLength(1);
    expect(mockMounts[0].firstMapType).toBe('none');
    expect(res.getByTestId('route-line-delivering')).toBeTruthy();
  });
});
