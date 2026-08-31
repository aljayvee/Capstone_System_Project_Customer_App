/**
 * Errand ETA presentation.
 *
 * An errand ETA is a range, not a number. A pabili is mostly time the rider
 * spends inside a store — hunting items down an aisle, waiting at a counter,
 * queueing to pay — and that varies far more than the ride does. The server
 * models it per store type and returns a P50/P80 band (see etaStrategy.ts);
 * collapsing that back to a single figure here would re-introduce exactly the
 * false precision the band exists to avoid.
 */

export interface EtaWindow {
  lowMinutes: number;
  highMinutes: number;
}

export function toEtaWindow(
  etaLowAt: string | Date | null | undefined,
  etaHighAt: string | Date | null | undefined,
  now: number = Date.now()
): EtaWindow | null {
  if (!etaLowAt || !etaHighAt) return null;

  const low = new Date(etaLowAt).getTime();
  const high = new Date(etaHighAt).getTime();
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;

  // Never promise a time already past: an overdue errand shows "any moment now"
  // rather than counting into the negative.
  const lowMinutes = Math.max(0, Math.round((low - now) / 60000));
  const highMinutes = Math.max(lowMinutes, Math.round((high - now) / 60000));
  return { lowMinutes, highMinutes };
}

export function formatEtaWindow(window: EtaWindow | null): string | null {
  if (!window) return null;
  if (window.highMinutes === 0) return 'Any moment now';
  if (window.lowMinutes === window.highMinutes) return `~${window.highMinutes} min`;
  if (window.lowMinutes === 0) return `Under ${window.highMinutes} min`;
  return `${window.lowMinutes}–${window.highMinutes} min`;
}

/**
 * Plain-language reason the estimate is what it is. Shown alongside the range so
 * a long ETA reads as "there are two shops to visit", not as a delay.
 */
export function formatEtaBreakdown(
  travelSeconds: number | null | undefined,
  dwellLowSeconds: number | null | undefined,
  remainingStopCount: number | null | undefined
): string | null {
  if (travelSeconds == null || dwellLowSeconds == null) return null;
  if (!remainingStopCount || dwellLowSeconds <= 0) return null;

  const shopMinutes = Math.round(dwellLowSeconds / 60);
  const stopWord = remainingStopCount === 1 ? 'stop' : 'stops';
  return `includes about ${shopMinutes} min in ${remainingStopCount} ${stopWord}`;
}
