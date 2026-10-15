/**
 * Who is handling an errand, and how it is paid, read from either shape the
 * API sends an errand in.
 *
 * The My Errands list comes from /customers/:id/transactions, which flattens
 * the rider to `riderName`, the payment to `paymentMethod`, and carries no
 * dispatcher at all. GET /errands/:id sends the relations instead: `rider`,
 * the latest `dispatchLogs[0]`, and `paymentSelection`. The details screen read
 * only the flat fields, so its first pull-to-refresh swapped in the second
 * shape and showed a rider already on the way as "Assigning" and a chosen
 * GCash payment as "Pending Selection" (2026-10-10).
 *
 * Each reader returns undefined when the payload cannot say, as opposed to
 * null when it says "nobody", so a screen can tell "not loaded yet" from
 * "not assigned".
 */

type PersonLike = { name?: unknown; firstName?: unknown; lastName?: unknown };

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function personName(person: unknown): string | null {
  if (!person || typeof person !== 'object') return null;
  const p = person as PersonLike;
  const named = text(p.name);
  if (named) return named;
  const joined = [text(p.firstName), text(p.lastName)].filter(Boolean).join(' ');
  return joined || null;
}

export function riderNameOf(errand: any): string | null | undefined {
  if (!errand || typeof errand !== 'object') return undefined;
  // The relation, where the payload has it, is the current answer: a rider who
  // declined leaves `rider: null`, which must win over a name copied earlier.
  if ('rider' in errand) return personName(errand.rider);
  if ('riderName' in errand) return text(errand.riderName);
  return undefined;
}

export function dispatcherNameOf(errand: any): string | null | undefined {
  if (!errand || typeof errand !== 'object') return undefined;
  // Newest first, one row (ERRAND_INCLUDE: dispatchedAt desc, take 1).
  if (Array.isArray(errand.dispatchLogs)) return personName(errand.dispatchLogs[0]?.dispatcher);
  if ('dispatcherName' in errand) return text(errand.dispatcherName);
  return undefined;
}

/** The mode the customer confirmed, else whatever flat method the payload had. */
export function paymentMethodOf(errand: any): string | null {
  if (!errand || typeof errand !== 'object') return null;
  return (
    text(errand.paymentSelection?.paymentMode?.name) ??
    text(errand.paymentMode?.name) ??
    text(errand.paymentMethod)
  );
}

/**
 * A freshly fetched errand laid over the copy already on screen.
 *
 * Fresh fields win. The flat fields only the list carries survive, and the
 * ones that would go stale (rider, dispatcher, payment, total) are re-read
 * from the merged result, so a refresh can add information but never lose it.
 */
export function mergeErrandDetails(current: any, fresh: any): any {
  if (!fresh || typeof fresh !== 'object') return current;
  const merged = { ...(current ?? {}), ...fresh };
  const riderName = riderNameOf(merged);
  const dispatcherName = dispatcherNameOf(merged);
  return {
    ...merged,
    ...(riderName !== undefined ? { riderName } : {}),
    ...(dispatcherName !== undefined ? { dispatcherName } : {}),
    paymentMethod: paymentMethodOf(merged),
    // The list's grandTotal is a copy of totalCost; a reprice since shows here.
    grandTotal: typeof fresh.totalCost === 'number' ? fresh.totalCost : merged.grandTotal,
  };
}

export type PersonnelLine = { name: string | null; waiting: string | null };

const FINISHED = ['DELIVERED', 'COMPLETED', 'CANCELLED'];

/**
 * The two "Assigned Personnel" lines. `name` when someone is assigned,
 * otherwise `waiting` says why not, in terms of where the errand is: AVAILABLE
 * has no dispatcher yet, PENDING has one choosing a rider. `checking` is
 * whether a fetch that could still answer is in flight.
 */
export function personnelLines(
  errand: any,
  checking = false
): { dispatcher: PersonnelLine; rider: PersonnelLine } {
  const status = String(errand?.status ?? '').toUpperCase();
  const dispatcherName = dispatcherNameOf(errand);
  const riderName = riderNameOf(errand);
  const finished = FINISHED.includes(status);
  const unknown = checking ? 'Checking...' : 'Pull down to load';

  const dispatcher: PersonnelLine = dispatcherName
    ? { name: dispatcherName, waiting: null }
    : {
        name: null,
        waiting:
          dispatcherName === undefined
            ? unknown
            : status === 'AVAILABLE'
            ? 'Finding a dispatcher...'
            : finished
            ? 'None assigned'
            : 'Not on record',
      };

  const rider: PersonnelLine = riderName
    ? { name: riderName, waiting: null }
    : {
        name: null,
        waiting:
          riderName === undefined
            ? unknown
            : finished
            ? 'None assigned'
            : status === 'AVAILABLE'
            ? 'Assigned after a dispatcher reviews your request'
            : 'Dispatcher assigning...',
      };

  return { dispatcher, rider };
}
