import { isStoreMismatch, storeKind } from '../utils/storeFit';

/**
 * When an item listed under one store earns an "Are you sure?". Only a store
 * that does not stock that kind of thing at all: a question asked about bread
 * at a supermarket would teach customers to ignore the question.
 */

it.each([
  ['Supermarket & Grocery', 'grocery'],
  ['Pharmacy & Health', 'pharmacy'],
  ['Fast Food & Restaurant', 'food'],
  ['Bakery & Snacks', 'bakery'],
  ['Retail & General Merchandise', 'retail'],
  ['Pay Bills', 'other'],
  // Production's names on 2026-10-06.
  ['Fast Food', 'food'],
  ['Restaurant', 'food'],
  ['Pharmacy', 'pharmacy'],
  ['Bread & Pastry', 'bakery'],
  ['Convenience Store', 'convenience'],
])('%s is a %s store', (name, kind) => {
  expect(storeKind(name)).toBe(kind);
});

it.each([
  ['Supermarket & Grocery', 'Pharmacy & Health', true],
  ['Fast Food & Restaurant', 'Supermarket & Grocery', true],
  ['Pharmacy & Health', 'Fast Food & Restaurant', true],
  ['Bakery & Snacks', 'Pharmacy & Health', true],
  // Stocked there as well, so never questioned.
  ['Supermarket & Grocery', 'Bakery & Snacks', false],
  ['Supermarket & Grocery', 'Retail & General Merchandise', false],
  ['Pharmacy & Health', 'Retail & General Merchandise', false],
  ['Convenience Store', 'Supermarket & Grocery', false],
  ['Supermarket & Grocery', 'Convenience Store', false],
  ['Pharmacy', 'Convenience Store', false],
  // Siopao and drinks: the model says Convenience Store, Chowking and bakeries sell them.
  ['Fast Food', 'Convenience Store', false],
  ['Bread & Pastry', 'Convenience Store', false],
  ['Restaurant', 'Fast Food', false],
  ['Bread & Pastry', 'Pharmacy', true],
  ['Fast Food', 'Pharmacy', true],
  ['Convenience Store', 'Fast Food', true],
  // Same store, or a store whose kind is unknown.
  ['Pharmacy & Health', 'pharmacy & health', false],
  ['Pay Bills', 'Pharmacy & Health', false],
  ['Supermarket & Grocery', 'Pay Bills', false],
])('%s, item usually from %s: question it is %s', (listed, usual, expected) => {
  expect(isStoreMismatch(listed, usual)).toBe(expected);
});

it.each([
  ['Bread & Pastry', 'Pandesal'],
  ['Fast Food', 'Burger & Fries Meal'],
  ['Restaurant', 'Burger & Fries Meal'],
  ['Convenience Store', 'Bottled Water'],
  ['Pharmacy', 'Paracetamol'],
])('%s gets chips starting with %s, whatever the owner named it', (store, first) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { quickSuggestionsFor } = require('../constants/pabili');
  expect(quickSuggestionsFor(store)[0].name).toBe(first);
});
