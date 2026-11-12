import { useEffect, useRef, useState } from 'react';
import { AnimatedRegion } from 'react-native-maps';
import { bearingBetween, haversineDistanceKm } from '../utils/geo';
import type { RiderLiveLocation } from './useRiderLiveLocation';

/**
 * Bounds on how long the marker takes to travel between two fixes.
 *
 * Position updates arrive from Firebase in bursts whenever the rider's phone
 * gets a fix — every few seconds on a good signal, far less often through the
 * covered stretch of the public market. Tweening over a fixed duration would
 * either overshoot the next update (marker lagging further behind reality with
 * every fix) or finish instantly on the short hops.
 *
 * Scaling by distance keeps the apparent speed roughly honest: a 30 m step
 * takes about a second, and anything bigger is capped rather than allowed to
 * crawl. The cap matters most when a rider comes back from a signal blackout
 * several blocks away — sliding smoothly across that gap for ten seconds would
 * show a position that was never true.
 */
const MIN_DURATION_MS = 600;
const MAX_DURATION_MS = 2500;
const METRES_PER_MS = 0.03;

/**
 * Past this, the fix is not movement — it is a different place entirely.
 *
 * A rider cannot cover two kilometres between updates, so this is a GPS glitch,
 * a re-acquired signal, or a mock-location app being dragged across the map.
 * Jumping is the honest rendering: there is no path to draw.
 */
const TELEPORT_THRESHOLD_KM = 2;

/** Below this the "movement" is GPS noise, and a derived bearing is meaningless. */
const MIN_BEARING_DISTANCE_KM = 0.005;

/** Ignore rotations too small to see, so a parked rider's marker stops twitching. */
const MIN_BEARING_CHANGE_DEG = 8;

export interface SmoothedRiderPosition {
  /** Feed to `Marker.Animated`'s `coordinate`. Null until the first fix lands. */
  coordinate: AnimatedRegion | null;
  /** Degrees clockwise from north. Updates at most once per fix. */
  rotation: number;
  /** How long the current tween runs, so the camera can follow at the same pace. */
  durationMs: number;
}

/**
 * Turns discrete GPS fixes into continuous marker movement.
 *
 * The map used to render the raw coordinate, so the rider's dot sat still and
 * then teleported each time a fix arrived. This interpolates between them.
 *
 * Deliberately drives an `AnimatedRegion` rather than component state: the
 * coordinate changes every frame, and putting that through `setState` would
 * re-render the whole map — polylines, every store pin — sixty times a second.
 * Rotation does go through state, but only when the bearing actually changes,
 * which is at most once per fix.
 */
export function useSmoothedRiderPosition(
  location: RiderLiveLocation | null
): SmoothedRiderPosition {
  const animatedRef = useRef<AnimatedRegion | null>(null);
  const previousRef = useRef<RiderLiveLocation | null>(null);
  const durationRef = useRef(MIN_DURATION_MS);

  const [rotation, setRotation] = useState(0);
  // Only so the first fix triggers one render — after that the AnimatedRegion
  // updates the marker without React being involved.
  const [, setReady] = useState(false);

  useEffect(() => {
    if (!location) return;

    const previous = previousRef.current;
    previousRef.current = location;

    // First fix: place the marker, never slide to it from the map's default
    // centre out in the Gulf of Guinea.
    if (!animatedRef.current) {
      animatedRef.current = new AnimatedRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });
      setRotation(location.heading ?? 0);
      setReady(true);
      return;
    }

    const distanceKm = previous ? haversineDistanceKm(previous, location) : 0;

    // Point the marker along the path it is about to take, before it moves.
    const derived =
      previous && distanceKm >= MIN_BEARING_DISTANCE_KM
        ? bearingBetween(previous, location)
        : null;
    const nextRotation = location.heading ?? derived;
    if (nextRotation !== null) {
      setRotation((current) => {
        // Compare the short way round: 359 -> 3 is a six-degree turn, not 356.
        const delta = Math.abs(((nextRotation - current + 540) % 360) - 180);
        return delta >= MIN_BEARING_CHANGE_DEG ? nextRotation : current;
      });
    }

    const region = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    };

    if (distanceKm > TELEPORT_THRESHOLD_KM) {
      animatedRef.current.setValue(region);
      durationRef.current = 0;
      return;
    }

    const duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, (distanceKm * 1000) / METRES_PER_MS)
    );
    durationRef.current = duration;

    animatedRef.current
      // Coordinates are not a native-drivable prop, so this runs on the JS
      // thread. It is two values on one marker; the cost is negligible next to
      // the re-render it replaces.
      // `toValue` is required by the library's types but never used: timing()
      // spreads this config and then overwrites toValue per coordinate with the
      // matching field off `region`. Zero here is inert.
      .timing({ ...region, toValue: 0, duration, useNativeDriver: false })
      .start();
  }, [location?.latitude, location?.longitude, location?.updatedAt]);

  return {
    coordinate: animatedRef.current,
    rotation,
    durationMs: durationRef.current,
  };
}
