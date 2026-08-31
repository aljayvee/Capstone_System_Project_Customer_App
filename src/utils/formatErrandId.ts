/**
 * Cosmetic-only errand number for display. The real id (UUID) keeps flowing
 * through navigation params, Firebase chat paths, and API calls unchanged —
 * never pass this formatted value into any lookup/routing logic.
 */
export function formatErrandId(rawId: string | number | null | undefined): string {
  const raw = String(rawId ?? '').trim();
  if (!raw) return 'SGO-000000';
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, '');
  const tail = (alnum.slice(-6) || alnum).toUpperCase();
  return `SGO-${tail.padStart(6, '0')}`;
}
