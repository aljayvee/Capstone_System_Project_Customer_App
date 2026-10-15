import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { Target, Radio, Navigation, Maximize2, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, FontSizes, FontWeights, Spacing, Shadows } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { formatDuration, formatDistance } from '../utils/format';
import { MapCoordinate, toRegion } from '../utils/coords';
import type { RiderLiveLocation } from '../hooks/useRiderLiveLocation';
import { useSmoothedRiderPosition } from '../hooks/useSmoothedRiderPosition';
import {
  OSM_ATTRIBUTION,
  OSM_MAX_NATIVE_ZOOM,
  OSM_MAX_ZOOM,
  OSM_TILE_CACHE_MAX_AGE_SECONDS,
  OSM_TILE_CACHE_PATH,
  OSM_TILE_URL,
} from '../config/mapTiles';
import { lineFitsMap, type MapStyle } from '../config/mapChoice';

/** The arrow puck the rider app draws too; source in assets/rider-puck.svg. */
const RIDER_PUCK = require('../../assets/rider-puck.png');

/** Fallback center for Tacurong City when coordinates are uninitialized */
const DEFAULT_CENTER: MapCoordinate = {
  latitude: 6.6975,
  longitude: 124.6750,
};

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
   * Figures for each drawn line (see useLiveRoute). When given, the badge
   * quotes the line on screen and says which it is, instead of the whole
   * errand beside only part of it. Omitted, it falls back to the totals above.
   */
  pickupDistanceMeters?: number | null;
  pickupDurationSeconds?: number | null;
  deliveryDistanceMeters?: number | null;
  deliveryDurationSeconds?: number | null;
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
  /**
   * The map under the line: the same one the rider sees, decided by the
   * server (the map of the engine whose roads the rider's route follows).
   * 'osm' draws our OpenStreetMap tiles in place of Google's map. Null while
   * the first route has not said which: no map is created until it has, so
   * none is ever switched in place (config/mapChoice.ts).
   */
  mapStyle?: MapStyle | null;
  /**
   * Whose roads the route line follows (useLiveRoute `lineEngine`). A road
   * line is drawn only on its own engine's map; another engine's would run
   * metres beside the roads painted under it. A dashed guess stands on either.
   */
  lineEngine?: string | null;
}

/** How the camera is framed. */
type MapMode = 'full' | 'focus';

/** Close enough to follow a rider through a street grid. */
const FOCUS_ZOOM = 17;
/** A slight lean into the horizon, as every navigation view uses. */
const FOCUS_PITCH = 45;

/**
 * The closest the customer can zoom. The route comes from OpenStreetMap's road
 * data and the map underneath is Google's, and the two disagree by a few metres
 * in places: outside Banga one mapped segment runs 5 degrees off the real road,
 * which at full zoom put the line ten metres beside it. At street level that is
 * a line on its road; past it the mismatch fills the screen.
 */
const MAX_ZOOM = 18;

/**
 * The rider's phone can sit off the road the route starts on (in a yard, a
 * lot, the middle of a field), and the route starts where the road is. Beyond
 * this gap a dotted link joins the two, so the line does not seem to begin
 * nowhere near the rider. Past MAX_LINK_METERS the route is not from here.
 */
const MIN_LINK_METERS = 12;
const MAX_LINK_METERS = 500;

function metersBetween(a: MapCoordinate, b: MapCoordinate): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

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
  pickupDistanceMeters,
  pickupDurationSeconds,
  deliveryDistanceMeters,
  deliveryDurationSeconds,
  degraded = false,
  phase = 'shopping',
  mapStyle = 'google',
  lineEngine,
}: LiveTrackingMapProps) {
  const showOsm = mapStyle === 'osm';
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
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

  // Nothing at all while the line is another engine's: the moment between a
  // map being chosen or changed and its own line arriving.
  const lineOnMap = lineFitsMap(mapStyle, lineEngine, degraded);
  const routeLine = !lineOnMap
    ? []
    : phase === 'delivering'
      ? firstDrawable(deliveryLegCoordinates, routeCoordinates, pickupLegCoordinates)
      : firstDrawable(pickupLegCoordinates, routeCoordinates);

  const routeColor = phase === 'delivering' ? colors.primary : '#F97316';

  // The badge describes the line being drawn. The shopping line is the run
  // through the stores, the delivery line the run in to the customer; each has
  // its own figures. The whole-errand total is only the fallback, unlabelled,
  // for a server or route that did not send per-leg figures.
  const legEta =
    phase === 'delivering'
      ? { label: 'To you', meters: deliveryDistanceMeters, seconds: deliveryDurationSeconds }
      : { label: 'To store', meters: pickupDistanceMeters, seconds: pickupDurationSeconds };
  const eta =
    legEta.meters != null && legEta.seconds != null
      ? legEta
      : { label: null, meters: distanceMeters, seconds: durationSeconds };
  const hasEta = eta.meters != null && eta.seconds != null;

  const routeStart = routeLine.length > 1 ? routeLine[0] : null;
  const linkGap = riderLocation && routeStart ? metersBetween(riderLocation, routeStart) : 0;
  const showLink = linkGap >= MIN_LINK_METERS && linkGap <= MAX_LINK_METERS;

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


  const initialCenter = customerCoordinate || riderLocation || pinpoints[0] || DEFAULT_CENTER;

  // No map until the first route has said which one (at most
  // MAP_CHOICE_WAIT_MS, then Google): one created as Google and turned into
  // OpenStreetMap afterwards is exactly the switch Petal Maps ignores.
  if (mapStyle === null) {
    return (
      <View
        style={[
          styles.wrapper,
          height != null ? { height } : styles.wrapperFlex,
          styles.placeholder,
          { backgroundColor: colors.bgGray },
        ]}
        testID="map-placeholder"
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.placeholderText, { color: colors.textGray }]}>Loading the map</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, height != null ? { height } : styles.wrapperFlex]}>
      <MapView
        // A new native map for a new style, never a live one switched: the
        // map type is read once, from the first props (MapViewManager
        // createViewInstance), and Huawei's Petal Maps ignores a later switch
        // to 'none', leaving its roads drawn under our tiles.
        key={mapStyle}
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        googleRenderer="LEGACY"
        style={StyleSheet.absoluteFill}
        initialRegion={toRegion(initialCenter)}
        maxZoomLevel={MAX_ZOOM}
        mapType={showOsm ? 'none' : 'standard'}
        onMapReady={() => {
          // A map created after the route arrived (the first, or one made
          // again for another style) frames it once it exists.
          if (mode === 'full') fitAllPoints();
        }}
        onPanDrag={() => {
          // Touching the map while it is following takes the camera back. The
          // mode flips visibly rather than the follow silently ceasing.
          if (mode === 'focus') enterFull();
        }}
      >
        {showOsm && (
          <UrlTile
            urlTemplate={OSM_TILE_URL}
            maximumZ={OSM_MAX_ZOOM}
            maximumNativeZ={OSM_MAX_NATIVE_ZOOM}
            tileCachePath={OSM_TILE_CACHE_PATH ?? undefined}
            tileCacheMaxAge={OSM_TILE_CACHE_MAX_AGE_SECONDS}
            shouldReplaceMapContent
            zIndex={-1}
            testID="osm-tiles"
          />
        )}

        <Marker coordinate={customerCoordinate} title="Delivery Address" pinColor={colors.primary} />

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
              <View
                style={[
                  styles.pinBadge,
                  { backgroundColor: colors.primary },
                  done && [styles.pinBadgeDone, { backgroundColor: colors.textLight }],
                ]}
              >
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
            // An image, never a child view: on Android's new architecture a
            // child view is snapshotted once and can come back blank after the
            // map redraws (react-native-maps #5877; it happened to the rider
            // app's own dot). The same arrow puck the rider sees.
            image={RIDER_PUCK}
          />
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

        {/* From the rider to where their route joins the road. */}
        {showLink && riderLocation && routeStart && (
          <Polyline
            coordinates={[riderLocation, routeStart]}
            strokeColor={routeColor}
            strokeWidth={3}
            lineDashPattern={[2, 6]}
            testID="route-link"
          />
        )}
      </MapView>

      {/* The OpenStreetMap licence requires this wherever its map is shown. */}
      {showOsm && (
        <Text style={styles.attribution} maxFontSizeMultiplier={1}>
          {OSM_ATTRIBUTION}
        </Text>
      )}

      {/* Floating Top Controls */}
      <View style={[styles.floatingTopBar, { top: insets.top > 0 ? insets.top + 8 : 12 }]}>
        {/* ETA & Distance Floating Badge */}
        {hasEta ? (
          <View style={styles.etaBadge} testID="map-eta-badge">
            <Clock size={12} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.etaText}>
              {eta.label ? `${eta.label} · ` : ''}
              {formatDuration(eta.seconds!)} • {formatDistance(eta.meters!)}
            </Text>
          </View>
        ) : (
          <View style={[styles.livePill, { backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
            <Radio size={12} color={riderLocation ? colors.success : colors.warning} strokeWidth={2.4} />
            <Text style={[styles.livePillText, { color: riderLocation ? colors.success : colors.warning }]}>
              {riderLocation ? 'Live GPS' : 'Connecting...'}
            </Text>
          </View>
        )}

        {/* Follow the rider, or step back and see the whole route. */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.recenterBtn,
            { backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' },
            mode === 'focus' && [styles.modeBtnActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
          ]}
          onPress={mode === 'focus' ? enterFull : enterFocus}
          accessibilityLabel={mode === 'focus' ? 'Show the whole route' : 'Follow the rider'}
          testID="map-mode-toggle"
        >
          {mode === 'focus' ? (
            <Maximize2 size={18} color="#FFFFFF" strokeWidth={2.2} />
          ) : (
            <Navigation size={18} color={colors.textDark} strokeWidth={2.2} />
          )}
        </TouchableOpacity>

        {/* Re-frame the route without leaving Full. */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.recenterBtn, { backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}
          onPress={() => {
            enterFull();
            fitAllPoints();
          }}
          testID="map-recenter-btn"
        >
          <Target size={18} color={colors.textDark} strokeWidth={2.2} />
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
  attribution: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    fontSize: 10,
    color: '#1F2937',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  wrapperFlex: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  placeholderText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  pinBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A finished stop recedes rather than disappearing: still placed, clearly not
  // part of the remaining trip.
  pinBadgeDone: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  modeBtnActive: {},
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



