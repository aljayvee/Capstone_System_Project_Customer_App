/**
 * Reading what a customer typed into one shopping line.
 *
 * "5 Kilo of Chicken 2qty" is three facts: the thing (Chicken), how big one of
 * them is (5 kg) and how many (2). They used to arrive as one name with the
 * stepper on 1, so the rider read noise and the handling fee counted one unit.
 *
 * This settles only what it cannot get wrong: an explicit count ("2qty", "x2",
 * "qty 3"), list scaffolding ("1.", "-", "Item:") and a measured size at either
 * end of the line ("5 kilo of", "1.5L"). Anything it could misread is left
 * exactly as typed and flagged; the Review screen sends those lines to the
 * server's language model (POST /errands/normalize-items), which reads Filipino
 * counts, brand numbers and multi-item lines far better than rules can.
 *
 * The rule throughout: a confidently wrong cleanup is worse than none. A rider
 * buying "Up" because "7 Up" lost its 7 is a wrong purchase, not a tidier list,
 * so this never drops a word of the product's name.
 *
 * No lookbehind and no \p{...} escapes: Hermes builds differ in what they
 * support, and a regex that throws at load time takes the whole screen down.
 */

export type ParseReason =
  /** A bare number starts the name: "7 Up", "555 Sardines", "2 Coke". */
  | 'leading_number'
  /** A bare number ends the name: "Chicken 2". A count, or part of the name? */
  | 'trailing_number'
  /** A bare number inside the name: "Vitamin C 500 Tablets". */
  | 'middle_number'
  /** A count written as a word: "isang kilo", "dalawang", "half". */
  | 'number_word'
  /** "1/2 kilo", "½". */
  | 'fraction'
  /** A count of packs ("10pcs", "2 packs"), which may be a pack size or a count. */
  | 'pack_unit'
  /** Money to spend: "₱20 pandesal". */
  | 'amount'
  /** Several products on one line: "chicken 2, rice 5kg", "amlodipine tapos pandesal". */
  | 'multiple_items'
  /**
   * The line is a request, not a product: "pabili ng sibuyas po", "paki pili
   * yung walang bulok, salamat". The model drops the politeness and moves the
   * instruction into the item's note.
   */
  | 'conversational'
  /** A size inside the name: "Coke 1.5L Zero". */
  | 'size_in_middle'
  /** More than one size: "Rice 5kg 25kg". */
  | 'multiple_sizes'
  /** Two counts that disagree: "Coke x2" typed with the stepper on 3. */
  | 'conflicting_counts'
  /** A count over 99: "Tide x500" is more likely 500 g than 500 boxes. */
  | 'large_quantity';

export interface ParsedItem {
  /** The product, in the customer's words. The whole cleaned line when flagged. */
  name: string;
  /**
   * A store named in the line and taken out of it: "Rose Pharmacy Lozartan
   * 5mg" is Lozartan, 5 mg, and "Rose Pharmacy". The dispatcher picks the
   * store, so a store's name in an item only misleads the rider; the editor
   * tells the customer it was taken out.
   */
  store: string | null;
  /** The count the line stated, or null when it stated none (keep the stepper's). */
  quantity: number | null;
  /** "5 kg", "1.5 L", or null. */
  size: string | null;
  /** True when the line was left as typed for the server to read. */
  needsReview: boolean;
  reasons: ParseReason[];
}

/** Measures one of something can be: settled by the rules. */
export const UNIT_TABLE: ReadonlyArray<{ canonical: string; aliases: readonly string[] }> = [
  { canonical: 'kg', aliases: ['kilograms', 'kilogram', 'kilos', 'kilo', 'kgs', 'kls', 'kg', 'kl'] },
  { canonical: 'mg', aliases: ['milligrams', 'milligram', 'mg'] },
  { canonical: 'g', aliases: ['grams', 'gram', 'gms', 'gm', 'gr', 'g'] },
  { canonical: 'mL', aliases: ['milliliters', 'millilitres', 'milliliter', 'millilitre', 'mls', 'ml', 'cc'] },
  { canonical: 'L', aliases: ['liters', 'litres', 'liter', 'litre', 'ltr', 'lt', 'l'] },
  { canonical: 'lb', aliases: ['pounds', 'pound', 'lbs', 'lb'] },
  { canonical: 'oz', aliases: ['oz'] },
];

const CANONICAL_UNIT = new Map<string, string>();
for (const { canonical, aliases } of UNIT_TABLE) for (const alias of aliases) CANONICAL_UNIT.set(alias, canonical);

// Longest first, so "kilos" is tried before "kilo" and "kg" before "g".
const UNIT_ALTERNATION = [...CANONICAL_UNIT.keys()].sort((a, b) => b.length - a.length).join('|');
const NUMBER = '\\d+(?:[.,]\\d+)?';
// A number and a unit, the unit not running on into a longer word ("5 kilometres").
const MEASURE = `(${NUMBER})\\s*(${UNIT_ALTERNATION})(?![a-z])`;
const LEADING_SIZE = new RegExp(`^${MEASURE}(?:\\s+of)?\\s+(.+)$`, 'i');
const TRAILING_SIZE = new RegExp(`^(.+?)\\s+\\(?${MEASURE}\\)?$`, 'i');
const ANY_SIZE = new RegExp(MEASURE, 'gi');
const WHOLE_SIZE = new RegExp(`^\\(?${MEASURE}\\)?$`, 'i');

// Counts that say so: nothing else is read as one.
const COUNT_PATTERNS: RegExp[] = [
  /^(\d{1,3})\s*[x×]\s+/i, // "2x Safeguard", "2 x Safeguard"; not "2x4 lumber"
  /\s+(\d{1,3})\s*[x×]$/i, // "pancit canton 3x": the count typed into the name, stepper left on 1
  /\s*\(\s*[x×]\s*(\d{1,3})\s*\)$/i, // "(x2)"
  /\s+[x×]\s*(\d{1,3})$/i, // "Coke x2", "Coke × 2"
  /\s*\b(\d{1,3})\s*qty\b/i, // "2qty", "2 qty"
  /\s*\bqty[:.]?\s*(\d{1,3})\b/i, // "qty 3", "qty: 3"
  /\s*\bquantity[:.]?\s*(\d{1,3})\b/i,
];

/** One piece is the unit nobody needs told: "Siopao 5 pcs" is five siopao. */
const PIECES = '(?:pcs|pc|pieces|piece|piraso|pirasong|pirasos)';
const PIECES_AT_END = new RegExp(`\\s+\\(?(\\d{1,3})\\s*${PIECES}\\.?\\)?$`, 'i');
const PIECES_AT_START = new RegExp(`^(\\d{1,3})\\s*${PIECES}\\.?(?:\\s+of)?\\s+`, 'i');
/**
 * What may follow a comma and still be the same item: "Delight, 5pcs",
 * "Coke, 1.5L", "Safeguard, x2". Anything else after a comma is a list.
 */
const ONE_QUALIFIER = `(?:${MEASURE}|\\d{1,3}\\s*${PIECES}\\.?|[x×]\\s*\\d{1,3}|\\d{1,3}\\s*[x×]|\\d{1,3}\\s*qty|qty[:.]?\\s*\\d{1,3}|\\(\\s*[x×]\\s*\\d{1,3}\\s*\\))`;
const QUALIFIERS = new RegExp(`^${ONE_QUALIFIER}(?:\\s+${ONE_QUALIFIER})*$`, 'i');

// ── store names ──────────────────────────────────────────────────────────
//
// "Rose Pharmacy Lozartan 5mg": the customer named where to buy as well as
// what. Chains customers type by name, and only names that are a store and
// nothing else: "Goldilocks" polvoron and "Starbucks" bottled coffee are sold
// on supermarket shelves, so those words name a product as often as a shop.
const KNOWN_STORES = [
  // Drugstores.
  'mercury drug', 'rose pharmacy', 'south star drug', 'southstar drug', 'the generics pharmacy',
  'generics pharmacy', 'tgp', 'generika', 'st. joseph drug', 'st joseph drug', 'watsons',
  // Supermarkets, malls and convenience stores.
  'puregold', 'savemore', 'sm savemore', 'sm supermarket', 'sm hypermarket', 'robinsons supermarket',
  'gaisano', 'gaisano grand', 'kcc', 'kcc mall', 'nccc', 'citymall', 'unitop', 'alfamart',
  '7-eleven', '7 eleven', '7eleven', 'seven eleven', 'ministop', 'familymart', 'family mart', 'lawson',
  // Restaurants.
  'jollibee', "mcdonald's", 'mcdonalds', 'mcdo', 'chowking', 'mang inasal', 'greenwich', 'kfc',
  'red ribbon', "shakey's", 'shakeys', 'pizza hut', "max's", "andok's", 'bonchon', 'potato corner',
  'minute burger', "julie's bakeshop", 'julies bakeshop',
];
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Longest first, so "sm supermarket" is tried before "sm" could be, and
// "mcdonalds" before "mcdo".
const KNOWN_STORE = `(?:${[...KNOWN_STORES].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`;
/** Words that make a name a shop's: "Rose Pharmacy", "Royal Bakery". Not "store" alone: "App Store card". */
const STORE_NOUN =
  '(?:pharmacy|drug\\s?store|botika|botica|bake\\s?shop|bakery|panaderia|super\\s?market|hyper\\s?market|mini\\s?mart|grocery\\s+store|convenience\\s+store|sari-sari\\s+store)';
// A shop's own name: up to three words, the first starting with a letter, so
// a count ("2 Rose Pharmacy") is never taken for part of it.
const NAME_WORD = "[a-zñ][^\\s,:]*";
const AT = '(?:sa|from|at|in|galing\\s+sa|@)';
const STORE_PATTERNS: RegExp[] = [
  // "Rose Pharmacy Lozartan 5mg", "Mercury Drug: Biogesic", "Jollibee - spaghetti"
  new RegExp(`^(${KNOWN_STORE})(?:\\s*[:,-]\\s*|\\s+)(.+)$`, 'i'),
  new RegExp(`^(${NAME_WORD}(?:\\s+[^\\s,:]+){0,2}?\\s+${STORE_NOUN})(?:\\s*[:,-]\\s*|\\s+)(.+)$`, 'i'),
  // "Biogesic from Mercury Drug", "Lozartan 5mg sa Rose Pharmacy", "Siopao 7-Eleven"
  new RegExp(`^(.+?)(?:\\s*[,-]\\s*|\\s+)(?:${AT}\\s+)?(${KNOWN_STORE})\\.?$`, 'i'),
  new RegExp(`^(.+?)\\s+${AT}\\s+(${NAME_WORD}(?:\\s+[^\\s,:]+){0,2}?\\s+${STORE_NOUN})\\.?$`, 'i'),
  // With no "sa" or "from" to mark where the store starts, one word of name only.
  new RegExp(`^(.+?)\\s+(${NAME_WORD}\\s+${STORE_NOUN})\\.?$`, 'i'),
];

/**
 * A store named at either end of a line, and the line without it. The store
 * is only taken when something is left to buy: "Rose Pharmacy" alone stays.
 */
export function takeStoreName(text: string): { store: string | null; rest: string } {
  const whole = matchStore(text);
  if (whole) return whole;
  // A count or size outside the store's name stays with the item: "Biogesic
  // from Mercury Drug x2", "2 Rose Pharmacy Lozartan".
  const head = text.match(COUNT_HEAD)?.[0] ?? '';
  const tail = text.slice(head.length).match(COUNT_TAIL)?.[0] ?? '';
  if (!head && !tail) return { store: null, rest: text };
  const inner = matchStore(text.slice(head.length, text.length - tail.length));
  return inner ? { store: inner.store, rest: tidySpaces(`${head} ${inner.rest} ${tail}`) } : { store: null, rest: text };
}

const COUNT_HEAD = new RegExp(`^(?:\\d{1,3}\\s*[x×]?|${ONE_QUALIFIER})\\s+`, 'i');
const COUNT_TAIL = new RegExp(`(?:\\s+${ONE_QUALIFIER})+$`, 'i');

function matchStore(text: string): { store: string; rest: string } | null {
  for (let index = 0; index < STORE_PATTERNS.length; index++) {
    const match = text.match(STORE_PATTERNS[index]);
    if (!match) continue;
    // The first two patterns put the store first; the rest put it last.
    const [store, rest] = index < 2 ? [match[1], match[2]] : [match[2], match[1]];
    if (!/[a-zñ]/i.test(rest)) continue;
    return { store: tidySpaces(store), rest: tidySpaces(rest) };
  }
  return null;
}

/**
 * "Delight, 5pcs" -> "Delight 5pcs". A comma before nothing but a count or a
 * size joins it to the item; a comma before anything else lists another item.
 */
function joinQualifiers(text: string): string {
  let out = text;
  for (;;) {
    const at = out.lastIndexOf(',');
    if (at <= 0) return out;
    // "1,5kg" and "1,000" are numbers.
    if (/\d$/.test(out.slice(0, at)) && /^\d/.test(out.slice(at + 1))) return out;
    const after = out.slice(at + 1).trim();
    if (!QUALIFIERS.test(after)) return out;
    out = `${out.slice(0, at).trimEnd()} ${after}`;
  }
}

const LIST_MARKER = /^(?:[-•*·]|\d{1,2}[.)])\s+/;
const PREFIX_LABEL = /^(?:items?|order|pabili|bili)\s*[:-]\s*/i;
const NUMBER_WORDS =
  /\b(?:isa|isang|dalawa|dalawang|tatlo|tatlong|apat|lima|limang|anim|pito|pitong|walo|walong|siyam|sampu|sampung|kalahati|kalahating|dosena|dosenang|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten|uno|dos|tres|kwatro|singko|sais|siyete|otso|nuwebe|diyes|onse|dose|kinse|bente|beinte|trenta|kwarenta|singkwenta|sisenta|sitenta|otsenta|nobenta|siyento)\b/i;
/** Words that join two products. "and" and "&" are left out: "mac and cheese", "Head & Shoulders". */
const JOINING_WORDS = /\b(?:tapos|tsaka|saka|pati)\b/i;
/** Asking rather than naming: politeness, address and errand verbs. */
const CONVERSATIONAL = /\b(?:pabili|paki\w*|bumili|bilhan|po|opo|salamat|kuya|ate|please|pls+|thanks?)\b/i;
const FRACTION = /\d+\s*\/\s*\d+|[½¼¾⅓]/;
const PACK_COUNT =
  /\d+\s*(?:pcs|pc|pieces|piece|pks|pk|pck|packs|pack|boxes|box|doz|dozens|dozen|trays|tray|btls|btl|bottles|bottle|cans|can|sachets|sachet|reams|ream|rolls|roll|bundles|bundle)(?![a-z])/i;
const AMOUNT = /₱\s*\d|\bphp\s?\d|\bp\d|\bpesos?\b/i;
/** Digits alone: "7", "1.5". Not "70%", "2x4" or "500mg". */
const BARE_NUMBER = /^\d+(?:[.,]\d+)?$/;
const MAX_LINE = 120;

/** "chicken 2, rice 5kg": a comma not inside a number, a semicolon, or " + ". */
function listsSeveralItems(text: string): boolean {
  if (text.includes(';') || text.includes(' + ')) return true;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ',') continue;
    const before = text[i - 1] ?? '';
    const after = text[i + 1] ?? '';
    // "1,000" is a number; "2, rice" is a list.
    if (!(/\d/.test(before) && /\d/.test(after))) return true;
  }
  return false;
}

function formatSize(amount: string, unit: string): string {
  return `${amount.replace(',', '.')} ${CANONICAL_UNIT.get(unit.toLowerCase()) ?? unit}`;
}

function tidySpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Which bare numbers left in the name make it too risky to settle by rule.
 *
 * Called with the name's words after a stated count ("2qty", "x2") and an
 * end-of-line size ("1.5L") have been taken out, so whatever numbers remain
 * are ones the customer typed without saying what they mean.
 */
function bareNumberReasons(tokens: string[]): ParseReason[] {
  // Every one is flagged, wherever it sits. A number at the start is as often a
  // brand ("7 Up", "555") as a count ("2 Coke"), one at the end as often a
  // count ("Chicken 2") as a strength ("Vitamin C 500"), and one in the middle
  // could be either. Only the reader of the whole line can tell, so the line
  // goes to the model rather than to a guess. "70%" and "2x4" are not bare.
  const reasons: ParseReason[] = [];
  tokens.forEach((token, index) => {
    if (!BARE_NUMBER.test(token)) return;
    if (index === 0) reasons.push('leading_number');
    else if (index === tokens.length - 1) reasons.push('trailing_number');
    else reasons.push('middle_number');
  });
  return reasons;
}

/** Splits a pasted list into its lines. A newline is the one unambiguous separator. */
export function splitPastedLines(text: string): string[] {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * One line, as far as rules can safely read it.
 *
 * `stepperQty` is what the quantity stepper beside the field was on. A line
 * that also states a count is flagged when the two disagree, because the
 * customer said two different things and only they know which they meant.
 */
export function parseItemEntry(text: string, { stepperQty = 1 }: { stepperQty?: number } = {}): ParsedItem {
  const cleaned = tidySpaces(String(text ?? '').replace(/[​-‍﻿]/g, ''));
  let store: string | null = null;
  const raw = (reasons: ParseReason[], name = cleaned): ParsedItem => ({
    name,
    store,
    quantity: null,
    size: null,
    needsReview: reasons.length > 0,
    reasons,
  });

  // Too long to be one product. The server refuses it; leave it alone.
  if (cleaned.length > MAX_LINE) return raw([]);

  // List scaffolding is never part of what to buy, and neither is a store's
  // name. A flagged line goes to the model without it too.
  const delisted = tidySpaces(cleaned.replace(LIST_MARKER, '').replace(PREFIX_LABEL, ''));
  if (!delisted) return raw([]);
  const taken = takeStoreName(delisted);
  store = taken.store;
  const unmarked = joinQualifiers(taken.rest);

  const reasons: ParseReason[] = [];
  if (listsSeveralItems(unmarked) || JOINING_WORDS.test(unmarked)) reasons.push('multiple_items');
  if (CONVERSATIONAL.test(unmarked)) reasons.push('conversational');

  // ── the count ──────────────────────────────────────────────────────────
  let rest = unmarked;
  const counts: number[] = [];
  for (const pattern of COUNT_PATTERNS) {
    const match = rest.match(pattern);
    if (!match) continue;
    counts.push(Number(match[1]));
    rest = tidySpaces(rest.replace(pattern, ' '));
  }
  // "Siopao 5 pcs" is five siopao. Beside a stated count ("Pandesal 10 pcs
  // x2") the pieces are how big each one is: two packs of ten.
  let piecesSize: string | null = null;
  const pieces = rest.match(PIECES_AT_END) ?? rest.match(PIECES_AT_START);
  if (pieces && pieces.index !== undefined) {
    rest = tidySpaces(`${rest.slice(0, pieces.index)} ${rest.slice(pieces.index + pieces[0].length)}`);
    if (counts.length === 0) counts.push(Number(pieces[1]));
    else piecesSize = `${Number(pieces[1])} pcs`;
  }
  const quantity = counts.length > 0 ? counts[0] : null;
  if (counts.length > 1 && counts.some((c) => c !== counts[0])) reasons.push('conflicting_counts');
  if (quantity !== null && stepperQty !== 1 && quantity !== stepperQty) reasons.push('conflicting_counts');
  if (quantity !== null && quantity > 99) reasons.push('large_quantity');

  // ── the size ───────────────────────────────────────────────────────────
  // A line that is nothing but a size ("5kg") keeps it as its name: an item
  // with no name is worse than an untidy one.
  if (WHOLE_SIZE.test(rest)) {
    return reasons.length > 0 ? raw(reasons, unmarked) : { name: rest, store, quantity, size: null, needsReview: false, reasons };
  }
  let size: string | null = null;
  const sizes = rest.match(ANY_SIZE) ?? [];
  if (sizes.length > 1) {
    reasons.push('multiple_sizes');
  } else if (sizes.length === 1) {
    const leading = rest.match(LEADING_SIZE);
    const trailing = leading ? null : rest.match(TRAILING_SIZE);
    if (leading) {
      size = formatSize(leading[1], leading[2]);
      rest = tidySpaces(leading[3]);
    } else if (trailing) {
      size = formatSize(trailing[2], trailing[3]);
      rest = tidySpaces(trailing[1]);
    } else {
      reasons.push('size_in_middle');
    }
  }
  if (piecesSize) {
    if (sizes.length > 0) reasons.push('multiple_sizes');
    else size = piecesSize;
  }

  // ── what still could be misread ────────────────────────────────────────
  if (NUMBER_WORDS.test(rest)) reasons.push('number_word');
  if (FRACTION.test(unmarked)) reasons.push('fraction');
  if (PACK_COUNT.test(rest)) reasons.push('pack_unit');
  if (AMOUNT.test(unmarked)) reasons.push('amount');
  reasons.push(...bareNumberReasons(rest.split(' ').filter(Boolean)));

  const unique = [...new Set(reasons)];
  if (unique.length > 0) return raw(unique, unmarked);
  if (!rest) return raw([], unmarked);
  return { name: rest, store, quantity, size, needsReview: false, reasons: [] };
}
