/**
 * Shared duration/distance formatting for the tracking surfaces.
 *
 * These were previously copy-pasted verbatim into LiveTrackingMap.tsx and
 * ErrandTrackCard.tsx (and again in the rider app), so a change to how a
 * duration reads had to be made in several places to stay consistent.
 */

/** "45 min", "1 hr 20 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

/** "1.2 km", "450 m". */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/**
 * Money, with centavos only when there are any.
 *
 * The delivery fare is charged in whole pesos, so "₱205.00" spends two
 * characters saying nothing. Item money is not whole — a receipt reads
 * ₱994.50 — so this cannot simply drop the decimals; it drops them only when
 * they are zero.
 *
 * Grouping is done by hand rather than through Intl, whose availability differs
 * between Hermes builds and the web bundle. The same function has to give the
 * same answer on all three clients or a customer, a dispatcher and a rider will
 * read different totals for one errand.
 */
export function formatPeso(value: number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₱0";

  const rounded = Math.round(amount * 100) / 100;
  const sign = rounded < 0 ? "-" : "";
  const magnitude = Math.abs(rounded);

  const text = Number.isInteger(magnitude) ? String(magnitude) : magnitude.toFixed(2);
  const [whole, centavos] = text.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${sign}₱${grouped}${centavos ? `.${centavos}` : ""}`;
}
