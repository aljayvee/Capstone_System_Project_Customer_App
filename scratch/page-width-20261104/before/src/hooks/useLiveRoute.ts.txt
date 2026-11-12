import { useEffect, useRef, useState } from 'react';
import { MapCoordinate } from '../utils/coords';
import {
  fetchDrivingRoute,
  type RouteRequestOptions,
  type RouteSelection,
} from '../services/directionsService';
import { useNetworkStatus } from '../context/NetworkContext';

const REFRESH_INTERVAL_MS = 30000;

export interface LiveRouteResult {
  coordinates: MapCoordinate[] | null;
  /** First leg only: rider → first store (or rider → customer if no waypoints). */
  pickupLegCoordinates: MapCoordinate[] | null;
  /** Remaining legs: stores → customer. Null if no waypoints. */
  deliveryLegCoordinates: MapCoordinate[] | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  /**
   * Distance and time for the stretch the pickup line draws (rider through
   * every outstanding store) and the one the delivery line draws (last store,
   * or the rider, to the customer). The map quotes whichever it is showing, so
   * the figure beside the line always describes that line. `distanceMeters`
   * above is the whole errand, and did not: 55.7 km beside a line that was 52.9.
   */
  pickupDistanceMeters: number | null;
  pickupDurationSeconds: number | null;
  deliveryDistanceMeters: number | null;
  deliveryDurationSeconds: number | null;
  /** Road distance from the rider to the next store, when there is one. */
  nextStopRoadMeters: number | null;
  /**
   * How the route was chosen, when the fastest was asked for: for a tracked
   * errand, the rider's own verdict. `drawnWith` says which map to show.
   */
  selection: RouteSelection | null;
  isLoading: boolean;
  /**
   * True when the drawn shape is a straight-line estimate rather than a measured
   * road route — either the server's haversine fallback or the offline fallback
   * built below. The map draws these differently so a customer is never shown a
   * line the rider cannot actually follow.
   */
  degraded: boolean;
  /**
   * Whose roads the drawn line follows: 'osrm', 'google', 'haversine' for the
   * server's straight-line guess, or null (no route yet, or the offline guess
   * built below). A road line is drawn only on its own engine's map
   * (config/mapChoice.ts lineFitsMap).
   */
  lineEngine: string | null;
  /**
   * The engine named as `provider`, when it could not route on its own roads
   * even when asked for nothing else. Null while it can. The line is then
   * never the other engine's: the last one drawn on this engine stays, else a
   * straight-line guess, and the map may move (config/mapChoice.ts).
   */
  unroutable: 'osrm' | 'google' | null;
}

const EMPTY_RESULT: LiveRouteResult = {
  coordinates: null,
  pickupLegCoordinates: null,
  deliveryLegCoordinates: null,
  distanceMeters: null,
  durationSeconds: null,
  pickupDistanceMeters: null,
  pickupDurationSeconds: null,
  deliveryDistanceMeters: null,
  deliveryDurationSeconds: null,
  nextStopRoadMeters: null,
  selection: null,
  isLoading: false,
  degraded: false,
  lineEngine: null,
  unroutable: null,
};

/**
 * Whose roads a route's line follows: the engine it was drawn with, else the
 * engine that answered. Null when the server did not say (an older one).
 */
export function lineEngineOf(route: { selection?: RouteSelection | null; provider?: string }): string | null {
  const engine = route.selection?.drawnWith ?? route.provider;
  return engine && engine !== 'unknown' ? engine : null;
}

type LegFigures = Pick<
  LiveRouteResult,
  | 'pickupDistanceMeters'
  | 'pickupDurationSeconds'
  | 'deliveryDistanceMeters'
  | 'deliveryDurationSeconds'
  | 'nextStopRoadMeters'
>;

/**
 * Splits the route's legs the same way the server splits its lines
 * (routingService.splitLegs): every leg but the last is the shopping run, the
 * last is the run in to the customer. With a single leg there is no shopping
 * run left to draw, so it all counts as delivery.
 */
export function legFigures(
  legs: { distanceMeters: number; durationSeconds: number }[],
  riderToStores: boolean
): LegFigures {
  const none: LegFigures = {
    pickupDistanceMeters: null,
    pickupDurationSeconds: null,
    deliveryDistanceMeters: null,
    deliveryDurationSeconds: null,
    nextStopRoadMeters: null,
  };
  if (legs.length === 0) return none;

  const last = legs[legs.length - 1];
  const shopping = legs.length > 1 ? legs.slice(0, -1) : [];
  const sum = (key: 'distanceMeters' | 'durationSeconds') =>
    shopping.reduce((total, leg) => total + leg[key], 0);

  return {
    pickupDistanceMeters: shopping.length > 0 ? sum('distanceMeters') : null,
    pickupDurationSeconds: shopping.length > 0 ? sum('durationSeconds') : null,
    deliveryDistanceMeters: last.distanceMeters,
    deliveryDurationSeconds: last.durationSeconds,
    // Leg 0 ends at the first outstanding store only when the route starts at
    // the rider and has stores in it; otherwise it starts at a store.
    nextStopRoadMeters: riderToStores && shopping.length > 0 ? legs[0].distanceMeters : null,
  };
}

/**
 * Builds a direct straight-line polyline connecting the available points
 * ONLY used as a true offline / API failure fallback, never as an initial flash.
 */
function buildFallbackRoute(
  origin: MapCoordinate | null,
  destination: MapCoordinate | null,
  waypoints: MapCoordinate[]
): LiveRouteResult {
  const allPoints: MapCoordinate[] = [
    ...(origin ? [origin] : []),
    ...waypoints,
    ...(destination ? [destination] : []),
  ];

  if (allPoints.length < 2) {
    return EMPTY_RESULT;
  }

  if (origin && waypoints.length > 0) {
    const pickupLeg = [origin, waypoints[0]];
    const deliveryLeg = destination ? [...waypoints, destination] : [...waypoints];
    return {
      ...EMPTY_RESULT,
      coordinates: allPoints,
      pickupLegCoordinates: pickupLeg,
      deliveryLegCoordinates: deliveryLeg.length >= 2 ? deliveryLeg : null,
      distanceMeters: null,
      durationSeconds: null,
      isLoading: false,
      degraded: true,
    };
  }

  return {
    ...EMPTY_RESULT,
    coordinates: allPoints,
    pickupLegCoordinates: null,
    deliveryLegCoordinates: allPoints,
    distanceMeters: null,
    durationSeconds: null,
    isLoading: false,
    degraded: true,
  };
}

/**
 * Fetches and maintains a real-world GIS driving route following the road network.
 * Accurately tracks rider GPS movements and splits routes into:
 * - Pickup Leg (Orange): Rider → First Store
 * - Delivery Leg (Blue): Store(s) → Customer
 */
export function useLiveRoute(
  origin: MapCoordinate | null,
  destination: MapCoordinate | null,
  waypoints: MapCoordinate[] = [],
  /**
   * `choose: 'fastest'` with the tracked `errandId`: the server hands back the
   * route the rider is following, on the rider's map.
   *
   * `provider`: the roads of the map on screen. Named, it is binding. The
   * server redraws the rider's path on them where it can, and otherwise
   * answers on the other engine's roads, which sit metres beside the roads
   * painted under this map. That line is never shown: the hook asks once more
   * for this map's engine alone, and failing that reports `unroutable`.
   */
  options: Omit<RouteRequestOptions, 'keep'> = {}
): LiveRouteResult {
  const { choose, errandId, provider } = options;
  const waypointsKey = JSON.stringify(waypoints.map((w) => [w.latitude, w.longitude]));
  // Re-trigger on ~10m GPS movements or when origin appears
  const originLat = origin ? origin.latitude.toFixed(4) : 'null';
  const originLng = origin ? origin.longitude.toFixed(4) : 'null';

  const [result, setResult] = useState<LiveRouteResult>(EMPTY_RESULT);

  const originRef = useRef(origin);
  originRef.current = origin;
  const { isConnected, reconnectCount } = useNetworkStatus();

  // The route on screen, and what it was last asked for with: naming the map
  // chosen from that very route must not fetch the same road again.
  const resultRef = useRef(result);
  resultRef.current = result;
  const lastAskRef = useRef<{ key: string; provider: string | undefined } | null>(null);

  useEffect(() => {
    const currentWaypoints: MapCoordinate[] = JSON.parse(waypointsKey).map(
      ([latitude, longitude]: [number, number]) => ({ latitude, longitude })
    );

    const hasRider = Boolean(origin);
    const effectiveOrigin = hasRider ? origin : (currentWaypoints.length > 0 ? currentWaypoints[0] : null);
    const effectiveDestination = destination ?? (currentWaypoints.length > 0 ? currentWaypoints[currentWaypoints.length - 1] : null);
    const effectiveWaypoints = hasRider ? currentWaypoints : currentWaypoints.slice(1);

    if (!effectiveOrigin || !effectiveDestination) {
      return;
    }

    let cancelled = false;
    // Set once an answer came back on the other engine's roads: from then on
    // the map's own engine is asked for alone.
    let askOwnEngine = false;

    const fetchRoute = () => {
      const liveRider = originRef.current;
      const liveOrigin = liveRider || (currentWaypoints.length > 0 ? currentWaypoints[0] : null);
      if (!liveOrigin) return;

      const liveWaypoints = liveRider ? currentWaypoints : currentWaypoints.slice(1);

      setResult((prev) => ({ ...prev, isLoading: !prev.coordinates }));

      // Without the errand: with it the server replaces `keep` with the
      // rider's verdict, the very engine that could not be drawn here.
      const request: RouteRequestOptions =
        askOwnEngine && provider ? { choose, provider, keep: provider } : { choose, errandId, provider };

      fetchDrivingRoute(liveOrigin, effectiveDestination, liveWaypoints, request).then((res) => {
        if (!cancelled) {
          if (res && res.coordinates && res.coordinates.length > 0) {
            const lineEngine = lineEngineOf(res);
            // Drawn on the other engine's roads. A straight-line guess
            // (degraded) follows no roads, is drawn dashed, and may stand on
            // either map.
            if (provider && !res.degraded && lineEngine !== provider) {
              if (!askOwnEngine) {
                askOwnEngine = true;
                fetchRoute();
                return;
              }
              // This map's engine has no route of its own: keep the last
              // line drawn on it, else a guess, never the other engine's.
              setResult((prev) =>
                prev.coordinates && !prev.degraded && prev.lineEngine === provider
                  ? { ...prev, isLoading: false, unroutable: provider }
                  : { ...buildFallbackRoute(originRef.current, destination, currentWaypoints), unroutable: provider }
              );
              return;
            }
            // If rider was present with waypoints: leg 0 is pickup, leg 1+ is delivery
            if (liveRider && currentWaypoints.length > 0) {
              setResult({
                coordinates: res.coordinates,
                pickupLegCoordinates: res.pickupLegCoordinates,
                deliveryLegCoordinates: res.deliveryLegCoordinates,
                distanceMeters: res.distanceMeters,
                durationSeconds: res.durationSeconds,
                isLoading: false,
                degraded: res.degraded,
                selection: res.selection,
                lineEngine,
                unroutable: null,
                ...legFigures(res.legs, Boolean(liveRider)),
              });
            } else if (liveRider && currentWaypoints.length === 0) {
              // Direct rider → customer delivery
              setResult({
                coordinates: res.coordinates,
                pickupLegCoordinates: null,
                deliveryLegCoordinates: res.coordinates,
                distanceMeters: res.distanceMeters,
                durationSeconds: res.durationSeconds,
                isLoading: false,
                degraded: res.degraded,
                selection: res.selection,
                lineEngine,
                unroutable: null,
                ...legFigures(res.legs, Boolean(liveRider)),
              });
            } else {
              // No rider yet: route is store → customer (delivery leg only in blue)
              setResult({
                coordinates: res.coordinates,
                pickupLegCoordinates: null,
                deliveryLegCoordinates: res.coordinates,
                distanceMeters: res.distanceMeters,
                durationSeconds: res.durationSeconds,
                isLoading: false,
                degraded: res.degraded,
                selection: res.selection,
                lineEngine,
                unroutable: null,
                ...legFigures(res.legs, Boolean(liveRider)),
              });
            }
          } else {
            setResult(buildFallbackRoute(originRef.current, destination, currentWaypoints));
          }
        }
      });
    };

    // Offline, every 30s refresh is a guaranteed miss that also swaps the
    // drawn road route for the straight-line fallback. Hold the last good shape
    // instead, and re-fetch on the reconnect edge.
    if (!isConnected) {
      return () => {
        cancelled = true;
      };
    }

    // The map has only been named after the line already on screen: the first
    // route is asked for with no map named, comes back drawn on, say, OSRM's
    // roads, and the map chosen from it is named in every request after
    // (config/mapChoice.ts). Asking now would fetch the very same road again;
    // the refresh below still runs.
    const askKey = JSON.stringify([
      destination?.latitude,
      destination?.longitude,
      waypointsKey,
      originLat,
      originLng,
      reconnectCount,
      choose,
      errandId,
    ]);
    const previous = lastAskRef.current;
    lastAskRef.current = { key: askKey, provider };
    const onScreen = resultRef.current;
    const namedAfterLineOnScreen =
      previous?.key === askKey &&
      previous.provider === undefined &&
      provider != null &&
      onScreen.lineEngine === provider &&
      !onScreen.degraded &&
      (onScreen.coordinates?.length ?? 0) > 0;

    if (!namedAfterLineOnScreen) fetchRoute();
    const interval = setInterval(fetchRoute, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.latitude, destination?.longitude, waypointsKey, originLat, originLng, isConnected, reconnectCount, choose, errandId, provider]);

  return result;
}




