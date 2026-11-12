import { useEffect, useSyncExternalStore } from 'react';
import { apiClient } from './apiClient';

/**
 * How many stores one errand may visit: the first store plus the owner's
 * "Max Additional Stores Allowed" (Service Rates, GET /rate-config).
 *
 * This was a literal 3 in every picker and in the saved list, so raising the
 * setting changed nothing in the app (2026-10-25). The server enforces the same
 * figure on submit (server lib/storeLimit.ts), so a stale value here can only
 * cost the customer a refusal that names the real limit, never an overcharge.
 */

/** The server's column default (2 additional), used until the rate card loads. */
const DEFAULT_STORES_ALLOWED = 3;
/** The most the owner may set, plus the first store. */
const STORES_ALLOWED_CEILING = 6;
/** Rate cards change rarely; one read per screen visit is plenty. */
const REFRESH_AFTER_MS = 60_000;

let storesAllowed = DEFAULT_STORES_ALLOWED;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function storesAllowedFor(maxAdditionalStores: unknown): number {
  const extra = Number(maxAdditionalStores);
  if (!Number.isFinite(extra)) return DEFAULT_STORES_ALLOWED;
  return Math.min(Math.max(1 + Math.round(extra), 1), STORES_ALLOWED_CEILING);
}

export function getStoresAllowed(): number {
  return storesAllowed;
}

/** Fed by anything that has just read the rate card (useRateConfig too). */
export function setStoresAllowedFromRateConfig(config: { maxAdditionalStores?: unknown } | null | undefined): void {
  if (!config || config.maxAdditionalStores === undefined || config.maxAdditionalStores === null) return;
  fetchedAt = Date.now();
  const next = storesAllowedFor(config.maxAdditionalStores);
  if (next === storesAllowed) return;
  storesAllowed = next;
  listeners.forEach((listener) => listener());
}

/** Soft by design: a failed read keeps the last known limit. */
export function refreshStoreLimit(): Promise<void> {
  if (inFlight) return inFlight;
  if (Date.now() - fetchedAt < REFRESH_AFTER_MS) return Promise.resolve();
  inFlight = apiClient
    .get<{ maxAdditionalStores?: number }>('/rate-config')
    .then((res) => setStoresAllowedFromRateConfig(res?.data))
    .catch(() => undefined)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current limit, re-read from the rate card when a picker mounts. */
export function useStoresAllowed(): number {
  useEffect(() => {
    void refreshStoreLimit();
  }, []);
  return useSyncExternalStore(subscribe, getStoresAllowed, getStoresAllowed);
}

export function storeLimitMessage(allowed: number): string {
  return allowed === 1
    ? 'An errand can visit 1 store.'
    : `An errand can visit up to ${allowed} stores.`;
}

/** Tests only. */
export function resetStoreLimitForTests(): void {
  storesAllowed = DEFAULT_STORES_ALLOWED;
  fetchedAt = 0;
  inFlight = null;
}
