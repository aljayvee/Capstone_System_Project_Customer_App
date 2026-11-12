/**
 * Which of a customer's errands are still under way, and what each is
 * estimated to cost: Home's active errands button and the Active Errands
 * screen (2026-10-10) read both from here.
 */

/** Waiting for a rider, or being run. Delivered, completed and cancelled errands are done. */
export const ACTIVE_ERRAND_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];

export function isActiveErrand(errand: { status?: unknown } | null | undefined): boolean {
  return ACTIVE_ERRAND_STATUSES.includes(String(errand?.status ?? '').toUpperCase());
}

/**
 * The estimated fee: the errand's own total once there is one, else its
 * estimate, else the base fee every errand starts from (useRateConfig). Zero
 * counts as "not priced yet", as it did on Home's old card.
 */
export function estimatedFeeOf(
  errand: { grandTotal?: unknown; totalCost?: unknown; estimatedCost?: unknown } | null | undefined,
  baseFee: number
): number {
  for (const value of [errand?.grandTotal, errand?.totalCost, errand?.estimatedCost]) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return baseFee;
}

/** "₱1,234.50". */
export function pesos(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
