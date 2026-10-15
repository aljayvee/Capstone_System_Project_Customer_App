jest.mock('../services/apiClient', () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
}));
jest.mock('../firebase/location', () => ({ saveCustomerLocation: jest.fn(() => Promise.resolve()) }));
jest.mock('../services/chatSystemMessages', () => ({ postOrderSubmitted: jest.fn(() => Promise.resolve()) }));

import { addTypedLines, emptyDraft, withStores } from '../services/pabiliDraft';
import { buildErrandPayload, submitPabili } from '../services/pabiliSubmit';
import { apiClient } from '../services/apiClient';
import { postOrderSubmitted } from '../services/chatSystemMessages';

/**
 * What a reviewed list becomes on the wire. The size goes apart from the name
 * and the count goes in quantity: "5 Kilo of Chicken 2qty" reaches the server
 * as Chicken, 5 kg, 2, so the rider reads it and the handling fee counts 2.
 */

const GROCERY = 'Supermarket & Grocery';
const PHARMACY = 'Pharmacy & Health';
const location = { address: 'Purok 1, Tacurong', latitude: 6.69, longitude: 124.68, streetName: 'Rizal St', landmark: null, notes: null };

beforeEach(() => jest.clearAllMocks());

const draft = () => {
  let d = emptyDraft([GROCERY, PHARMACY]);
  d = addTypedLines(d, GROCERY, '5 Kilo of Chicken 2qty', 1);
  d = addTypedLines(d, PHARMACY, 'Paracetamol 500mg', 3);
  return d;
};

it('sends size and quantity apart from the name, per store', () => {
  const payload = buildErrandPayload(draft(), location, 7);
  expect(payload.storeCount).toBe(2);
  expect(payload.pabiliItems).toEqual([
    { itemName: 'Chicken', storeCategory: GROCERY, quantity: 2, size: '5 kg', notes: null, unitPrice: 0, estimatedSubtotal: 0 },
    { itemName: 'Paracetamol', storeCategory: PHARMACY, quantity: 3, size: '500 mg', notes: null, unitPrice: 0, estimatedSubtotal: 0 },
  ]);
  expect(payload).toMatchObject({ deliveryAddress: location.address, deliveryStreetName: 'Rizal St' });
});

it('creates the errand, then opens the chat with the order', async () => {
  (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { id: 'E-1', deliveryFee: 60 } });
  const errandId = await submitPabili(draft(), location, 7);
  expect(errandId).toBe('E-1');
  expect(apiClient.post).toHaveBeenCalledWith('/errands', expect.objectContaining({ storeCount: 2 }));
  expect(postOrderSubmitted).toHaveBeenCalledWith(
    'E-1',
    expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ itemName: 'Chicken', size: '5 kg' })]) })
  );
});

it('fails the send only when the errand itself was not created', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));
  await expect(submitPabili(draft(), location, 7)).rejects.toThrow('Network Error');
  expect(postOrderSubmitted).not.toHaveBeenCalled();
});

describe('stores picked in the Location list', () => {
  const mercury = {
    key: 'Mercury Drug',
    name: 'Mercury Drug',
    address: 'Mabini St',
    latitude: 6.69,
    longitude: 124.68,
    placeId: null,
    categoryId: 3,
    categoryName: 'Pharmacy',
  };
  const nena = { ...mercury, key: 'Aling Nena', name: 'Aling Nena', placeId: 'uuid-1', categoryId: null, categoryName: null };

  const picked = () => {
    let d = withStores(emptyDraft([]), [mercury, nena]);
    d = addTypedLines(d, 'Mercury Drug', 'Biogesic', 2);
    d = addTypedLines(d, 'Aling Nena', 'Coke 1.5L', 1);
    return d;
  };

  it('sends each store as a pin, and each item by its store with that store\'s category', () => {
    const payload = buildErrandPayload(picked(), location, 7);
    expect(payload.stores).toEqual([
      { name: 'Mercury Drug', latitude: 6.69, longitude: 124.68, placeId: null, categoryId: 3 },
      { name: 'Aling Nena', latitude: 6.69, longitude: 124.68, placeId: 'uuid-1', categoryId: null },
    ]);
    expect(payload.pabiliItems.map((i) => [i.itemName, i.storeCategory, (i as { storeIndex?: number }).storeIndex])).toEqual([
      ['Biogesic', 'Pharmacy', 0],
      // No category worked out: nothing rather than null, which the server refuses.
      ['Coke', undefined, 1],
    ]);
    expect(payload).toMatchObject({ storeCount: 2, description: 'Pabili Stores: Mercury Drug, Aling Nena', pickupAddress: 'Mercury Drug, Aling Nena' });
  });

  it('leaves a merchant-category list as it always was', () => {
    const payload = buildErrandPayload(draft(), location, 7);
    expect(payload.stores).toBeUndefined();
    expect(payload.description).toBe(`Pabili Store Categories: ${GROCERY}, ${PHARMACY}`);
  });
});
