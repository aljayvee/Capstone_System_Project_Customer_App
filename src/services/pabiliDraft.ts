import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type NativeEventSubscription } from 'react-native';
import { parseItemEntry, splitPastedLines, type ParseReason } from '../utils/itemEntryParser';

/**
 * The pabili shopping list while it is being written.
 *
 * Three screens edit it (the store hub, one store's editor, the review), so it
 * lives here rather than in any one of them, and it is kept on the phone: a
 * customer who backs out, takes a call or loses the app to the OS comes back to
 * the list they wrote. The old single screen held it in component state, so any
 * of those threw it away.
 *
 * The operations are plain functions of a draft, so they are tested without
 * React; pabiliDraftStore holds the current one and saves it.
 */

export interface DraftItem {
  name: string;
  quantity: number;
  size: string | null;
  /** What to tell the rider about this one item ("paki pili yung walang bulok"). */
  notes: string | null;
}

export type TidyState =
  /** The model read the line, and its reading replaced it. */
  | 'applied'
  /** The model could not be asked (off, slow, quota). Sent as typed. */
  | 'unread'
  /** Asked, and the model left it as typed. Never asked again. */
  | 'kept';

/**
 * Whether an item fits the store it is listed under, per the server's item
 * model. A mismatch names the store that usually sells it, so the editor can
 * offer to move it or ask "Are you sure?".
 */
export type StoreCheck =
  | { status: 'fits' }
  | { status: 'mismatch'; usualStore: string }
  /** The customer was asked and kept it here. Never asked again. */
  | { status: 'kept' };

export interface DraftRow extends DraftItem {
  id: string;
  source: 'typed' | 'chip' | 'ai';
  /** Present when the rules left the line raw for the server to read. */
  review?: { reasons: ParseReason[]; tidy?: TidyState };
  /** Set on the extra rows the model split out of one line. */
  splitFrom?: string;
  storeCheck?: StoreCheck;
  /**
   * A store's name the rules took out of the typed line ("Rose Pharmacy
   * Lozartan 5mg"). Set until the customer has seen the warning about it.
   */
  removedStore?: string;
}

/**
 * A real store the customer picked in step 1's "Location" list, instead of a
 * merchant category. It reaches the dispatcher already pinned.
 */
export interface PickedStore {
  /** The store's key in `categories` and `rowsByCategory`: its name, made unique. */
  key: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** The owner's Location Stores row, when the pick came from there. */
  placeId: string | null;
  categoryId: number | null;
  /** What kind of shop it is, as the server worked it out. Null when it could not. */
  categoryName: string | null;
}

export interface PabiliDraft {
  version: 1;
  /**
   * The stores, in order: merchant category names, or in "location" mode the
   * keys of `stores`. Each is also a key of `rowsByCategory`.
   */
  categories: string[];
  /** Absent on drafts saved before 2026-10-08, which are all "merchant". */
  mode?: 'merchant' | 'location';
  /** The picked stores by key, in "location" mode only. */
  stores?: Record<string, PickedStore>;
  rowsByCategory: Record<string, DraftRow[]>;
  /** What is typed in each store's box but not yet added. Saved, so it survives too. */
  composeByCategory: Record<string, { text: string; quantity: number }>;
  updatedAt: number;
  /** Set as Send starts; a draft found with it set may already be an errand. */
  submitStartedAt?: number | null;
}

export interface TidyResult {
  id: string;
  /** A server from before notes sends items without one. */
  items: Array<Omit<DraftItem, 'notes'> & { notes?: string | null }>;
  confident: boolean;
}

export const MAX_TIDY_LINES = 20;
export const MAX_STORE_CHECK_LINES = 20;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = '@sugo_pabili_draft:v1:';

let idCounter = 0;
const makeId = () => `row-${Date.now()}-${idCounter++}`;

const sameItem = (a: DraftItem, b: DraftItem) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
  (a.size ?? '').trim().toLowerCase() === (b.size ?? '').trim().toLowerCase() &&
  (a.notes ?? '').trim().toLowerCase() === (b.notes ?? '').trim().toLowerCase();

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * "bigas" -> "Bigas", so the list reads like a list. Only the first letter,
 * and only when the first word is all lower case: "iPhone charger" and "7 Up"
 * are written that way on purpose.
 */
export function capitalizeItemName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  const firstWord = trimmed.split(' ')[0] ?? '';
  if (!/^[a-z]/.test(firstWord) || firstWord !== firstWord.toLowerCase()) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function emptyDraft(categories: string[]): PabiliDraft {
  return {
    version: 1,
    categories,
    rowsByCategory: Object.fromEntries(categories.map((c) => [c, []])),
    composeByCategory: {},
    updatedAt: Date.now(),
    submitStartedAt: null,
  };
}

export function sameCategories(a: string[], b: string[]): boolean {
  const norm = (list: string[]) => [...list].map((c) => c.trim().toLowerCase()).sort().join('|');
  return norm(a) === norm(b);
}

/** The stores of `draft` the new choice leaves out that still have items on them. */
export function droppedStoresWithItems(draft: PabiliDraft, categories: string[]): string[] {
  return draft.categories.filter(
    (cat) => !categories.some((c) => sameName(c, cat)) && (draft.rowsByCategory[cat] ?? []).length > 0
  );
}

/**
 * The saved list re-pointed at a new choice of stores.
 *
 * Going back to step 1 to add a store used to offer "keep the old list" (the
 * new store never appeared) or "start a new list" (everything typed was
 * lost). Now the items of every store still chosen are kept and a newly
 * chosen store starts empty. A store left out of `categories` loses its items,
 * so the caller leaves one out only on the customer's say-so.
 */
export function withCategories(draft: PabiliDraft, categories: string[]): PabiliDraft {
  const keyFor = (cat: string) => draft.categories.find((c) => sameName(c, cat)) ?? cat;
  return {
    ...draft,
    categories,
    mode: 'merchant',
    stores: undefined,
    rowsByCategory: Object.fromEntries(categories.map((c) => [c, draft.rowsByCategory[keyFor(c)] ?? []])),
    composeByCategory: Object.fromEntries(
      categories
        .map((c) => [c, draft.composeByCategory[keyFor(c)]] as const)
        .filter(([, compose]) => Boolean(compose))
    ),
  };
}

/** The same re-pointing for real stores picked in step 1's "Location" list. */
export function withStores(draft: PabiliDraft, picked: PickedStore[]): PabiliDraft {
  return {
    ...withCategories(draft, picked.map((s) => s.key)),
    mode: 'location',
    stores: Object.fromEntries(picked.map((s) => [s.key, s])),
  };
}

/**
 * Keys for stores about to be picked: the name, and "Mercury Drug (2)" for a
 * second branch of the same name, so each has its own list.
 */
export function storeKeysFor(names: string[]): string[] {
  const taken: string[] = [];
  return names.map((raw) => {
    const name = raw.trim() || 'Store';
    let key = name;
    for (let n = 2; taken.some((k) => sameName(k, key)); n++) key = `${name} (${n})`;
    taken.push(key);
    return key;
  });
}

/**
 * Real stores as the draft keeps them, each keyed by its name made unique.
 * Step 1's Location list and Home's "Stores near you" both start an order this way.
 */
export function toPickedStores(stores: Array<Omit<PickedStore, 'key'>>): PickedStore[] {
  const keys = storeKeysFor(stores.map((s) => s.name));
  return stores.map((s, i) => ({
    key: keys[i],
    name: s.name,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    placeId: s.placeId,
    categoryId: s.categoryId,
    categoryName: s.categoryName,
  }));
}

/** What kind of shop a store of the draft is: its category, or the key itself in merchant mode. */
export function storeCategoryOf(draft: PabiliDraft | null | undefined, key: string): string {
  return draft?.stores?.[key]?.categoryName ?? key;
}

/** The store of the draft that is this kind of shop, or null. */
export function storeKeyForCategory(draft: PabiliDraft, categoryName: string): string | null {
  return draft.categories.find((key) => sameName(storeCategoryOf(draft, key), categoryName)) ?? null;
}

function withRows(draft: PabiliDraft, category: string, rows: DraftRow[]): PabiliDraft {
  return { ...draft, rowsByCategory: { ...draft.rowsByCategory, [category]: rows } };
}

/**
 * Adds a row, or adds to the quantity of the same item already listed.
 *
 * "Same" is name AND size: two "Coke" lines, one 1.5 L and one 330 mL, are two
 * things to buy. A row waiting for the model never merges, because what it
 * really is has not been read yet.
 */
function addOrMerge(rows: DraftRow[], row: DraftRow): DraftRow[] {
  if (!row.review) {
    const at = rows.findIndex((r) => !r.review && sameItem(r, row));
    if (at !== -1) {
      const merged = [...rows];
      merged[at] = {
        ...merged[at],
        quantity: Math.min(99, merged[at].quantity + row.quantity),
        // The warning about a store's name still owed for the line just typed.
        ...(row.removedStore ? { removedStore: row.removedStore } : {}),
      };
      return merged;
    }
  }
  return [...rows, row];
}

/** What the customer typed (one line, or a pasted list), read by the rules. */
export function addTypedLines(draft: PabiliDraft, category: string, text: string, stepperQty: number): PabiliDraft {
  const lines = splitPastedLines(text);
  if (lines.length === 0) return draft;
  // The stepper sat beside one line. For a pasted list it says nothing per line.
  const stepper = lines.length > 1 ? 1 : Math.max(1, stepperQty);

  let rows = draft.rowsByCategory[category] ?? [];
  for (const line of lines) {
    const parsed = parseItemEntry(line, { stepperQty: stepper });
    rows = addOrMerge(
      rows,
      parsed.needsReview
        ? {
            id: makeId(),
            name: capitalizeItemName(parsed.name),
            quantity: stepper,
            size: null,
            notes: null,
            source: 'typed',
            review: { reasons: parsed.reasons },
            ...(parsed.store ? { removedStore: parsed.store } : {}),
          }
        : {
            id: makeId(),
            name: capitalizeItemName(parsed.name),
            quantity: parsed.quantity ?? stepper,
            size: parsed.size,
            notes: null,
            source: 'typed',
            ...(parsed.store ? { removedStore: parsed.store } : {}),
          }
    );
  }

  return {
    ...withRows(draft, category, rows),
    composeByCategory: { ...draft.composeByCategory, [category]: { text: '', quantity: 1 } },
  };
}

/** A quick-add chip. Already clean and already in the right store, so neither check runs. */
export function addChip(draft: PabiliDraft, category: string, chip: { name: string; size?: string | null }): PabiliDraft {
  const rows = addOrMerge(draft.rowsByCategory[category] ?? [], {
    id: makeId(),
    name: capitalizeItemName(chip.name),
    size: chip.size ?? null,
    notes: null,
    quantity: 1,
    source: 'chip',
    storeCheck: { status: 'fits' },
  });
  return withRows(draft, category, rows);
}

export function setCompose(
  draft: PabiliDraft,
  category: string,
  patch: Partial<{ text: string; quantity: number }>
): PabiliDraft {
  const current = draft.composeByCategory[category] ?? { text: '', quantity: 1 };
  const next = { ...current, ...patch };
  next.quantity = Math.max(1, Math.min(99, Math.round(next.quantity || 1)));
  return { ...draft, composeByCategory: { ...draft.composeByCategory, [category]: next } };
}

/** Quantity on a listed row. Zero removes it, which is what "minus" on the last one means. */
export function adjustQuantity(draft: PabiliDraft, category: string, id: string, delta: number): PabiliDraft {
  const rows = (draft.rowsByCategory[category] ?? [])
    .map((r) => (r.id === id ? { ...r, quantity: Math.min(99, r.quantity + delta) } : r))
    .filter((r) => r.quantity > 0);
  return withRows(draft, category, rows);
}

export function removeRow(draft: PabiliDraft, category: string, id: string): PabiliDraft {
  return withRows(
    draft,
    category,
    (draft.rowsByCategory[category] ?? []).filter((r) => r.id !== id && r.splitFrom !== id)
  );
}

/** The customer edited the name and size by hand: nothing left to tidy, and its store is asked about again. */
export function editRow(
  draft: PabiliDraft,
  category: string,
  id: string,
  item: { name: string; size: string | null; notes?: string | null }
): PabiliDraft {
  const name = capitalizeItemName(item.name);
  if (!name) return draft;
  const size = item.size?.replace(/\s+/g, ' ').trim() || null;
  const notes = item.notes?.replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  return withRows(
    draft,
    category,
    (draft.rowsByCategory[category] ?? []).map((r) =>
      r.id === id ? { id: r.id, name, size, notes, quantity: r.quantity, source: 'typed' as const } : r
    )
  );
}

export interface LocatedRow {
  category: string;
  row: DraftRow;
}

export function allRows(draft: PabiliDraft): LocatedRow[] {
  return draft.categories.flatMap((category) =>
    (draft.rowsByCategory[category] ?? []).map((row) => ({ category, row }))
  );
}

/**
 * Lines the rules left for the model and nobody has read yet: never asked,
 * or asked when no model could answer ('unread'), which a later visit to
 * Review asks again. One batch at most.
 */
export function rowsAwaitingTidy(draft: PabiliDraft): LocatedRow[] {
  return allRows(draft)
    .filter(({ row }) => row.review && (!row.review.tidy || row.review.tidy === 'unread'))
    .slice(0, MAX_TIDY_LINES);
}

export function totalUnits(draft: PabiliDraft): number {
  return allRows(draft).reduce((sum, { row }) => sum + row.quantity, 0);
}

function mapRow(draft: PabiliDraft, id: string, fn: (rows: DraftRow[], row: DraftRow) => DraftRow[]): PabiliDraft {
  for (const category of draft.categories) {
    const rows = draft.rowsByCategory[category] ?? [];
    const row = rows.find((r) => r.id === id);
    if (row) return withRows(draft, category, fn(rows, row));
  }
  return draft;
}

/**
 * The model's readings of the rows that were asked about, applied as they
 * come: "chicken 2, rice 5kg" becomes two rows. Nothing asks the customer;
 * the server already threw away any reading that dropped or invented a word.
 * A row the model could not be asked about goes out as typed.
 */
export function applyTidy(draft: PabiliDraft, askedIds: string[], available: boolean, results: TidyResult[]): PabiliDraft {
  const byId = new Map(results.map((r) => [r.id, r]));
  let next = draft;
  for (const id of askedIds) {
    const result = byId.get(id);
    next = mapRow(next, id, (rows, row) => {
      if (!row.review || (row.review.tidy && row.review.tidy !== 'unread')) return rows;
      if (!available || !result || result.items.length === 0) {
        const tidy: TidyState = available ? 'kept' : 'unread';
        return rows.map((r) => (r.id === id ? { ...r, review: { ...row.review!, tidy } } : r));
      }
      const [first, ...extra] = result.items;
      const rewritten: DraftRow = {
        id: row.id,
        name: capitalizeItemName(first.name),
        quantity: first.quantity,
        size: first.size,
        notes: first.notes ?? null,
        source: 'ai',
        review: { reasons: row.review.reasons, tidy: 'applied' },
        ...(row.removedStore ? { removedStore: row.removedStore } : {}),
      };
      const split: DraftRow[] = extra.map((item) => ({
        id: makeId(),
        name: capitalizeItemName(item.name),
        quantity: item.quantity,
        size: item.size,
        notes: item.notes ?? null,
        source: 'ai',
        splitFrom: row.id,
      }));
      const at = rows.findIndex((r) => r.id === id);
      return [...rows.slice(0, at), rewritten, ...split, ...rows.slice(at + 1)];
    });
  }
  return next;
}

/**
 * Rows of one store whose store nobody has asked about: typed by the customer
 * and already readable. A raw line still waiting for the model ("chicken 2,
 * rice 5kg") is left until it has been read, since it may be two items.
 */
export function rowsAwaitingStoreCheck(draft: PabiliDraft, category: string): DraftRow[] {
  return (draft.rowsByCategory[category] ?? [])
    .filter((r) => !r.storeCheck && !(r.review && !r.review.tidy))
    .slice(0, MAX_STORE_CHECK_LINES);
}

/**
 * The server's answers, each for the name it was asked about. A row renamed
 * while the question was out keeps waiting, so a verdict on "Biogesic" never
 * lands on the "Bread" it was edited into.
 */
export function applyStoreChecks(
  draft: PabiliDraft,
  category: string,
  checks: Array<{ id: string; name: string; check: StoreCheck }>
): PabiliDraft {
  const byId = new Map(checks.map((c) => [c.id, c]));
  return withRows(
    draft,
    category,
    (draft.rowsByCategory[category] ?? []).map((r) => {
      const answer = byId.get(r.id);
      return answer && !r.storeCheck && sameName(answer.name, r.name) ? { ...r, storeCheck: answer.check } : r;
    })
  );
}

/** "Yes, it's from here." */
export function keepInStore(draft: PabiliDraft, category: string, id: string): PabiliDraft {
  return withRows(
    draft,
    category,
    (draft.rowsByCategory[category] ?? []).map((r) => (r.id === id ? { ...r, storeCheck: { status: 'kept' as const } } : r))
  );
}

/** "OK": the customer has read that a store's name was taken out of this item. */
export function dismissRemovedStore(draft: PabiliDraft, category: string, id: string): PabiliDraft {
  return withRows(
    draft,
    category,
    (draft.rowsByCategory[category] ?? []).map((r) => {
      if (r.id !== id) return r;
      const { removedStore: _seen, ...rest } = r;
      return rest;
    })
  );
}

/**
 * "Ask for Rose Pharmacy": the store the customer named reaches the dispatcher
 * and the rider as a request in the item's note, never in its name.
 */
export function noteRemovedStore(draft: PabiliDraft, category: string, id: string): PabiliDraft {
  return withRows(
    draft,
    category,
    (draft.rowsByCategory[category] ?? []).map((r) => {
      if (r.id !== id || !r.removedStore) return r;
      const { removedStore, ...rest } = r;
      const ask = `Buy at ${removedStore} if possible`;
      return { ...rest, notes: (r.notes ? `${r.notes}. ${ask}` : ask).slice(0, 200) };
    })
  );
}

/** "Move it to the pharmacy": the row leaves this store and joins (or merges into) the other. */
export function moveRow(draft: PabiliDraft, from: string, to: string, id: string): PabiliDraft {
  const row = (draft.rowsByCategory[from] ?? []).find((r) => r.id === id);
  const target = draft.categories.find((c) => sameName(c, to));
  if (!row || !target || sameName(from, target)) return draft;
  const moved = withRows(draft, from, (draft.rowsByCategory[from] ?? []).filter((r) => r.id !== id));
  return withRows(moved, target, addOrMerge(moved.rowsByCategory[target] ?? [], { ...row, storeCheck: { status: 'fits' } }));
}

// ── on the phone ─────────────────────────────────────────────────────────

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

export async function readStoredDraft(userId: string, now: number = Date.now()): Promise<PabiliDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PabiliDraft;
    if (parsed?.version !== 1 || !Array.isArray(parsed.categories) || typeof parsed.rowsByCategory !== 'object') {
      return null;
    }
    if (now - Number(parsed.updatedAt || 0) > DRAFT_TTL_MS) {
      await AsyncStorage.removeItem(storageKey(userId));
      return null;
    }
    return parsed;
  } catch {
    // A list we cannot read is one we cannot restore; start clean rather than crash.
    return null;
  }
}

export async function writeStoredDraft(userId: string, draft: PabiliDraft | null): Promise<void> {
  try {
    if (!draft) await AsyncStorage.removeItem(storageKey(userId));
    else await AsyncStorage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch {
    // The list still works in memory; only surviving a restart is lost.
  }
}

/**
 * The current draft, shared by the three screens and saved as it changes.
 *
 * A plain store read through useSyncExternalStore (usePabiliDraft) rather than
 * a context: it needs no provider mounted in AppNavigator, and a screen reads
 * the latest list even from inside a navigation event handler.
 */
class PabiliDraftStore {
  private draft: PabiliDraft | null = null;
  private userId: string | null = null;
  private listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: NativeEventSubscription | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.draft;

  /** Whose list is in memory: another account's must never be shown. */
  get ownerId() {
    return this.userId;
  }

  /** Makes `draft` the current list for `userId`. */
  begin(userId: string, draft: PabiliDraft) {
    this.userId = userId;
    this.draft = draft;
    this.watchAppState();
    this.emit();
    this.scheduleSave();
  }

  update(fn: (draft: PabiliDraft) => PabiliDraft) {
    if (!this.draft) return;
    const next = fn(this.draft);
    if (next === this.draft) return;
    this.draft = { ...next, updatedAt: Date.now() };
    this.emit();
    this.scheduleSave();
  }

  /** Forgets the list, here and on the phone. */
  async clear() {
    const userId = this.userId;
    this.draft = null;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.emit();
    if (userId) await writeStoredDraft(userId, null);
  }

  async flush() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.userId && this.draft) await writeStoredDraft(this.userId, this.draft);
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 300);
  }

  private watchAppState() {
    if (this.appStateSub) return;
    // Backgrounded is the last moment we are sure to run; save then, not 300 ms later.
    this.appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void this.flush();
    });
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const pabiliDraftStore = new PabiliDraftStore();
