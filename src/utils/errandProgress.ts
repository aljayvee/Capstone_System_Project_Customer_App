import { MapCoordinate } from './coords';
import { haversineDistanceKm, nearestPoint } from './geo';

export const ERRAND_PROGRESS_LABELS = [
  'Errand Received by the Rider',
  'Traveling to store',
  'Items Purchased',
  'In route to you',
  'Delivered',
] as const;

/**
 * The rider's own flow merged "Items Purchased" and "In Transit" into one step,
 * because nothing happened between them that the rider had to decide.
 *
 * The customer's timeline keeps both labels: they describe two things a customer
 * genuinely cares about — the shopping being done, and the rider being on the
 * way — even though one action now produces both. `itemsPurchasedAt` is written
 * at that single moment and drives stage 3 exactly as before.
 */

const NEARBY_THRESHOLD_KM = 0.3;

export interface ErrandPinpoint extends MapCoordinate {
  storeName?: string;
  // Set by the server's geofence from the rider's breadcrumb. Present on every
  // errand payload; used here only to tell a finished stop from an outstanding
  // one.
  arrivedAt?: string | null;
  departedAt?: string | null;
}

export interface ErrandProgressInput {
  status: string | null | undefined;
  itemsPurchasedAt: string | null | undefined;
  pinpoints?: ErrandPinpoint[] | null;
  riderLocation?: MapCoordinate | null;
  destination?: MapCoordinate | null;
}

export interface ErrandProgressStage {
  index: number;
  label: string;
  subLabel?: string;
}

// Derives the customer-facing 5-stage progress timeline. Only "Delivered" is
// gated by the authoritative server status (never inferred from proximity, to
// avoid showing a false "Delivered" before the rider actually confirms it);
// the other stages are inferred from the two live signals the customer app
// already has (rider's live Firebase location, and itemsPurchasedAt) — see
// the plan's rationale for why "Items Purchased" and "In route to you" are
// treated as effectively simultaneous (no separate persisted signal splits
// them further).
export function getErrandProgressStage(input: ErrandProgressInput): ErrandProgressStage {
  const { status, itemsPurchasedAt, pinpoints, riderLocation, destination } = input;
  const normalizedStatus = String(status || '').toUpperCase();

  if (normalizedStatus === 'DELIVERED' || normalizedStatus === 'COMPLETED') {
    return { index: 4, label: ERRAND_PROGRESS_LABELS[4] };
  }

  if (itemsPurchasedAt) {
    let subLabel: string | undefined;
    if (riderLocation && destination) {
      const km = haversineDistanceKm(riderLocation, destination);
      if (km <= NEARBY_THRESHOLD_KM) {
        subLabel = 'Rider is nearby!';
      }
    }
    return { index: 3, label: ERRAND_PROGRESS_LABELS[3], subLabel };
  }

  if (riderLocation) {
    let subLabel: string | undefined;
    // Rank only stops still to be made. Naming the nearest stop outright reads
    // as "500 m from Jollibee" about a store the rider already finished — which
    // is true and useless, and looks like the tracker is stuck. Filtering here
    // rather than at each call site so every screen showing this stage agrees.
    const remaining = (pinpoints ?? []).filter((pin) => !pin.departedAt && !pin.arrivedAt);
    const nearest = remaining.length > 0 ? nearestPoint(riderLocation, remaining) : null;
    if (nearest) {
      const km = haversineDistanceKm(riderLocation, nearest);
      const distanceText = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
      subLabel = `${distanceText} from ${nearest.storeName || 'store'}`;
    }
    return { index: 1, label: ERRAND_PROGRESS_LABELS[1], subLabel };
  }

  return { index: 0, label: ERRAND_PROGRESS_LABELS[0] };
}
