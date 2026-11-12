import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => { mockStorage.set(key, value); return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { mockStorage.delete(key); return Promise.resolve(); }),
}));
jest.mock('../services/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../firebase/location', () => ({ saveCustomerLocation: jest.fn(() => Promise.resolve()) }));
jest.mock('../services/chatSystemMessages', () => ({ postOrderSubmitted: jest.fn(() => Promise.resolve()) }));

import PendingOrderCard from '../components/pabili/PendingOrderCard';
import { apiClient } from '../services/apiClient';
import { addTypedLines, emptyDraft, pabiliDraftStore } from '../services/pabiliDraft';
import { pabiliSubmissionStore } from '../services/pabiliSubmission';

const user = { id: '7' };
const navigation = { navigate: jest.fn() };
const location = { address: 'Saved address', latitude: 6.69, longitude: 124.68, streetName: null, landmark: null, notes: null };
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

beforeEach(async () => {
  jest.useFakeTimers();
  pabiliSubmissionStore.deactivate();
  await settle();
  mockStorage.clear();
  jest.clearAllMocks();
  (apiClient.get as jest.Mock).mockImplementation((url: string) => Promise.resolve({ data: {
    submissionId: url.split('/').pop(), status: 'NOT_FOUND', errand: null,
  } }));
  pabiliDraftStore.begin('7', addTypedLines(emptyDraft(['Grocery']), 'Grocery', 'Rice', 1));
  await pabiliSubmissionStore.activate('7');
});
afterEach(async () => {
  await act(async () => { pabiliSubmissionStore.deactivate(); await settle(); });
  jest.useRealTimers();
});

it('keeps the pending request in history and refreshes on late success without forcing navigation', async () => {
  let confirm!: () => void;
  (apiClient.post as jest.Mock).mockImplementation((_url: string, body: any) => new Promise((resolve) => {
    confirm = () => resolve({ data: { id: 'E-1', submissionId: body.submissionId } });
  }));
  const pending = pabiliSubmissionStore.start('7', location);
  await settle();
  await jest.advanceTimersByTimeAsync(30000);
  const onConfirmed = jest.fn();
  const screen = await render(<PendingOrderCard user={user} navigation={navigation} onConfirmed={onConfirmed} />);
  expect(screen.getByText('Awaiting confirmation')).toBeTruthy();
  await act(async () => { confirm(); await pending; await settle(); });
  expect(screen.getByText('Order submitted')).toBeTruthy();
  expect(onConfirmed).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('pending-order-action'));
  expect(navigation.navigate).toHaveBeenCalledWith('ErrandDetails', { user, errandId: 'E-1' });
});

it('offers retry from history using the saved submission instead of creating a new request', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Lost response'));
  await pabiliSubmissionStore.start('7', location);
  const body = (apiClient.post as jest.Mock).mock.calls[0][1];
  (apiClient.post as jest.Mock).mockImplementation((_url: string, retried: any) => Promise.resolve({ data: {
    id: 'E-1', submissionId: retried.submissionId,
  } }));
  const screen = await render(<PendingOrderCard user={user} navigation={navigation} onConfirmed={jest.fn()} />);
  await act(async () => { await fireEvent.press(screen.getByTestId('pending-order-action')); await settle(); });
  expect((apiClient.post as jest.Mock).mock.calls[1][1]).toEqual(body);
  expect(screen.getByText('Order submitted')).toBeTruthy();
});
