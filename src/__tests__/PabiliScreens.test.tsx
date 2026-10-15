import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

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

const mockPost = jest.fn();
jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args), get: jest.fn(() => Promise.resolve({ data: [] })) },
}));

jest.mock('../hooks/useDefaultDeliveryLocation', () => ({
  useDefaultDeliveryLocation: () => ({
    location: { address: 'Purok 1, Tacurong', latitude: 6.69, longitude: 124.68 },
    loading: false,
    failed: false,
    retry: jest.fn(),
  }),
}));

const mockSubmit = jest.fn();
jest.mock('../services/pabiliSubmit', () => ({ submitPabili: (...args: unknown[]) => mockSubmit(...args) }));

const mockAlert = jest.fn();
jest.mock('../services/alertModal', () => ({ showAppAlert: (...args: unknown[]) => mockAlert(...args) }));

import PabiliHubScreen from '../screens/pabili/PabiliHubScreen';
import PabiliStoreEditorScreen from '../screens/pabili/PabiliStoreEditorScreen';
import PabiliReviewScreen from '../screens/pabili/PabiliReviewScreen';
import {
  addChip,
  addTypedLines,
  allRows,
  emptyDraft,
  pabiliDraftStore,
  withStores,
  writeStoredDraft,
  type PabiliDraft,
  type PickedStore,
} from '../services/pabiliDraft';

/**
 * The pabili list across its three screens: the hub, one store's editor and
 * Review. Covers the paths that decide what a rider buys: the typing rules,
 * the store check, a new choice of stores keeping the list, the empty-store
 * nudge, the model's silent clean-up, and Send never waiting on the model.
 */

const GROCERY = 'Supermarket & Grocery';
const PHARMACY = 'Pharmacy & Health';
const BAKERY = 'Bakery & Snacks';
const user = { id: 'u1', username: 'ana', firstName: 'Ana', lastName: 'Cruz' };
const navigation: any = { navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn() };

const quoteReply = { data: { fees: { subtotal: 65 } } };
const nothingToTidy = () => Promise.resolve({ data: { available: true, results: [] } });
/** Every item usually sold at `store`, with a confident answer. */
const usuallyAt = (store: string) => (names: string[]) => names.map(() => ({ category: store, confidence: 0.96, strong: true }));

function postRoutes(normalize: () => Promise<unknown>, itemStores?: (names: string[]) => unknown) {
  mockPost.mockImplementation((url: string, body: any) => {
    if (url === '/errands/quote') return Promise.resolve(quoteReply);
    if (url === '/errands/normalize-items') return normalize();
    if (url === '/errands/item-stores') {
      const results = itemStores ? itemStores(body.names) : body.names.map(() => ({ category: null, strong: false }));
      return Promise.resolve({ data: { results } });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

async function begin(draft: PabiliDraft) {
  await act(async () => {
    pabiliDraftStore.begin('u1', draft);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockStorage.clear();
  await pabiliDraftStore.clear();
});

describe('a store editor', () => {
  const editorRoute = { key: 'e', name: 'PabiliStoreEditor', params: { user, category: GROCERY } } as any;

  async function addTyped(screen: any, text: string) {
    await fireEvent.changeText(screen.getByTestId('compose-input'), text);
    await fireEvent.press(screen.getByTestId('compose-add'));
  }

  it('turns "5 kilo of chicken 2qty" into two of Chicken · 5 kg', async () => {
    await begin(emptyDraft([GROCERY]));
    postRoutes(nothingToTidy);
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);

    await addTyped(screen, '5 kilo of chicken 2qty');

    expect(await screen.findByText('Chicken · 5 kg')).toBeTruthy();
    const row = allRows(pabiliDraftStore.getSnapshot()!)[0].row;
    expect(row).toMatchObject({ name: 'Chicken', size: '5 kg', quantity: 2 });
    expect(screen.getByTestId('compose-input').props.value).toBe('');
  });

  it('labels the item field, the quantity and the add button in plain words', async () => {
    await begin(emptyDraft([GROCERY]));
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    expect(screen.getByText('What to buy')).toBeTruthy();
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('sets the quantity in one tap from the quick pills', async () => {
    await begin(emptyDraft([GROCERY]));
    postRoutes(nothingToTidy);
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    await fireEvent.press(screen.getByTestId('quick-qty-5'));
    expect(screen.getByTestId('quick-qty-5').props.accessibilityState).toEqual({ selected: true });
    await addTyped(screen, 'Eggs');
    expect(allRows(pabiliDraftStore.getSnapshot()!)[0].row).toMatchObject({ name: 'Eggs', quantity: 5 });
  });

  it('lets the customer add a note for the rider, shown under the item', async () => {
    await begin(addChip(emptyDraft([GROCERY]), GROCERY, { name: 'Sibuyas', size: '1/2 kg' }));
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    await fireEvent.press(screen.getByText('Sibuyas · 1/2 kg'));
    await fireEvent.changeText(screen.getByTestId('edit-notes'), 'walang bulok please');
    await fireEvent.press(screen.getByTestId('edit-save'));
    expect(await screen.findByText('Note: walang bulok please')).toBeTruthy();
    expect(allRows(pabiliDraftStore.getSnapshot()!)[0].row.notes).toBe('walang bulok please');
  });

  it('adds a line it cannot read as typed, capitalized, without asking anything', async () => {
    await begin(emptyDraft([GROCERY]));
    postRoutes(nothingToTidy);
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    await addTyped(screen, 'isang kilong bigas');
    expect(await screen.findByText('Isang kilong bigas')).toBeTruthy();
    expect(screen.queryByText(/check this one/i)).toBeNull();
  });

  it('offers to move an item to the store on the errand that sells it', async () => {
    await begin(emptyDraft([GROCERY, PHARMACY]));
    postRoutes(nothingToTidy, usuallyAt(PHARMACY));
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    await addTyped(screen, 'biogesic');

    expect(await screen.findByText('Biogesic is usually bought at Pharmacy & Health.', {}, { timeout: 3000 })).toBeTruthy();
    expect(mockPost).toHaveBeenCalledWith('/errands/item-stores', { names: ['Biogesic'] }, expect.anything());

    await fireEvent.press(screen.getByTestId('store-check-0-move'));
    const draft = pabiliDraftStore.getSnapshot()!;
    expect(draft.rowsByCategory[GROCERY]).toEqual([]);
    expect(draft.rowsByCategory[PHARMACY].map((r) => r.name)).toEqual(['Biogesic']);
  });

  it('asks "Are you sure?" when the store that sells it is not on the errand, and remembers the answer', async () => {
    await begin(emptyDraft([GROCERY]));
    postRoutes(nothingToTidy, usuallyAt(PHARMACY));
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    await addTyped(screen, 'Biogesic');

    expect(
      await screen.findByText(
        'Biogesic is usually sold at Pharmacy & Health. Are you sure Supermarket & Grocery has it?',
        {},
        { timeout: 3000 }
      )
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('store-check-0-keep'));
    expect(screen.queryByTestId('store-check-0')).toBeNull();
    expect(allRows(pabiliDraftStore.getSnapshot()!)[0].row.storeCheck).toEqual({ status: 'kept' });
  });

  it('takes a store name out of the item, warns, and can ask for that store in the note', async () => {
    await begin(emptyDraft([PHARMACY]));
    postRoutes(nothingToTidy);
    const pharmacyRoute = { key: 'p', name: 'PabiliStoreEditor', params: { user, category: PHARMACY } } as any;
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={pharmacyRoute} />);
    await addTyped(screen, 'Rose Pharmacy Lozartan 5mg');

    expect(await screen.findByText('Lozartan · 5 mg')).toBeTruthy();
    expect(
      screen.getByText('We took "Rose Pharmacy" out of this item because it is a store, not something to buy. Your dispatcher picks the store.')
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('store-name-0-ask'));
    expect(screen.queryByTestId('store-name-0')).toBeNull();
    expect(await screen.findByText('Note: Buy at Rose Pharmacy if possible')).toBeTruthy();
    expect(allRows(pabiliDraftStore.getSnapshot()!)[0].row.name).toBe('Lozartan');
  });

  it('OK closes the store-name warning and changes nothing else', async () => {
    await begin(emptyDraft([PHARMACY]));
    postRoutes(nothingToTidy);
    const pharmacyRoute = { key: 'p', name: 'PabiliStoreEditor', params: { user, category: PHARMACY } } as any;
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={pharmacyRoute} />);
    await addTyped(screen, 'Biogesic from Mercury Drug x2');

    await fireEvent.press(await screen.findByTestId('store-name-0-ok'));
    expect(screen.queryByTestId('store-name-0')).toBeNull();
    expect(allRows(pabiliDraftStore.getSnapshot()!)[0].row).toMatchObject({ name: 'Biogesic', quantity: 2, notes: null });
  });

  it('calls the size a unit in the edit sheet', async () => {
    await begin(addChip(emptyDraft([GROCERY]), GROCERY, { name: 'Galunggong', size: '1 kg' }));
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    await fireEvent.press(screen.getByText('Galunggong · 1 kg'));
    expect(screen.getByText('Unit (optional)')).toBeTruthy();
    expect(screen.queryByText('Size (optional)')).toBeNull();
  });

  it('asks nothing about an item a supermarket also sells', async () => {
    await begin(emptyDraft([GROCERY]));
    postRoutes(nothingToTidy, usuallyAt(BAKERY));
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute} />);
    await addTyped(screen, 'Pandesal');
    await waitFor(
      () => expect(allRows(pabiliDraftStore.getSnapshot()!)[0].row.storeCheck).toEqual({ status: 'fits' }),
      { timeout: 3000 }
    );
    expect(screen.queryByTestId('store-check-0')).toBeNull();
  });
});

describe('the store hub', () => {
  const hubRoute = (selectedCats: string[]) => ({ key: 'h', name: 'ErrandItems', params: { user, selectedCats } }) as any;
  const savedTwoStores = () =>
    addChip(addChip(emptyDraft([GROCERY, PHARMACY]), GROCERY, { name: 'Rice', size: '5 kg' }), PHARMACY, {
      name: 'Paracetamol',
      size: '500 mg',
    });

  it('names the store that is still empty instead of opening Review', async () => {
    await begin(addChip(emptyDraft([GROCERY, PHARMACY]), GROCERY, { name: 'Rice', size: '5 kg' }));
    const screen: any = await render(<PabiliHubScreen navigation={navigation} route={hubRoute([GROCERY, PHARMACY])} />);
    await waitFor(() => expect(screen.getByText('1 item')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('review-list-button'));

    expect(screen.getByTestId('missing-store-banner')).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalledWith('PabiliReview', expect.anything());
  });

  it('keeps the list when a store is added in step 1, and asks nothing', async () => {
    await writeStoredDraft('u1', addChip(emptyDraft([GROCERY]), GROCERY, { name: 'Rice', size: '5 kg' }));
    const screen: any = await render(<PabiliHubScreen navigation={navigation} route={hubRoute([GROCERY, PHARMACY])} />);

    await waitFor(() => expect(screen.getByText('1 item')).toBeTruthy());
    expect(screen.getByTestId(`store-card-${PHARMACY}`)).toBeTruthy();
    expect(screen.queryByText(/Remove your/)).toBeNull();
    expect(pabiliDraftStore.getSnapshot()?.categories).toEqual([GROCERY, PHARMACY]);
  });

  it('asks before dropping a store that still has items, and keeps it on request', async () => {
    await writeStoredDraft('u1', savedTwoStores());
    const screen: any = await render(<PabiliHubScreen navigation={navigation} route={hubRoute([GROCERY, BAKERY])} />);

    expect(await screen.findByText('Remove your Pharmacy & Health items?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-modal-cancel'));

    await waitFor(() => expect(pabiliDraftStore.getSnapshot()?.categories).toEqual([GROCERY, BAKERY, PHARMACY]));
    expect(pabiliDraftStore.getSnapshot()?.rowsByCategory[PHARMACY].map((r) => r.name)).toEqual(['Paracetamol']);
  });

  it('removes only that store when the customer agrees', async () => {
    await writeStoredDraft('u1', savedTwoStores());
    const screen: any = await render(<PabiliHubScreen navigation={navigation} route={hubRoute([GROCERY, BAKERY])} />);

    expect(await screen.findByText('Remove your Pharmacy & Health items?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-modal-submit'));

    await waitFor(() => expect(pabiliDraftStore.getSnapshot()?.categories).toEqual([GROCERY, BAKERY]));
    expect(pabiliDraftStore.getSnapshot()?.rowsByCategory[GROCERY].map((r) => r.name)).toEqual(['Rice']);
  });
});

describe('stores picked in the Location list', () => {
  const picked = (key: string, categoryName: string | null): PickedStore => ({
    key,
    name: key,
    address: 'Mabini St, Poblacion',
    latitude: 6.69,
    longitude: 124.68,
    placeId: null,
    categoryId: categoryName ? 3 : null,
    categoryName,
  });
  const MERCURY = picked('Mercury Drug', 'Pharmacy');
  const NENA = picked('Aling Nena', 'Supermarket & Grocery');
  const hubRoute = (stores: PickedStore[]) =>
    ({ key: 'h', name: 'ErrandItems', params: { user, selectedCats: stores.map((s) => s.key), stores } }) as any;
  const editorRoute = (category: string) => ({ key: 'e', name: 'PabiliStoreEditor', params: { user, category } }) as any;

  it('lists each picked store with the kind of shop it is', async () => {
    const screen: any = await render(<PabiliHubScreen navigation={navigation} route={hubRoute([MERCURY, NENA])} />);
    expect(await screen.findByTestId('store-kind-Mercury Drug')).toBeTruthy();
    expect(screen.getByText('Supermarket & Grocery')).toBeTruthy();
    const draft = pabiliDraftStore.getSnapshot()!;
    expect(draft.mode).toBe('location');
    expect(draft.stores?.['Mercury Drug']).toEqual(MERCURY);
  });

  // 2026-10-14: "Start with 7-Eleven Tacurong New Isabela (3453)" ran past
  // both edges of the bottom button. It keeps to one line inside the button.
  it('keeps a long store name inside the Start with button', async () => {
    const { StyleSheet } = require('react-native');
    const LONG = picked('7-Eleven Tacurong New Isabela (3453)', 'Convenience Store');
    const screen: any = await render(<PabiliHubScreen navigation={navigation} route={hubRoute([LONG])} />);
    const label = await screen.findByTestId('review-list-button-label');

    expect(label.props.children).toBe('Start with 7-Eleven Tacurong New Isabela (3453)');
    expect(label.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(label.props.style).flexShrink).toBe(1);
    expect(StyleSheet.flatten(screen.getByTestId('review-list-button').props.style).paddingHorizontal).toBeGreaterThan(0);
  });

  it('does not offer to keep a merchant category alongside picked stores', async () => {
    await writeStoredDraft('u1', addChip(emptyDraft([GROCERY]), GROCERY, { name: 'Rice', size: '5 kg' }));
    const screen: any = await render(<PabiliHubScreen navigation={navigation} route={hubRoute([MERCURY])} />);
    expect(await screen.findByText(`Remove your ${GROCERY} items?`)).toBeTruthy();
    expect(screen.getByText('Change my stores')).toBeTruthy();
  });

  it('moves an item to the picked store that sells it', async () => {
    await begin(withStores(emptyDraft([]), [NENA, MERCURY]));
    postRoutes(nothingToTidy, usuallyAt('Pharmacy'));
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute('Aling Nena')} />);
    expect(screen.getByTestId('editor-picked-store').props.children).toBe('Supermarket & Grocery · Mabini St, Poblacion');
    await fireEvent.changeText(screen.getByTestId('compose-input'), 'biogesic');
    await fireEvent.press(screen.getByTestId('compose-add'));

    expect(await screen.findByText('Move to Mercury Drug', {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('store-check-0-move'));
    expect(pabiliDraftStore.getSnapshot()!.rowsByCategory['Mercury Drug'].map((r) => r.name)).toEqual(['Biogesic']);
  });

  it('tells the customer which store the list is for when a store name is typed', async () => {
    await begin(withStores(emptyDraft([]), [MERCURY]));
    postRoutes(nothingToTidy);
    const screen: any = await render(<PabiliStoreEditorScreen navigation={navigation} route={editorRoute('Mercury Drug')} />);
    await fireEvent.changeText(screen.getByTestId('compose-input'), 'Rose Pharmacy Lozartan 5mg');
    await fireEvent.press(screen.getByTestId('compose-add'));
    expect(await screen.findByText(/This list is for Mercury Drug\./)).toBeTruthy();
  });
});

describe('Review', () => {
  const flaggedDraft = () => addTypedLines(emptyDraft([GROCERY]), GROCERY, 'chicken 2, rice 5kg', 1);
  const route = { key: 'r', name: 'PabiliReview', params: { user } } as any;

  it("applies the model's reading on its own, in a table of quantity, item and unit", async () => {
    const draft = flaggedDraft();
    const id = allRows(draft)[0].row.id;
    await begin(draft);
    postRoutes(() =>
      Promise.resolve({
        data: {
          available: true,
          results: [
            {
              id,
              confident: true,
              items: [
                { name: 'chicken', quantity: 2, size: null },
                { name: 'rice', quantity: 1, size: '5 kg' },
              ],
            },
          ],
        },
      })
    );

    const screen: any = await render(<PabiliReviewScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('Rice')).toBeTruthy();
    expect(screen.getByText('Chicken')).toBeTruthy();
    expect(screen.getByText('5 kg')).toBeTruthy();
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Item')).toBeTruthy();
    expect(screen.getByText('Unit')).toBeTruthy();
    expect(screen.queryByText('Size')).toBeNull();
    expect(screen.queryByText(/Tidied/)).toBeNull();
    expect(screen.queryByText('Undo')).toBeNull();
    expect(mockPost).toHaveBeenCalledWith(
      '/errands/normalize-items',
      { lines: [{ id, text: 'Chicken 2, rice 5kg' }] },
      expect.objectContaining({ timeout: 12000 })
    );
  });

  it('shows the rider note the model found under the item', async () => {
    const draft = addTypedLines(emptyDraft([GROCERY]), GROCERY, 'Pabili ng sibuyas 1/2 kilo paki pili walang bulok', 1);
    const id = allRows(draft)[0].row.id;
    await begin(draft);
    postRoutes(() =>
      Promise.resolve({
        data: {
          available: true,
          results: [{ id, confident: true, items: [{ name: 'sibuyas', quantity: 1, size: '1/2 kg', notes: 'pili walang bulok' }] }],
        },
      })
    );
    const screen: any = await render(<PabiliReviewScreen navigation={navigation} route={route} />);
    expect(await screen.findByText('Note: pili walang bulok')).toBeTruthy();
    expect(screen.getByText('Sibuyas')).toBeTruthy();
    expect(screen.getByText('1/2 kg')).toBeTruthy();
  });

  it('sends without waiting for a read still in flight', async () => {
    const draft = flaggedDraft();
    const id = allRows(draft)[0].row.id;
    await begin(draft);
    postRoutes(() => new Promise(() => {})); // the model never answers
    mockSubmit.mockResolvedValueOnce('E-9');

    const screen: any = await render(<PabiliReviewScreen navigation={navigation} route={route} />);
    expect(await screen.findByTestId(`tidying-${id}`)).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByTestId('submit-errand-items-button'));
    });

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    const sent: PabiliDraft = mockSubmit.mock.calls[0][0];
    expect(allRows(sent).map(({ row }) => row.name)).toEqual(['Chicken 2, rice 5kg']);
    await waitFor(() =>
      expect(navigation.reset).toHaveBeenCalledWith(
        expect.objectContaining({
          routes: expect.arrayContaining([expect.objectContaining({ name: 'WaitingForDispatcher', params: { user, errandId: 'E-9' } })]),
        })
      )
    );
    expect(pabiliDraftStore.getSnapshot()).toBeNull();
  });

  it('keeps the list when the send fails, and says so', async () => {
    await begin(addChip(emptyDraft([GROCERY]), GROCERY, { name: 'Rice', size: '5 kg' }));
    postRoutes(nothingToTidy);
    mockSubmit.mockRejectedValueOnce(new Error('Network Error'));

    const screen: any = await render(<PabiliReviewScreen navigation={navigation} route={route} />);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('submit-errand-items-button'));
    });

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Errand not sent', expect.any(String)));
    const kept = pabiliDraftStore.getSnapshot();
    expect(kept && allRows(kept).map(({ row }) => row.name)).toEqual(['Rice']);
    expect(kept?.submitStartedAt).toBeNull();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('shows the way back when there is nothing to review', async () => {
    await begin(emptyDraft([GROCERY]));
    const screen: any = await render(<PabiliReviewScreen navigation={navigation} route={route} />);
    expect(screen.getByTestId('review-empty')).toBeTruthy();
  });
});
