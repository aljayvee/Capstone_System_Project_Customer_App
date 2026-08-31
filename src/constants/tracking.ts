/**
 * Freshness thresholds for a rider's live position.
 *
 * Deliberately identical to the web dashboard's src/constants/riderPresence.ts,
 * so a rider the dispatcher sees painted red as "signal lost" and a rider the
 * customer sees marked stale are always the same rider. Two surfaces disagreeing
 * about whether tracking is live is worse than either being wrong alone.
 */
export const LIVE_POSITION_MAX_AGE_MS = 15 * 1000;
export const SIGNAL_LOST_THRESHOLD_MS = 60 * 1000;

export type PositionFreshness = 'LIVE' | 'STALE' | 'LOST';

export function classifyFreshness(updatedAt: number, now: number = Date.now()): PositionFreshness {
  const age = now - updatedAt;
  if (age <= LIVE_POSITION_MAX_AGE_MS) return 'LIVE';
  if (age <= SIGNAL_LOST_THRESHOLD_MS) return 'STALE';
  return 'LOST';
}

/**
 * Customer-facing wording for a degraded connection.
 *
 * Phrased to inform rather than alarm: a rider losing signal in parts of
 * Tacurong is ordinary and is not a failure of the delivery. It must never read
 * like an error, and it must never be silently hidden behind a pin that looks
 * live.
 */
export function freshnessLabel(freshness: PositionFreshness, ageMs: number): string | null {
  if (freshness === 'LIVE') return null;
  const minutes = Math.floor(ageMs / 60000);
  const seconds = Math.floor(ageMs / 1000);
  if (freshness === 'STALE') {
    return `Updated ${seconds}s ago`;
  }
  return minutes >= 1
    ? `Weak signal in this area — last seen ${minutes} min ago`
    : `Weak signal in this area — last seen ${seconds}s ago`;
}
