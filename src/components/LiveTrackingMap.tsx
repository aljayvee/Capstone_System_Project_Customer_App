import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { Target, Radio, Navigation, Maximize2, Clock, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalFontSizeMultipliers, Spacing, FontFamily, PortalFontSizes, scaledPortalFontSize } from '../config/theme';
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
  /**
   * ADDITIVE, 2026-11-10 (useLiveRoute `routeKey`). Names the route being
   * drawn. Given, the camera re-frames when it changes, not when the line
   * loses a point: the rider's line is trimmed at the rider as they ride, and
   * keying on its length moved the camera every few fixes.
   */
  routeKey?: string | null;
  /**
   * ADDITIVE, 2026-11-10 (useLiveRoute `routeUpdatedAt`). When the rider last
   * left their route and was given a new one. The legend says so for a short
   * while, quietly: a customer is not told "Recalculating".
   */
  routeUpdatedAt?: number | null;
}

/** How long the legend says the route was updated. */
const ROUTE_UPDATED_NOTICE_MS = 2 * 60 * 1000;

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
  routeKey = null,
  routeUpdatedAt = null,
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

  const routeColor = phase === 'delivering' ? colors.routeToCustomer : colors.routeToStore;

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
    ...(routeKey
      ? [routeKey]
      : [pickupLegCoordinates?.length ?? 0, deliveryLegCoordinates?.length ?? 0, routeCoordinates?.length ?? 0]),
  ].join('|');

  // Re-read by the legend; the notice ends on the next render after it lapses.
  const routeRecentlyUpdated =
    routeUpdatedAt != null && Date.now() - routeUpdatedAt < ROUTE_UPDATED_NOTICE_MS;

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
        <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.placeholderText, { color: colors.textGray }]}>Loading the map</Text>
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

        <Marker coordinate={customerCoordinate} title="Delivery Address" pinColor={colors.routeToCustomer} />

        {/* The arrival circle, drawn so the customer can see where "arrived at
            the store" is actually decided rather than having to trust a status
            change with no visible cause. Dimmed once the stop is done. */}
        {pinpoints.map((pin, idx) => (
          <Circle
            key={`radius-${pin.id || idx}`}
            center={pin}
            radius={pin.geofenceRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS}
            strokeWidth={2}
            strokeColor={pin.departedAt ? colors.routePreview : colors.routeToStore}
            fillColor={`${pin.departedAt ? colors.routePreview : colors.routeToStore}1A`}
          />
        ))}

        {pinpoints.map((pin, idx) => {
          const done = Boolean(pin.departedAt);
          return (
            <Marker
              key={pin.id || `pin-${idx}`}
              coordinate={pin}
              title={`Store #${idx + 1}: ${pin.storeName}${done ? ' (completed)' : ''}`}
            >
              <View
                style={[
                  styles.pinBadge,
                  { backgroundColor: done ? colors.success : colors.warning, borderColor: colors.card },
                ]}
                accessible
                accessibilityLabel={`Store ${idx + 1}: ${pin.storeName}${done ? ', completed' : ', pickup stop'}`}
              >
                {done ? <Check size={14} color={colors.onSuccess} strokeWidth={3} /> : (
                  <Text style={[styles.pinBadgeText, { color: colors.onWarning }]} maxFontSizeMultiplier={1}>{idx + 1}</Text>
                )}
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
            strokeColor={colors.bgDark}
            strokeWidth={8}
            lineDashPattern={routeDashPattern}
            zIndex={1}
            testID="route-line-outline"
          />
        )}
        {routeLine.length > 1 && (
          <Polyline
            coordinates={routeLine}
            strokeColor={routeColor}
            strokeWidth={4}
            lineDashPattern={routeDashPattern}
            zIndex={2}
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
        <Text style={[styles.attribution, { backgroundColor: colors.card, color: colors.textGray }]} maxFontSizeMultiplier={1}>
          {OSM_ATTRIBUTION}
        </Text>
      )}

      {/* Floating Top Controls */}
      <View style={[styles.controlsOverlay, { top: insets.top > 0 ? insets.top + 8 : 12 }]} pointerEvents="box-none">
        <View style={styles.floatingTopBar}>
          {/* ETA & Distance Floating Badge */}
          {hasEta ? (
            <View style={[styles.etaBadge, { backgroundColor: colors.card, borderColor: colors.border }]} testID="map-eta-badge">
              <Clock size={15} color={colors.textDark} strokeWidth={2} />
              <Text style={[styles.etaText, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                {eta.label ? `${eta.label} · ` : ''}
                {formatDuration(eta.seconds!)} • {formatDistance(eta.meters!)}
              </Text>
            </View>
          ) : (
            <View style={[styles.livePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Radio size={12} color={riderLocation ? colors.success : colors.warning} strokeWidth={2.4} />
              <Text style={[styles.livePillText, { color: riderLocation ? colors.success : colors.warning }]} maxFontSizeMultiplier={1.2}>
                {riderLocation ? 'Live GPS' : 'Connecting...'}
              </Text>
            </View>
          )}

          {/* Follow the rider, or step back and see the whole route. */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.recenterBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              mode === 'focus' && { backgroundColor: isDark ? colors.primary : colors.primaryStrong },
            ]}
            onPress={mode === 'focus' ? enterFull : enterFocus}
            accessibilityLabel={mode === 'focus' ? 'Show the whole route' : 'Follow the rider'}
            testID="map-mode-toggle"
            accessibilityRole="button"
            accessibilityState={{ selected: mode === 'focus' }}
          >
            {mode === 'focus' ? (
              <Maximize2 size={18} color={colors.onPrimary} strokeWidth={2.2} />
            ) : (
              <Navigation size={18} color={colors.textDark} strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          {/* Re-frame the route without leaving Full. */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.recenterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              enterFull();
              fitAllPoints();
            }}
            testID="map-recenter-btn"
            accessibilityRole="button"
            accessibilityLabel="Fit the route in the map"
          >
            <Target size={18} color={colors.textDark} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        {routeLine.length > 1 && (
          <View
            style={[styles.routeLegend, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessible
            accessibilityLabel={`${phase === 'delivering' ? 'Delivery route to you' : 'Shopping route to the stores'}${degraded ? ', dashed line: approximate route' : ', solid line: road route'}`}
          >
            <View style={styles.routeLegendSample}>
              {(degraded ? [0, 1, 2] : [0]).map((segment) => (
                <View key={segment} style={[styles.routeLegendLine, { backgroundColor: routeColor, borderColor: colors.bgDark }]} />
              ))}
            </View>
            <Text style={[styles.routeLegendText, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
              {degraded ? 'Approximate route (dashed)' : phase === 'delivering' ? 'Delivery route' : 'Store route'}
              {!degraded && routeRecentlyUpdated ? ' · Route updated' : ''}
            </Text>
          </View>
        )}
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
    fontFamily: FontFamily.regular,
    position: 'absolute',
    left: 6,
    bottom: 4,
    fontSize: PortalFontSizes.micro,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
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
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    fontFamily: FontFamily.semibold,
  },
  pinBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
  },
  controlsOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 10,
  },
  floatingTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'box-none',
  },
  etaBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  etaText: {
    flexShrink: 1,
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.caption,
    lineHeight: 19,
  },
  livePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  livePillText: {
    flexShrink: 1,
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
  },
  routeLegend: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  routeLegendSample: { width: 22, flexDirection: 'row', gap: 2 },
  routeLegendLine: { flex: 1, height: 5, borderRadius: 2, borderWidth: 1 },
  routeLegendText: { flexShrink: 1, fontFamily: FontFamily.regular, fontSize: PortalFontSizes.micro, lineHeight: 17 },
  recenterBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});



