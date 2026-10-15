const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

import {
  storeCategoryOf,
  storeKeyForCategory,
  storeKeysFor,
  withStores,
  addChip,
  addTypedLines,
  adjustQuantity,
  allRows,
  applyStoreChecks,
  applyTidy,
  capitalizeItemName,
  dismissRemovedStore,
  droppedStoresWithItems,
  editRow,
  emptyDraft,
  keepInStore,
  moveRow,
  noteRemovedStore,
  pabiliDraftStore,
  readStoredDraft,
  rowsAwaitingStoreCheck,
  rowsAwaitingTidy,
  sameCategories,
  totalUnits,
  withCategories,
  writeStoredDraft,
  type PabiliDraft,
} from '../services/pabiliDraft';

/**
 * The shopping list while it is written: what typing, chips, the model's
 * readings and the store check do to it, how it follows a new choice of
 * stores, and that it survives on the phone.
 */

const GROCERY = 'Supermarket & Grocery';
const PHARMACY = 'Pharmacy & Health';
const BAKERY = 'Bakery & Snacks';
const rowsOf = (draft: PabiliDraft, cat = GROCERY) => draft.rowsByCategory[cat];

beforeEach(() => mockStorage.clear());

describe('item names', () => {
  it.each([
    ['bigas', 'Bigas'],
    ['coke 1.5L', 'Coke 1.5L'],
    ['  pancit   canton ', 'Pancit canton'],
    ['iPhone charger', 'iPhone charger'],
    ['7 Up', '7 Up'],
    ['Bear Brand', 'Bear Brand'],
  ])('%s reads as %s', (typed, shown) => {
    expect(capitalizeItemName(typed)).toBe(shown);
  });
});

describe('typing into a store', () => {
  it('moves a stated count onto the quantity and the size beside the name', () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, '5 kilo of chicken 2qty', 1);
    expect(rowsOf(draft)[0]).toMatchObject({ name: 'Chicken', size: '5 kg', quantity: 2 });
    expect(draft.composeByCategory[GROCERY]).toEqual({ text: '', quantity: 1 });
  });

  it('uses the stepper when the line states no count', () => {
    const [row] = rowsOf(addTypedLines(emptyDraft([GROCERY]), GROCERY, 'eggs', 3));
    expect(row).toMatchObject({ name: 'Eggs', quantity: 3, size: null });
  });

  it('adds a line it cannot read as typed, for the server to read', () => {
    const [row] = rowsOf(addTypedLines(emptyDraft([GROCERY]), GROCERY, 'isang kilong bigas', 1));
    expect(row).toMatchObject({ name: 'Isang kilong bigas', size: null });
    expect(row.review?.reasons).toContain('number_word');
    expect(row.review?.tidy).toBeUndefined();
  });

  it('adds every line of a pasted list, ignoring the stepper', () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Rice 5kg\nEggs\nCoke x2', 4);
    expect(rowsOf(draft).map((r) => [r.name, r.size, r.quantity])).toEqual([
      ['Rice', '5 kg', 1],
      ['Eggs', null, 1],
      ['Coke', null, 2],
    ]);
  });

  it('merges the same item and size, and keeps different sizes apart', () => {
    let draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Coke 1.5L', 1);
    draft = addTypedLines(draft, GROCERY, 'coke 1.5l x2', 1);
    draft = addTypedLines(draft, GROCERY, 'Coke 330ml', 1);
    expect(rowsOf(draft).map((r) => [r.size, r.quantity])).toEqual([
      ['1.5 L', 3],
      ['330 mL', 1],
    ]);
  });

  it('adds a chip already clean and already known to fit its store', () => {
    const [row] = rowsOf(addChip(emptyDraft([GROCERY]), GROCERY, { name: 'Rice', size: '5 kg' }));
    expect(row).toMatchObject({ name: 'Rice', size: '5 kg', quantity: 1, source: 'chip', storeCheck: { status: 'fits' } });
  });

  it('removes a row whose quantity reaches zero', () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Eggs', 1);
    expect(rowsOf(adjustQuantity(draft, GROCERY, rowsOf(draft)[0].id, -1))).toEqual([]);
  });

  it('keeps two requests for the same item apart when their notes differ', () => {
    let draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Eggs', 1);
    draft = editRow(draft, GROCERY, rowsOf(draft)[0].id, { name: 'Eggs', size: null, notes: 'brown only' });
    draft = addTypedLines(draft, GROCERY, 'Eggs', 1);
    expect(rowsOf(draft).map((r) => [r.name, r.notes, r.quantity])).toEqual([
      ['Eggs', 'brown only', 1],
      ['Eggs', null, 1],
    ]);
  });

  it('makes a hand edit final: nothing left to tidy, and its store asked about again', () => {
    let draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, '7 Up 1.5L', 1);
    const id = rowsOf(draft)[0].id;
    draft = applyStoreChecks(draft, GROCERY, [{ id, name: rowsOf(draft)[0].name, check: { status: 'fits' } }]);
    const [row] = rowsOf(editRow(draft, GROCERY, id, { name: 'sprite', size: '1.5 L' }));
    expect(row).toMatchObject({ name: 'Sprite', size: '1.5 L' });
    expect(row.review).toBeUndefined();
    expect(row.storeCheck).toBeUndefined();
  });
});

describe("the model's readings", () => {
  const flagged = () => addTypedLines(emptyDraft([GROCERY]), GROCERY, 'chicken 2, rice 5kg', 1);

  it('asks about a flagged line until a model has read it', () => {
    const draft = flagged();
    const id = rowsOf(draft)[0].id;
    expect(rowsAwaitingTidy(draft)).toHaveLength(1);
    // No model could answer in time: asked again on the next visit to Review.
    const unread = applyTidy(draft, [id], false, []);
    expect(rowsOf(unread)[0].review?.tidy).toBe('unread');
    expect(rowsAwaitingTidy(unread)).toHaveLength(1);
    // Read, or read and left alone: never asked again.
    const read = applyTidy(unread, [id], true, [{ id, confident: true, items: [{ name: 'chicken', quantity: 2, size: null }] }]);
    expect(rowsOf(read)[0]).toMatchObject({ name: 'Chicken', quantity: 2 });
    expect(rowsAwaitingTidy(read)).toHaveLength(0);
    expect(rowsAwaitingTidy(applyTidy(unread, [id], true, []))).toHaveLength(0);
  });

  it('applies a reading on its own, splitting the line and capitalizing the names', () => {
    const draft = flagged();
    const id = rowsOf(draft)[0].id;
    const read = applyTidy(draft, [id], true, [
      {
        id,
        confident: true,
        items: [
          { name: 'chicken', quantity: 2, size: null },
          { name: 'rice', quantity: 1, size: '5 kg' },
        ],
      },
    ]);
    expect(rowsOf(read).map((r) => [r.name, r.size, r.quantity])).toEqual([
      ['Chicken', null, 2],
      ['Rice', '5 kg', 1],
    ]);
    expect(totalUnits(read)).toBe(3);
  });

  it('applies an unsure reading too: the server already refused any that changed the words', () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'dalawang manok', 1);
    const id = rowsOf(draft)[0].id;
    const read = applyTidy(draft, [id], true, [{ id, confident: false, items: [{ name: 'manok', quantity: 2, size: null }] }]);
    expect(rowsOf(read)[0]).toMatchObject({ name: 'Manok', quantity: 2 });
  });

  it('keeps the rider instruction the model found in the line', () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Pabili ng sibuyas 1/2 kilo paki pili walang bulok', 1);
    const id = rowsOf(draft)[0].id;
    const read = applyTidy(draft, [id], true, [
      { id, confident: true, items: [{ name: 'sibuyas', quantity: 1, size: '1/2 kg', notes: 'pili walang bulok' }] },
    ]);
    expect(rowsOf(read)[0]).toMatchObject({ name: 'Sibuyas', size: '1/2 kg', notes: 'pili walang bulok' });
  });

  it('marks a line the model read but left alone as kept', () => {
    const draft = flagged();
    const id = rowsOf(draft)[0].id;
    expect(rowsOf(applyTidy(draft, [id], true, []))[0].review?.tidy).toBe('kept');
  });
});

describe('a store named in a line', () => {
  const typed = (text: string, draft = emptyDraft([PHARMACY])) => addTypedLines(draft, PHARMACY, text, 1);

  it('lists the item without the store, and owes the customer a warning', () => {
    const [row] = rowsOf(typed('Rose Pharmacy Lozartan 5mg'), PHARMACY);
    expect(row).toMatchObject({ name: 'Lozartan', size: '5 mg', quantity: 1, removedStore: 'Rose Pharmacy' });
  });

  it('OK clears the warning and leaves the item as it is', () => {
    const draft = typed('Rose Pharmacy Lozartan 5mg');
    const [row] = rowsOf(dismissRemovedStore(draft, PHARMACY, rowsOf(draft, PHARMACY)[0].id), PHARMACY);
    expect(row.removedStore).toBeUndefined();
    expect(row).toMatchObject({ name: 'Lozartan', size: '5 mg', notes: null });
  });

  it('asking for the store puts it in the note, never back in the name', () => {
    const draft = typed('Rose Pharmacy Lozartan 5mg');
    const [row] = rowsOf(noteRemovedStore(draft, PHARMACY, rowsOf(draft, PHARMACY)[0].id), PHARMACY);
    expect(row).toMatchObject({ name: 'Lozartan', notes: 'Buy at Rose Pharmacy if possible' });
    expect(row.removedStore).toBeUndefined();
  });

  it('adds the request to a note already there', () => {
    const draft = typed('Rose Pharmacy Lozartan 5mg');
    const [first] = rowsOf(draft, PHARMACY);
    const noted: PabiliDraft = { ...draft, rowsByCategory: { [PHARMACY]: [{ ...first, notes: 'generic is fine' }] } };
    expect(rowsOf(noteRemovedStore(noted, PHARMACY, first.id), PHARMACY)[0].notes).toBe(
      'generic is fine. Buy at Rose Pharmacy if possible'
    );
  });

  it('carries the warning onto the same item already listed', () => {
    const draft = typed('Rose Pharmacy Lozartan 5mg', typed('Lozartan 5mg'));
    expect(rowsOf(draft, PHARMACY)).toHaveLength(1);
    expect(rowsOf(draft, PHARMACY)[0]).toMatchObject({ quantity: 2, removedStore: 'Rose Pharmacy' });
  });

  it('keeps the warning when the model reads the rest of the line', () => {
    const draft = typed('2 Rose Pharmacy Lozartan');
    const [row] = rowsOf(draft, PHARMACY);
    expect(row).toMatchObject({ name: '2 Lozartan', removedStore: 'Rose Pharmacy' });
    const read = applyTidy(draft, [row.id], true, [{ id: row.id, confident: true, items: [{ name: 'Lozartan', quantity: 2, size: null }] }]);
    expect(rowsOf(read, PHARMACY)[0]).toMatchObject({ name: 'Lozartan', quantity: 2, removedStore: 'Rose Pharmacy' });
  });
});

describe('the store check', () => {
  it('asks about typed rows once, and not about a raw line still waiting to be read', () => {
    let draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Biogesic', 1);
    draft = addTypedLines(draft, GROCERY, 'chicken 2, rice 5kg', 1);
    expect(rowsAwaitingStoreCheck(draft, GROCERY).map((r) => r.name)).toEqual(['Biogesic']);
  });

  it('records a verdict only for the name it was asked about', () => {
    let draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Biogesic', 1);
    const id = rowsOf(draft)[0].id;
    draft = editRow(draft, GROCERY, id, { name: 'Bread', size: null });
    const stale = applyStoreChecks(draft, GROCERY, [{ id, name: 'Biogesic', check: { status: 'mismatch', usualStore: PHARMACY } }]);
    expect(rowsOf(stale)[0].storeCheck).toBeUndefined();
  });

  it('moves an item to the store that sells it, merging with the same item there', () => {
    let draft = emptyDraft([GROCERY, PHARMACY]);
    draft = addTypedLines(draft, GROCERY, 'Biogesic', 2);
    draft = addTypedLines(draft, PHARMACY, 'biogesic', 1);
    const id = rowsOf(draft)[0].id;
    const moved = moveRow(draft, GROCERY, PHARMACY, id);
    expect(rowsOf(moved, GROCERY)).toEqual([]);
    expect(rowsOf(moved, PHARMACY).map((r) => [r.name, r.quantity])).toEqual([['Biogesic', 3]]);
  });

  it('never moves to a store that is not on the errand', () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Biogesic', 1);
    expect(moveRow(draft, GROCERY, PHARMACY, rowsOf(draft)[0].id)).toBe(draft);
  });

  it('keeps an item where the customer says it is', () => {
    let draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Biogesic', 1);
    const id = rowsOf(draft)[0].id;
    draft = applyStoreChecks(draft, GROCERY, [{ id, name: 'Biogesic', check: { status: 'mismatch', usualStore: PHARMACY } }]);
    expect(rowsOf(keepInStore(draft, GROCERY, id))[0].storeCheck).toEqual({ status: 'kept' });
  });
});

describe('a new choice of stores', () => {
  const saved = () => {
    let d = emptyDraft([GROCERY, PHARMACY]);
    d = addTypedLines(d, GROCERY, 'Rice 5kg', 1);
    d = addTypedLines(d, PHARMACY, 'Biogesic', 1);
    return d;
  };

  it('keeps every item when a store is added', () => {
    const draft = withCategories(saved(), [GROCERY, PHARMACY, BAKERY]);
    expect(draft.categories).toEqual([GROCERY, PHARMACY, BAKERY]);
    expect(rowsOf(draft, GROCERY).map((r) => r.name)).toEqual(['Rice']);
    expect(rowsOf(draft, PHARMACY).map((r) => r.name)).toEqual(['Biogesic']);
    expect(rowsOf(draft, BAKERY)).toEqual([]);
    expect(droppedStoresWithItems(saved(), [GROCERY, PHARMACY, BAKERY])).toEqual([]);
  });

  it('names a store left out only when it still has items', () => {
    expect(droppedStoresWithItems(saved(), [GROCERY, BAKERY])).toEqual([PHARMACY]);
    const emptyPharmacy = withCategories(saved(), [GROCERY, PHARMACY]);
    emptyPharmacy.rowsByCategory[PHARMACY] = [];
    expect(droppedStoresWithItems(emptyPharmacy, [GROCERY])).toEqual([]);
  });

  it('matches store names regardless of case', () => {
    const draft = withCategories(saved(), [GROCERY.toUpperCase(), PHARMACY]);
    expect(rowsOf(draft, GROCERY.toUpperCase()).map((r) => r.name)).toEqual(['Rice']);
  });
});

describe('on the phone', () => {
  it('reads back what it wrote, per account', async () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Eggs', 2);
    await writeStoredDraft('7', draft);
    expect(await readStoredDraft('7')).toEqual(draft);
    expect(await readStoredDraft('8')).toBeNull();
  });

  it('forgets a list a week old, and one it cannot read', async () => {
    await writeStoredDraft('7', { ...emptyDraft([GROCERY]), updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
    expect(await readStoredDraft('7')).toBeNull();

    mockStorage.set('@sugo_pabili_draft:v1:9', '{not json');
    expect(await readStoredDraft('9')).toBeNull();
  });

  it('saves the current list shortly after each change, and clear removes it', async () => {
    jest.useFakeTimers();
    try {
      pabiliDraftStore.begin('42', emptyDraft([GROCERY]));
      pabiliDraftStore.update((d) => addTypedLines(d, GROCERY, 'Coke x2', 1));
      jest.advanceTimersByTime(350);
      await Promise.resolve();
      const stored = await readStoredDraft('42');
      expect(stored && allRows(stored).map(({ row }) => row.name)).toEqual(['Coke']);

      await pabiliDraftStore.clear();
      expect(pabiliDraftStore.getSnapshot()).toBeNull();
      expect(await readStoredDraft('42')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('compares store selections regardless of order and case', () => {
    expect(sameCategories(['Pharmacy', GROCERY], [GROCERY.toUpperCase(), 'pharmacy'])).toBe(true);
    expect(sameCategories(['Pharmacy'], [GROCERY])).toBe(false);
  });
});

describe('stores picked in the Location list', () => {
  const store = (key: string, categoryName: string | null) => ({
    key,
    name: key.replace(/ \(\d+\)$/, ''),
    address: 'Poblacion',
    latitude: 6.69,
    longitude: 124.68,
    placeId: null,
    categoryId: categoryName ? 1 : null,
    categoryName,
  });

  it('gives a second branch of the same name its own list', () => {
    expect(storeKeysFor(['Mercury Drug', 'Jollibee', 'mercury drug', 'Mercury Drug'])).toEqual([
      'Mercury Drug',
      'Jollibee',
      'mercury drug (2)',
      'Mercury Drug (3)',
    ]);
  });

  it('keeps the items of a store still picked, and knows what kind of shop each is', () => {
    let d = withStores(emptyDraft([]), [store('Mercury Drug', 'Pharmacy'), store('Aling Nena', null)]);
    d = addTypedLines(d, 'Mercury Drug', 'Biogesic', 2);
    d = withStores(d, [store('Mercury Drug', 'Pharmacy'), store('Jollibee', 'Fast Food')]);
    expect(d.mode).toBe('location');
    expect(d.categories).toEqual(['Mercury Drug', 'Jollibee']);
    expect(d.rowsByCategory['Mercury Drug'].map((r) => r.name)).toEqual(['Biogesic']);
    expect(storeCategoryOf(d, 'Jollibee')).toBe('Fast Food');
    expect(storeKeyForCategory(d, 'fast food')).toBe('Jollibee');
  });

  it('names a store with no category by itself, as a merchant category is', () => {
    const d = withStores(emptyDraft([]), [store('Aling Nena', null)]);
    expect(storeCategoryOf(d, 'Aling Nena')).toBe('Aling Nena');
    expect(storeCategoryOf(emptyDraft(['Pharmacy']), 'Pharmacy')).toBe('Pharmacy');
  });

  it('forgets the picked stores when the customer switches back to merchant categories', () => {
    const d = withCategories(withStores(emptyDraft([]), [store('Mercury Drug', 'Pharmacy')]), ['Pharmacy']);
    expect(d.mode).toBe('merchant');
    expect(d.stores).toBeUndefined();
    expect(storeKeyForCategory(d, 'Pharmacy')).toBe('Pharmacy');
  });
});
