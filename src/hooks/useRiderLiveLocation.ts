import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../firebase/config';
import { MapCoordinate } from '../utils/coords';
import {
  classifyFreshness,
  freshnessLabel,
  SIGNAL_LOST_THRESHOLD_MS,
  type PositionFreshness,
} from '../constants/tracking';

export interface RiderLiveLocation extends MapCoordinate {
  heading: number | null;
  updatedAt: number;
}

export interface RiderLiveLocationState {
  /** Last position received. Retained even once stale — see `freshness`. */
  location: RiderLiveLocation | null;
  freshness: PositionFreshness;
  ageMs: number;
  /** Customer-facing explanation, or null while the feed is live. */
  label: string | null;
}

// How often the age is re-evaluated. Firebase only pushes on change, so without
// this a pin that stopped updating would keep claiming to be live forever.
const FRESHNESS_TICK_MS = 5000;

/**
 * Subscribes to a rider's live position at `riders/{riderId}` — this project's
 * documented Firebase RTDB convention (see AGENTS.md) for rider GPS, written by
 * RiderMobileApp's location broadcast.
 *
 * Returns the last known position together with how old it is, rather than the
 * raw coordinate alone. That distinction is the point: this hook previously
 * returned a bare coordinate with no notion of age, so a rider whose phone died
 * twenty minutes ago still rendered as a confident "Live GPS" pin. A frozen pin
 * presented as live is worse than an honest "weak signal here" — the customer
 * makes decisions based on it.
 */
export function useRiderLiveLocation(riderId: number | null | undefined): RiderLiveLocationState {
  const [location, setLocation] = useState<RiderLiveLocation | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!riderId) {
      setLocation(null);
      return;
    }

    const locationRef = ref(database, `riders/${riderId}`);
    const unsubscribe = onValue(locationRef, (snapshot) => {
      const val = snapshot.val();
      if (!val || typeof val.latitude !== 'number' || typeof val.longitude !== 'number') {
        setLocation(null);
        return;
      }
      setLocation({
        latitude: val.latitude,
        longitude: val.longitude,
        heading: typeof val.heading === 'number' ? val.heading : null,
        updatedAt: typeof val.updatedAt === 'number' ? val.updatedAt : Date.now(),
      });
    });

    return () => {
      unsubscribe();
      setLocation(null);
    };
  }, [riderId]);

  // Ages the position even when no new data arrives.
  useEffect(() => {
    if (!location) return;
    const timer = setInterval(() => setNow(Date.now()), FRESHNESS_TICK_MS);
    return () => clearInterval(timer);
  }, [location]);

  return useMemo(() => {
    if (!location) {
      return { location: null, freshness: 'LOST' as const, ageMs: 0, label: null };
    }
    const ageMs = Math.max(0, now - location.updatedAt);
    const freshness = classifyFreshness(location.updatedAt, now);
    return { location, freshness, ageMs, label: freshnessLabel(freshness, ageMs) };
  }, [location, now]);
}

export { SIGNAL_LOST_THRESHOLD_MS };
