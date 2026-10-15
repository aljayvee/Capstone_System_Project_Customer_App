import { parseItemEntry, splitPastedLines, type ParseReason } from '../utils/itemEntryParser';
import { formatItemLabel } from '../utils/format';

/**
 * What the typing rules settle, and what they leave for the server's model.
 *
 * The rule under test everywhere: a confidently wrong cleanup is worse than
 * none. A line the rules could misread must come back exactly as typed, with a
 * reason, never "tidied" into something the customer did not ask for.
 */

type Settled = [input: string, name: string, quantity: number | null, size: string | null];

const SETTLED: Settled[] = [
  ['5 Kilo of Chicken 2qty', 'Chicken', 2, '5 kg'],
  ['Coke 1.5L x2', 'Coke', 2, '1.5 L'],
  ['2x Safeguard soap', 'Safeguard soap', 2, null],
  ['qty 3 Lucky Me Pancit Canton', 'Lucky Me Pancit Canton', 3, null],
  ['Paracetamol 500mg', 'Paracetamol', null, '500 mg'],
  ['Rice 25 kilos', 'Rice', null, '25 kg'],
  ['• Item: Bear Brand 300g ×4', 'Bear Brand', 4, '300 g'],
  ['1. Eggs', 'Eggs', null, null],
  ['Alaska Evap 370ml x 2', 'Alaska Evap', 2, '370 mL'],
  ['Head & Shoulders 170ml', 'Head & Shoulders', null, '170 mL'],
  ['Coke (x2)', 'Coke', 2, null],
  ['Milk 1l', 'Milk', null, '1 L'],
  // The count typed at the end of the name with the stepper left on 1.
  ['lucky me pancit canton calamansi 3x', 'lucky me pancit canton calamansi', 3, null],
  ['coke zero 1.5L 2x', 'coke zero', 2, '1.5 L'],
  // A count of pieces is the count (2026-10-06: these went to the model, which
  // answered "5 pcs" as a size half the time, and none at all past 2.75 s).
  ['Siopao 5 pcs', 'Siopao', 5, null],
  ['Delight, 5pcs', 'Delight', 5, null],
  ['5pcs siopao', 'siopao', 5, null],
  ['Siopao (5 pcs)', 'Siopao', 5, null],
  ['Bear Brand 33g 10pcs', 'Bear Brand', 10, '33 g'],
  // With a count of its own, the pieces are how big each one is.
  ['Pandesal 10 pcs x2', 'Pandesal', 2, '10 pcs'],
  // A comma before a count or a size is the same item, not a list.
  ['Coke, 1.5L, x2', 'Coke', 2, '1.5 L'],
];

describe('lines the rules settle', () => {
  it.each(SETTLED)('%s', (input, name, quantity, size) => {
    expect(parseItemEntry(input)).toEqual({ name, store: null, quantity, size, needsReview: false, reasons: [] });
  });

  it.each(['2x4 coco lumber', '70% Isopropyl Alcohol', 'Tray of eggs', 'Head & Shoulders'])(
    'leaves %s untouched: nothing in it is a count or a size',
    (input) => {
      expect(parseItemEntry(input)).toEqual({ name: input, store: null, quantity: null, size: null, needsReview: false, reasons: [] });
    }
  );

  it('keeps a line that is nothing but a size as its name', () => {
    expect(parseItemEntry('5kg')).toMatchObject({ name: '5kg', needsReview: false });
  });

  it('reads the example on the screen the way a rider should', () => {
    const parsed = parseItemEntry('5 Kilo of Chicken 2qty');
    expect(`${parsed.quantity} × ${formatItemLabel(parsed.name, parsed.size)}`).toBe('2 × Chicken · 5 kg');
  });
});

type Flagged = [input: string, reason: ParseReason, stepper?: number];

const FLAGGED: Flagged[] = [
  ['7 Up 1.5L', 'leading_number'],
  ['555 Sardines', 'leading_number'],
  ['3 in 1 coffee x10', 'leading_number'],
  ['2 Coke 1.5L', 'leading_number'],
  ['Chicken 2', 'trailing_number'],
  ['Vitamin C 500 Tablets', 'middle_number'],
  ['isang kilong bigas', 'number_word'],
  ['1/2 kilo galunggong', 'fraction'],
  ['chicken 2, rice 5kg', 'multiple_items'],
  ['Pandesal 2 packs', 'pack_unit'],
  ['Siopao 5 pcs asado', 'pack_unit'],
  ['Siopao 5 pcs', 'conflicting_counts', 2],
  ['Siopao 150 pcs', 'large_quantity'],
  ['₱20 pandesal', 'amount'],
  ['Coke 1.5L Zero', 'size_in_middle'],
  ['Rice 5kg 25kg', 'multiple_sizes'],
  ['Coke x2', 'conflicting_counts', 3],
  ['Tide x500', 'large_quantity'],
  // From the age-group report: joined products, requests and spoken prices.
  ['amlodipine tapos pandesal', 'multiple_items'],
  ['sibuyas tsaka bawang', 'multiple_items'],
  ['Pabili ng sibuyas po', 'conversational'],
  ['Kangkong paki pili yung sariwa salamat', 'conversational'],
  ['Mantika na tig-singkwenta pesos', 'number_word'],
  // "mix and match" is one product; the 2 could be a brand's ("7 Up").
  ['2 mix and match na spag', 'leading_number'],
];

describe('lines left for the model', () => {
  it.each(FLAGGED)('%s is left as typed (%s)', (input, reason, stepper = 1) => {
    const parsed = parseItemEntry(input, { stepperQty: stepper });
    expect(parsed.needsReview).toBe(true);
    expect(parsed.reasons).toContain(reason);
    // Never half-tidied: the whole line, no count, no size.
    expect(parsed).toMatchObject({ name: input, quantity: null, size: null });
  });

  it('still strips list scaffolding from a flagged line', () => {
    expect(parseItemEntry('- 555 Sardines').name).toBe('555 Sardines');
  });

  it('agrees with a stated count that matches the stepper', () => {
    expect(parseItemEntry('Coke x3', { stepperQty: 3 })).toMatchObject({ name: 'Coke', quantity: 3, needsReview: false });
  });
});

describe('never losing a word', () => {
  // Words the rules may drop: scaffolding, counts and the "of" in "5 kilo of".
  const FREE = new Set(['qty', 'quantity', 'x', 'of', 'item', 'items', 'order', 'pabili', 'bili', 'pcs']);
  const words = (text: string) => (text.toLowerCase().match(/[a-z&]+/g) ?? []).filter((w) => !FREE.has(w));

  it.each(SETTLED.map(([input]) => input))('%s keeps every product word in its name or size', (input) => {
    const parsed = parseItemEntry(input);
    const kept = `${parsed.name} ${parsed.size ?? ''}`.toLowerCase();
    for (const word of words(input)) {
      const unit = ['kilo', 'kilos', 'l', 'ml', 'mg', 'g'].includes(word);
      if (!unit) expect(kept).toContain(word);
    }
  });
});

type StoreLine = [input: string, name: string, store: string, quantity: number | null, size: string | null];

const STORE_LINES: StoreLine[] = [
  ['Rose Pharmacy Lozartan 5mg', 'Lozartan', 'Rose Pharmacy', null, '5 mg'],
  ['Lozartan 5mg sa Rose Pharmacy', 'Lozartan', 'Rose Pharmacy', null, '5 mg'],
  ['Lozartan 5mg Rose Pharmacy', 'Lozartan', 'Rose Pharmacy', null, '5 mg'],
  ['Biogesic from Mercury Drug x2', 'Biogesic', 'Mercury Drug', 2, null],
  ['Siopao 7-Eleven', 'Siopao', '7-Eleven', null, null],
  ['Jollibee: spaghetti', 'spaghetti', 'Jollibee', null, null],
  ['Royal Bakery ensaymada 3x', 'ensaymada', 'Royal Bakery', 3, null],
];

describe('store names', () => {
  it.each(STORE_LINES)('%s is the item without its store', (input, name, store, quantity, size) => {
    expect(parseItemEntry(input)).toEqual({ name, store, quantity, size, needsReview: false, reasons: [] });
  });

  it('takes the store out of a line it leaves for the model too', () => {
    expect(parseItemEntry('2 Rose Pharmacy Lozartan')).toMatchObject({
      name: '2 Lozartan',
      store: 'Rose Pharmacy',
      needsReview: true,
    });
  });

  it.each([
    // Nothing left to buy.
    'Rose Pharmacy',
    // Not a shop's name, or a brand sold on other shops' shelves.
    'App Store gift card',
    'Paper Grocery Bag',
    'Mercury thermometer',
    'Goldilocks polvoron',
    'Starbucks Frappuccino',
  ])('leaves %s alone', (input) => {
    expect(parseItemEntry(input)).toMatchObject({ name: input, store: null });
  });
});

describe('pasted lists', () => {
  it('splits on line breaks and drops blank lines', () => {
    expect(splitPastedLines('Rice 5kg\n\n  Eggs \r\nCoke x2')).toEqual(['Rice 5kg', 'Eggs', 'Coke x2']);
  });
});
