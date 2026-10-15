import { push } from 'firebase/database';
import { postOrderSubmitted } from '../services/chatSystemMessages';

/**
 * The order card that opens every errand's chat. No client reads it back as
 * data, so the size travels inside the name: every app version, including a
 * dispatcher's or a rider's built before sizes existed, shows "Chicken · 5 kg".
 */
it('writes each item with its size in the name, in the card and in the text', async () => {
  await postOrderSubmitted('E-1', {
    items: [
      { storeCategory: 'Retail', itemName: 'Chicken', quantity: 2, size: '5 kg' },
      { storeCategory: 'Retail', itemName: 'Eggs', quantity: 1, size: null },
      { storeCategory: 'Retail', itemName: 'Sibuyas', quantity: 1, size: '1/2 kg', notes: 'walang bulok' },
    ],
    deliveryAddress: 'Purok 1',
    categories: ['Retail'],
    deliveryFee: 60,
  });

  const message = (push as jest.Mock).mock.calls.at(-1)[1];
  expect(message.order.items).toEqual([
    { storeCategory: 'Retail', itemName: 'Chicken · 5 kg', quantity: 2 },
    { storeCategory: 'Retail', itemName: 'Eggs', quantity: 1 },
    { storeCategory: 'Retail', itemName: 'Sibuyas · 1/2 kg · Note: walang bulok', quantity: 1 },
  ]);
  expect(message.order.totalUnits).toBe(4);
  expect(message.text).toContain('• 2 × Chicken · 5 kg  (Retail)');
});
