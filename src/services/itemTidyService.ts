import { apiClient } from './apiClient';
import type { DraftItem, TidyResult } from './pabiliDraft';

export interface TidyAnswer {
  available: boolean;
  results: TidyResult[];
}

// Above the server's own 10 s budget (CATEGORY_NORMALIZE_TIMEOUT_MS), so the
// server's "no answer" arrives rather than this giving up first. Gemini took
// 5.2 s for eight lines on production; Send never waits on this.
const TIDY_TIMEOUT_MS = 12000;

/**
 * Asks the server to read the lines the rules left alone ("isang kilong bigas",
 * "chicken 2, rice 5kg"). POST /errands/normalize-items.
 *
 * Never throws and never blocks anything: null means "not read", and the list
 * goes out as the customer typed it, which is how every order went before this
 * existed. `signal` lets Send abort a read still in flight.
 */
export async function tidyItemLines(
  lines: Array<{ id: string; text: string }>,
  signal?: AbortSignal
): Promise<TidyAnswer | null> {
  if (lines.length === 0) return { available: true, results: [] };
  try {
    const response = await apiClient.post(
      '/errands/normalize-items',
      { lines: lines.map(({ id, text }) => ({ id, text: text.slice(0, 120) })) },
      { timeout: TIDY_TIMEOUT_MS, signal }
    );
    const data = response.data ?? {};
    const results: TidyResult[] = Array.isArray(data.results)
      ? data.results.map((r: { id: string; items: DraftItem[]; confident: boolean }) => ({
          id: String(r.id),
          confident: Boolean(r.confident),
          items: (r.items ?? []).map((item) => ({
            name: String(item.name),
            quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
            size: item.size ? String(item.size) : null,
            // The instruction the line carried ("paki pili yung walang bulok").
            // A server from before notes sends none.
            notes: item.notes ? String(item.notes).slice(0, 200) : null,
          })),
        }))
      : [];
    return { available: Boolean(data.available), results };
  } catch {
    // Offline, rate-limited, aborted by Send, or an older server without the
    // route: all the same here.
    return null;
  }
}
