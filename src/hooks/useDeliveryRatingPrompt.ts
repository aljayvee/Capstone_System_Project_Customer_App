import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { formatErrandId } from '../utils/formatErrandId';

/**
 * The "How was your errand?" prompt, on the Track tab (2026-11-06).
 *
 * It used to live in CustomerChatScreen, which opened it whenever the chat of a
 * delivered, unrated errand was opened. The Track tab, where the customer
 * actually watches the delivery finish, never showed it: its list drops an
 * errand the moment it is DELIVERED, so the customer saw "All Caught Up!" and
 * no prompt, then met the prompt later in the wrong place, the dispatcher chat.
 *
 * Rules:
 * - Only an errand the server will accept a rating for: DELIVERED or
 *   COMPLETED, with a rider (ratingService.submitRating).
 * - Only a recent one. The transaction list carries no deliveredAt, so
 *   "recent" is placed within the last day. Without a bound, an account with
 *   months of unrated history would be walked through all of it.
 * - Newest first, one at a time, each offered at most once per app run.
 *   "Skip for now" means exactly that: the next run offers it again while it is
 *   still recent. A skip also ends prompting for the rest of this visit, so two
 *   errands delivered together do not nag twice in a row; a submitted rating
 *   moves straight on to the other one.
 * - The server is asked before anything is shown, so a rating left on another
 *   phone is respected. A failed check shows nothing and is asked again on the
 *   next visit.
 * - `enabled` false (another screen or dialog in front) hides a sheet already
 *   showing. The sheet is a Modal, a window above every screen: left visible,
 *   it would float over the chat a push tap just opened.
 */

export const RATING_PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

const RATEABLE_STATUSES = ['DELIVERED', 'COMPLETED'];

// Per app run, outside the hook: the Track tab unmounts on every tab switch,
// and a ref would forget a skip each time the customer came back to it.
const settledErrandIds = new Set<string>(); // rated, as far as this phone knows
const offeredErrandIds = new Set<string>(); // already shown this run

/** Test seam: the app run starts over. */
export function resetDeliveryRatingPromptMemory(): void {
  settledErrandIds.clear();
  offeredErrandIds.clear();
}

export interface DeliveryRatingCandidate {
  errandId: string;
  summary: string;
}

function createdAtMs(errand: any): number {
  const ms = Date.parse(String(errand?.createdAt ?? ''));
  return Number.isFinite(ms) ? ms : NaN;
}

/** The errands that may be offered, newest first. Exported for tests. */
export function deliveryRatingCandidates(errands: any[] | null | undefined, now = Date.now()): DeliveryRatingCandidate[] {
  if (!Array.isArray(errands)) return [];
  return errands
    .filter((e) => {
      if (!e || e.id == null || e.riderId == null) return false;
      if (!RATEABLE_STATUSES.includes(String(e.status ?? '').toUpperCase())) return false;
      const placed = createdAtMs(e);
      // A phone clock running behind the server puts a fresh errand in the
      // future; that is still recent.
      return Number.isFinite(placed) && now - placed <= RATING_PROMPT_WINDOW_MS;
    })
    .sort((a, b) => createdAtMs(b) - createdAtMs(a))
    .map((e) => {
      const stores = (Array.isArray(e.pinpoints) ? e.pinpoints : [])
        .map((p: any) => p?.storeName)
        .filter(Boolean)
        .join(' & ');
      const reference = formatErrandId(e.orderId ?? e.id, e.referenceNo);
      const label = stores || e.categories || 'Your delivery';
      return {
        errandId: String(e.id),
        summary: reference ? `${label} · #${reference}` : String(label),
      };
    });
}

export type DeliveryRatingOutcome = 'rated' | 'skipped';

export function useDeliveryRatingPrompt(errands: any[] | null | undefined, enabled: boolean) {
  // The errand on the sheet. Kept after the sheet closes, so the sheet stays
  // mounted and slides out instead of vanishing; `open` says whether it is up.
  const [sheet, setSheet] = useState<{ candidate: DeliveryRatingCandidate; open: boolean } | null>(null);
  const isOpen = Boolean(sheet?.open);
  // Set by a skip, cleared when the customer leaves and comes back.
  const [pausedForVisit, setPausedForVisit] = useState(false);
  // Bumped when a module-level set changes, so the next candidate is computed.
  const [memoryVersion, setMemoryVersion] = useState(0);

  useEffect(() => {
    if (!enabled) setPausedForVisit(false);
  }, [enabled]);

  const next = useMemo(
    () =>
      deliveryRatingCandidates(errands).find(
        (c) => !settledErrandIds.has(c.errandId) && !offeredErrandIds.has(c.errandId)
      ) ?? null,
    // memoryVersion stands in for the module-level sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [errands, memoryVersion]
  );
  const nextId = next?.errandId ?? null;

  useEffect(() => {
    if (!enabled || isOpen || pausedForVisit || !next) return;
    let cancelled = false;
    apiClient
      .get(`/errands/${next.errandId}/rating`)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.data) {
          settledErrandIds.add(next.errandId);
          setMemoryVersion((v) => v + 1);
          return;
        }
        offeredErrandIds.add(next.errandId);
        setSheet({ candidate: next, open: true });
      })
      .catch(() => {
        // Unknown is not "unrated": show nothing, ask again next visit.
      });
    return () => {
      cancelled = true;
    };
    // Keyed by id: a list refresh that rebuilds the same candidate must not
    // re-ask the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isOpen, pausedForVisit, nextId]);

  const sheetErrandId = sheet?.candidate.errandId ?? null;
  const finish = useCallback(
    (outcome: DeliveryRatingOutcome) => {
      if (sheetErrandId && outcome === 'rated') settledErrandIds.add(sheetErrandId);
      if (outcome === 'skipped') setPausedForVisit(true);
      setSheet((s) => (s ? { ...s, open: false } : s));
      setMemoryVersion((v) => v + 1);
    },
    [sheetErrandId]
  );

  return {
    errandId: sheetErrandId,
    summary: sheet?.candidate.summary ?? null,
    visible: isOpen && enabled,
    finish,
  };
}
