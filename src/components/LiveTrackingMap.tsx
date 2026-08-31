import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { Target, Radio, Navigation, Maximize2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSizes, FontWeights, Spacing, Shadows } from '../config/theme';
import { formatDuration, formatDistance } from '../utils/format';
import { MapCoordinate, toRegion } from '../utils/coords';
import RiderDotMarker from './RiderDotMarker';
import type { RiderLiveLocation } from '../hooks/useRiderLiveLocation';
import { useSmoothedRiderPosition } from '../hooks/useSmoothedRiderPosition';

/**
 * Used only for a stop the server sent no radius for — a pin dropped outside
 * the store catalogue. Mirrors GEOFENCE_RADIUS_METERS on the server.
 */
const DEFAULT_ARRIVAL_RADIUS_METERS = 75;


export interface ErrandStorePinpoint extends MapCoordinate {
  id: number;
  storeName: string;
  sequence?: number;
  // Geofence-derived, from the rider's breadcrumb. A stop with departedAt is
  // done and drops out of the drawn route — its marker stays, dimmed, so the
  // customer sees a completed stop rather than one that disappeared.
  arrivedAt?: string | null;
  departedAt?: string | null;
  /**
   * How close the rider must get for this stop to count as reached. Sent by the
   * server per stop, because a supermarket's circle is not a carinderia's.
   */
  geofenceRadiusMeters?: number | null;
}

export interface LiveTrackingMapProps {
  customerCoordinate: MapCoordinate;
  riderLocation: RiderLiveLocation | null;
  pinpoints?: ErrandStorePinpoint[];
  routeCoordinates: MapCoordinate[] | null;
  pickupLegCoordinates?: MapCoordinate[] | null;
  deliveryLegCoordinates?: MapCoordinate[] | null;
  /** Fixed pixel height. Omit to fill the parent container. */
  height?: number;
  /** ETA data from useLiveRoute — renders a floating badge when provided. */
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  /**
   * True when the route is a straight-line estimate rather than a measured road
   * route. Drawn dashed: a solid line is a promise about the path the rider
   * takes, and this shape cannot keep it.
   */
  degraded?: boolean;
  /**
   * Which half of the errand this is, and therefore which single line is drawn.
   *
   * An errand is two journeys: the rider's shopping run out to the pinned
   * stores, then the delivery run in to the customer. Drawing both at once
   * showed the customer a line to their own house while the rider was still
   * queueing at the first shop.
   */
  phase?: 'shopping' | 'delivering';
}

/** How the camera is framed. */
type MapMode = 'full' | 'focus';

/** Close enough to follow a rider through a street grid. */
const FOCUS_ZOOM = 17;
/** A slight lean into the horizon, as every navigation view uses. */
const FOCUS_PITCH = 45;

export default function LiveTrackingMap({
  customerCoordinate,
  riderLocation,
  pinpoints = [],
  routeCoordinates,
  pickupLegCoordinates,
  deliveryLegCoordinates,
  height,
  distanceMeters,
  durationSeconds,
  degraded = false,
  phase = 'shopping',
}: LiveTrackingMapProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Full frames the whole route; Focus follows the rider, heading-up.
  //
  // Opens in Full deliberately: dropping someone straight into a close-up gives
  // them a moving dot and no idea where it is.
  //
  // This replaces a silent `userInteractedRef` that stopped the camera following
  // the moment the map was touched, with nothing on screen to say it had
  // happened or how to undo it. A mode the viewer can see and switch back is the
  // same protection, made visible.
  const [mode, setMode] = useState<MapMode>('full');
  const hasEta = distanceMeters != null && durationSeconds != null;
  // react-native-maps takes the dash pattern as an on/off pixel run.
  const routeDashPattern = degraded ? [12, 8] : undefined;

  // While shopping, the line is the run to the next outstanding store. Once the
  // items are bought, it is the run to the customer — and the shopping line goes
  // away, because that work is finished and nothing on the map should show it as
  // though it were still ahead.
  // Whichever line actually arrived, preferring the one that matches the phase.
  //
  // The delivering fallback has to include the PICKUP array, which reads wrong
  // until you know why: once every store is done the route is fetched with no
  // waypoints at all, so the whole delivery run comes back as a single leg —
  // and the server calls leg 0 "pickup". Without this the map draws nothing at
  // exactly the moment the rider sets off for the customer.
  const firstDrawable = (...candidates: (MapCoordinate[] | null | undefined)[]) =>
    candidates.find((line) => (line?.length ?? 0) > 1) ?? [];

  const routeLine =
    phase === 'delivering'
      ? firstDrawable(deliveryLegCoordinates, routeCoordinates, pickupLegCoordinates)
      : firstDrawable(pickupLegCoordinates, routeCoordinates);

  const routeColor = phase === 'delivering' ? Colors.primary : '#F97316';

  // Interpolates between GPS fixes. Rendering `riderLocation` directly made the
  // marker teleport each time Firebase pushed an update.
  const smoothed = useSmoothedRiderPosition(riderLocation);

  const fitAllPoints = () => {
    const points: MapCoordinate[] = [
      customerCoordinate,
      ...(riderLocation ? [riderLocation] : []),
      ...pinpoints,
      ...(pickupLegCoordinates ?? []),
      ...(deliveryLegCoordinates ?? []),
      ...(routeCoordinates ?? []),
    ];
    if (points.length < 2) {
      if (points[0]) {
        mapRef.current?.animateToRegion(toRegion(points[0]), 500);
      }
      return;
    }
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: (insets.top || 20) + 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  };

  // Re-fit only when the ROUTE changes, not on every GPS tick.
  //
  // This effect previously listed riderLocation among its dependencies, so the
  // camera re-fitted roughly once a second while the rider moved: the map
  // visibly jumped, and any attempt by the customer to pan or zoom was undone
  // before they could look at it.
  const routeSignature = [
    customerCoordinate?.latitude,
    customerCoordinate?.longitude,
    pinpoints.length,
    pickupLegCoordinates?.length ?? 0,
    deliveryLegCoordinates?.length ?? 0,
    routeCoordinates?.length ?? 0,
  ].join('|');

  useEffect(() => {
    if (mode !== 'full') return;
    fitAllPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSignature, mode]);

  // Follow the rider. In Focus the camera turns with them and leans into the
  // horizon; in Full it stays framed on the whole route and does not move at all.
  //
  // The heading comes from the same smoothed rotation the marker is drawn with,
  // so the dot and the map can never point different ways — and it already falls
  // back to a bearing derived from consecutive fixes when the phone reports no
  // course of its own, which is the normal case with a mock-location app.
  useEffect(() => {
    if (!riderLocation || mode !== 'focus') return;

    // Matched to the marker's tween so the dot does not drift across the screen
    // while the camera catches up behind it.
    mapRef.current?.animateCamera(
      {
        center: riderLocation,
        heading: smoothed.rotation,
        pitch: FOCUS_PITCH,
        zoom: FOCUS_ZOOM,
      },
      { duration: smoothed.durationMs || 900 }
    );
  }, [riderLocation?.latitude, riderLocation?.longitude, smoothed.rotation, mode]);

  const enterFocus = useCallback(() => setMode('focus'), []);

  const enterFull = useCallback(() => {
    setMode('full');
    // Level the camera again, or a route framed while tilted reads as a
    // perspective view of somewhere else.
    mapRef.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 400 });
  }, []);


  const initialCenter = customerCoordinate || riderLocation || pinpoints[0];

  return (
    <View style={[styles.wrapper, height != null ? { height } : styles.wrapperFlex]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialCenter ? toRegion(initialCenter) : undefined}
        onPanDrag={() => {
          // Touching the map while it is following takes the camera back. The
          // mode flips visibly rather than the follow silently ceasing.
          if (mode === 'focus') enterFull();
        }}
      >
        <Marker coordinate={customerCoordinate} title="Delivery Address" pinColor={Colors.primary} />

        {/* The arrival circle, drawn so the customer can see where "arrived at
            the store" is actually decided rather than having to trust a status
            change with no visible cause. Dimmed once the stop is done. */}
        {pinpoints.map((pin, idx) => (
          <Circle
            key={`radius-${pin.id || idx}`}
            center={pin}
            radius={pin.geofenceRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS}
            strokeWidth={1.5}
            strokeColor={pin.departedAt ? 'rgba(107,114,128,0.35)' : 'rgba(37,99,235,0.45)'}
            fillColor={pin.departedAt ? 'rgba(107,114,128,0.06)' : 'rgba(37,99,235,0.10)'}
          />
        ))}

        {pinpoints.map((pin, idx) => {
          const done = Boolean(pin.departedAt);
          return (
            <Marker
              key={pin.id || `pin-${idx}`}
              coordinate={pin}
              title={`Store #${idx + 1}: ${pin.storeName}${done ? ' — done' : ''}`}
            >
              <View style={[styles.pinBadge, done && styles.pinBadgeDone]}>
                <Text style={styles.pinBadgeText}>{done ? '✓' : idx + 1}</Text>
              </View>
            </Marker>
          );
        })}

        {smoothed.coordinate && (
          <Marker.Animated
            coordinate={smoothed.coordinate as any}
            title="Your Rider"
            description="Live location"
            rotation={smoothed.rotation}
            flat
            anchor={{ x: 0.5, y: 0.5 }}
            style={{ backgroundColor: 'transparent' }}
          >
            <RiderDotMarker />
          </Marker.Animated>
        )}

        {/* One line, coloured by which half of the errand this is.

            Deliberately not chosen by which array the coordinates arrived in:
            once every store is done the route has a single leg, and the server
            calls leg 0 "pickup" — so leg index would paint the delivery run
            orange at exactly the moment this distinction matters. */}
        {routeLine.length > 1 && (
          <Polyline
            coordinates={routeLine}
            strokeColor={routeColor}
            strokeWidth={4}
            lineDashPattern={routeDashPattern}
            testID={phase === 'delivering' ? 'route-line-delivering' : 'route-line-shopping'}
          />
        )}
      </MapView>

      {/* Floating Top Controls */}
      <View style={[styles.floatingTopBar, { top: insets.top > 0 ? insets.top + 8 : 12 }]}>
        {/* ETA & Distance Floating Badge */}
        {hasEta ? (
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>
              ⏱️ {formatDuration(durationSeconds!)} • {formatDistance(distanceMeters!)}
            </Text>
          </View>
        ) : (
          <View style={styles.livePill}>
            <Radio size={12} color={riderLocation ? Colors.success : Colors.warning} strokeWidth={2.4} />
            <Text style={[styles.livePillText, { color: riderLocation ? Colors.success : Colors.warning }]}>
              {riderLocation ? 'Live GPS' : 'Connecting...'}
            </Text>
          </View>
        )}

        {/* Follow the rider, or step back and see the whole route. */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.recenterBtn, mode === 'focus' && styles.modeBtnActive]}
          onPress={mode === 'focus' ? enterFull : enterFocus}
          accessibilityLabel={mode === 'focus' ? 'Show the whole route' : 'Follow the rider'}
          testID="map-mode-toggle"
        >
          {mode === 'focus' ? (
            <Maximize2 size={18} color={Colors.textWhite} strokeWidth={2.2} />
          ) : (
            <Navigation size={18} color={Colors.textDark} strokeWidth={2.2} />
          )}
        </TouchableOpacity>

        {/* Re-frame the route without leaving Full. */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.recenterBtn}
          onPress={() => {
            enterFull();
            fitAllPoints();
          }}
          testID="map-recenter-btn"
        >
          <Target size={18} color={Colors.textDark} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  wrapperFlex: {
    flex: 1,
  },
  pinBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A finished stop recedes rather than disappearing: still placed, clearly not
  // part of the remaining trip.
  pinBadgeDone: {
    backgroundColor: Colors.textLight,
    opacity: 0.75,
  },
  pinBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold as any,
  },
  floatingTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  etaBadge: {
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    ...Shadows.soft,
  },
  etaText: {
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    ...Shadows.soft,
  },
  livePillText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  recenterBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
});



