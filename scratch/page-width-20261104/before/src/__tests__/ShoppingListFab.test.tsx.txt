import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => { mockStorage.set(key, value); return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { mockStorage.delete(key); return Promise.resolve(); }),
}));
jest.mock('../services/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

import ShoppingListFab from '../components/home/ShoppingListFab';
import { addChip, emptyDraft, pabiliDraftStore, readStoredDraft, withCategories, withStores, writeStoredDraft } from '../services/pabiliDraft';
import { pabiliSubmissionStore } from '../services/pabiliSubmission';

const user = { id: 'u1', username: 'ana' };
const navigation = { navigate: jest.fn() };
const shop = { key: 'Mercury Drug', name: 'Mercury Drug', address: 'Mabini St', latitude: 6.69, longitude: 124.68, placeId: null, categoryId: 3, categoryName: 'Pharmacy' };

beforeEach(async () => {
  pabiliSubmissionStore.deactivate();
  await readStoredDraft('u1');
  mockStorage.clear();
  await pabiliDraftStore.clear();
  jest.clearAllMocks();
});

it('stays hidden when there is no saved shopping list', async () => {
  const screen: any = await render(<ShoppingListFab user={user} navigation={navigation} />);
  await waitFor(() => expect(pabiliSubmissionStore.getSnapshot().ownerId).toBe('u1'));
  expect(screen.queryByTestId('shopping-list-fab')).toBeNull();
});

it('counts stores instead of item quantities and returns to Stage 2 with the saved pins', async () => {
  const draft = addChip(withStores(emptyDraft([]), [shop]), shop.key, { name: 'Biogesic' });
  pabiliDraftStore.begin('u1', { ...draft, rowsByCategory: { [shop.key]: [{ ...draft.rowsByCategory[shop.key][0], quantity: 9 }] } });
  const screen: any = await render(<ShoppingListFab user={user} navigation={navigation} />);
  expect(screen.getByTestId('shopping-list-fab-count').props.children).toBe(1);
  await fireEvent.press(screen.getByTestId('shopping-list-fab'));
  expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', { user, selectedCats: [shop.key], stores: [shop] });
  expect(pabiliDraftStore.getSnapshot()?.rowsByCategory[shop.key][0].quantity).toBe(9);
});

it('updates the count as stores change and disappears when the list is cleared', async () => {
  pabiliDraftStore.begin('u1', emptyDraft(['Pharmacy']));
  const screen: any = await render(<ShoppingListFab user={user} navigation={navigation} />);
  await act(async () => { pabiliDraftStore.update((draft) => withCategories(draft, ['Pharmacy', 'Bakery'])); });
  expect(screen.getByTestId('shopping-list-fab-count').props.children).toBe(2);
  await act(async () => { await pabiliDraftStore.clear(); });
  expect(screen.queryByTestId('shopping-list-fab')).toBeNull();
});

it('restores the saved store count on Home after an app restart', async () => {
  await writeStoredDraft('u1', emptyDraft(['Pharmacy', 'Bakery']));
  const screen: any = await render(<ShoppingListFab user={user} navigation={navigation} />);
  const count = await screen.findByTestId('shopping-list-fab-count');
  expect(count.props.children).toBe(2);
  await fireEvent.press(screen.getByTestId('shopping-list-fab'));
  expect(navigation.navigate).toHaveBeenCalledWith('ErrandItems', { user, selectedCats: ['Pharmacy', 'Bakery'] });
});

it('never shows a different customer’s store count', async () => {
  pabiliDraftStore.begin('another-user', emptyDraft(['Other customer store']));
  const screen: any = await render(<ShoppingListFab user={user} navigation={navigation} />);
  expect(screen.queryByTestId('shopping-list-fab')).toBeNull();
  await waitFor(() => expect(pabiliSubmissionStore.getSnapshot().ownerId).toBe('u1'));
  expect(screen.queryByTestId('shopping-list-fab')).toBeNull();
});

it('hides the editable list action while an order submission is unresolved', async () => {
  pabiliDraftStore.begin('u1', { ...emptyDraft(['Pharmacy']), submission: {
    id: 'pending', payload: {}, location: { address: 'Mabini St', latitude: 6.69, longitude: 124.68 },
  } });
  const screen: any = await render(<ShoppingListFab user={user} navigation={navigation} />);
  expect(screen.queryByTestId('shopping-list-fab')).toBeNull();
  expect(navigation.navigate).not.toHaveBeenCalled();
});
