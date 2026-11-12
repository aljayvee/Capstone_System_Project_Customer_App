const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => { mockStorage.set(key, value); return Promise.resolve(); }),
  removeItem: jest.fn((key: string) => { mockStorage.delete(key); return Promise.resolve(); }),
}));
jest.mock('../services/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../firebase/location', () => ({ saveCustomerLocation: jest.fn(() => Promise.resolve()) }));
jest.mock('../services/chatSystemMessages', () => ({ postOrderSubmitted: jest.fn(() => Promise.resolve()) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/apiClient';
import { PabiliSubmissionStore } from '../services/pabiliSubmission';
import { addTypedLines, emptyDraft, pabiliDraftStore, readStoredDraft } from '../services/pabiliDraft';

const location = { address: 'Saved delivery address', latitude: 6.69, longitude: 124.68, streetName: null, landmark: null, notes: null };
let store: PabiliSubmissionStore;
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const absent = (url: string) => ({ data: { submissionId: decodeURIComponent(url.split('/').pop()!), status: 'NOT_FOUND', errand: null } });
const confirmed = (id: string) => ({ data: { submissionId: id, status: 'CONFIRMED', errand: { id: 'E-1', submissionId: id, deliveryFee: 70 } } });

beforeEach(async () => {
  jest.useFakeTimers();
  pabiliDraftStore.detach();
  await settle();
  jest.clearAllMocks();
  mockStorage.clear();
  (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => { mockStorage.set(key, value); return Promise.resolve(); });
  (apiClient.get as jest.Mock).mockImplementation((url: string) => Promise.resolve(absent(url)));
  (apiClient.post as jest.Mock).mockImplementation((_url: string, body: any) => Promise.resolve({ data: { id: 'E-1', submissionId: body.submissionId } }));
  pabiliDraftStore.begin('7', addTypedLines(emptyDraft(['Grocery']), 'Grocery', 'Rice', 2));
  store = new PabiliSubmissionStore();
  await store.activate('7');
});
afterEach(async () => { store.deactivate(); await settle(); jest.useRealTimers(); });

it('persists the frozen identity and contents before any network request and ignores rapid taps', async () => {
  (apiClient.post as jest.Mock).mockImplementation((_url: string, body: any) => {
    const durable = JSON.parse(mockStorage.get('@sugo_pabili_draft:v1:7')!);
    expect(durable.submission.payload).toEqual(body);
    expect(durable.submission.postStarted).toBe(true);
    return Promise.resolve({ data: { id: 'E-1', submissionId: body.submissionId } });
  });
  await Promise.all([store.start('7', location), store.start('7', location), store.start('7', location)]);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot()).toMatchObject({ phase: 'confirmed', errandId: 'E-1' });
});

it('changes copy at 8 seconds, times out at 30, and accepts the original late confirmation', async () => {
  let deliver!: (value: any) => void;
  (apiClient.post as jest.Mock).mockImplementation((_url: string, body: any) => new Promise((resolve) => {
    deliver = () => resolve({ data: { id: 'E-1', submissionId: body.submissionId } });
  }));
  const sending = store.start('7', location);
  await settle();
  expect(store.getSnapshot().phase).toBe('sending');
  await jest.advanceTimersByTimeAsync(8000);
  expect(store.getSnapshot().slow).toBe(true);
  await jest.advanceTimersByTimeAsync(22000);
  expect(store.getSnapshot().phase).toBe('unconfirmed');
  expect(pabiliDraftStore.getSnapshot()?.submission).toBeTruthy();
  deliver({});
  await sending;
  expect(store.getSnapshot()).toMatchObject({ phase: 'confirmed', errandId: 'E-1' });
});

it('checks status on retry and opens the original order without a second POST', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Lost response'));
  await store.start('7', location);
  const id = pabiliDraftStore.getSnapshot()!.submission!.id;
  (apiClient.get as jest.Mock).mockResolvedValueOnce(confirmed(id));
  await store.start('7');
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot()).toMatchObject({ phase: 'confirmed', errandId: 'E-1' });
});

it('reuses exactly the saved payload on retry, blocking edits and changed delivery addresses', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  await store.start('7', location);
  const original = JSON.parse(JSON.stringify(pabiliDraftStore.getSnapshot()!.submission!.payload));
  pabiliDraftStore.update((draft) => ({ ...draft, categories: ['Different store'] }));
  await pabiliDraftStore.clear();
  await store.start('7', { ...location, address: 'A changed address' });
  expect((apiClient.post as jest.Mock).mock.calls.map((call) => call[1])).toEqual([original, original]);
});

it('restores a pending submission after restart, without automatically resending', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Lost response'));
  await store.start('7', location);
  const original = pabiliDraftStore.getSnapshot()!.submission!;
  store.deactivate();
  await settle();
  store = new PabiliSubmissionStore();
  await store.activate('7');
  expect(store.getSnapshot().phase).toBe('unconfirmed');
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  expect(pabiliDraftStore.getSnapshot()?.submission).toEqual(original);
  await store.start('7');
  expect((apiClient.post as jest.Mock).mock.calls[1][1]).toEqual(original.payload);
});

it('retains pending submissions beyond the normal draft expiration', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
  await store.start('7', location);
  expect((await readStoredDraft('7', Date.now() + 30 * 86400000))?.submission?.id).toBeTruthy();
});

it('unlocks the draft only after a definite initial validation rejection', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce({ response: { status: 422, data: {} } });
  await store.start('7', location);
  expect(store.getSnapshot().phase).toBe('rejected');
  expect(pabiliDraftStore.getSnapshot()?.submission).toBeUndefined();
  pabiliDraftStore.update((draft) => ({ ...draft, categories: ['Corrected'] }));
  expect(pabiliDraftStore.getSnapshot()?.categories).toEqual(['Corrected']);
});

it('keeps an earlier uncertain request locked if a later retry is rejected', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Lost response'));
  await store.start('7', location);
  (apiClient.post as jest.Mock).mockRejectedValueOnce({ response: { status: 422, data: {} } });
  await store.start('7');
  expect(store.getSnapshot().phase).toBe('unconfirmed');
  expect(pabiliDraftStore.getSnapshot()?.submission).toBeTruthy();
});

it('does not send when durable storage fails', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));
  await store.start('7', location);
  expect(store.getSnapshot()).toMatchObject({ phase: 'rejected', storageFailed: true });
  expect(apiClient.get).not.toHaveBeenCalled();
  expect(apiClient.post).not.toHaveBeenCalled();
});

it('does not fall back to unsafe creation against an unsupported server', async () => {
  (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });
  await store.start('7', location);
  expect(store.getSnapshot().phase).toBe('unconfirmed');
  expect(apiClient.post).not.toHaveBeenCalled();
});

it('ignores a superseded failure after a retry has confirmed the same order', async () => {
  let failOriginal!: (error: any) => void;
  (apiClient.post as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => { failOriginal = reject; }));
  const original = store.start('7', location);
  await settle();
  await jest.advanceTimersByTimeAsync(30000);
  await store.start('7');
  failOriginal(new Error('Late timeout'));
  await original;
  expect(store.getSnapshot()).toMatchObject({ phase: 'confirmed', errandId: 'E-1' });
  const calls = (apiClient.post as jest.Mock).mock.calls;
  expect(calls[0][1]).toEqual(calls[1][1]);
});

it('does not POST an old account’s request after the account changes during lookup', async () => {
  let finishLookup!: (value: any) => void;
  (apiClient.get as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finishLookup = resolve; }));
  const original = store.start('7', location);
  await settle();
  const id = pabiliDraftStore.getSnapshot()!.submission!.id;
  await store.activate('8');
  finishLookup(absent(`/errands/submissions/${id}`));
  await original;
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(store.getSnapshot().ownerId).toBe('8');
  expect((await readStoredDraft('7'))?.submission?.id).toBe(id);
});


it('waits for storage hydration before retrying, preserving a saved pending identity', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Lost response'));
  await store.start('7', location);
  const original = pabiliDraftStore.getSnapshot()!.submission!;
  store.deactivate();
  await settle();
  const saved = mockStorage.get('@sugo_pabili_draft:v1:7')!;
  let finishRead!: (value: string) => void;
  (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
  store = new PabiliSubmissionStore();
  const hydrating = store.activate('7');
  await settle();
  // A stale screen must not replace a saved request while disk recovery waits.
  pabiliDraftStore.begin('7', addTypedLines(emptyDraft(['Bakery']), 'Bakery', 'Bread', 1));
  const retrying = store.start('7', location);
  await settle();
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  finishRead(saved);
  await hydrating;
  await retrying;
  expect((apiClient.post as jest.Mock).mock.calls[1][1]).toEqual(original.payload);
});

it('fails closed when a pending request cannot be restored and recovers its identity on retry', async () => {
  (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Lost response'));
  await store.start('7', location);
  const original = pabiliDraftStore.getSnapshot()!.submission!;
  store.deactivate();
  await settle();
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
  store = new PabiliSubmissionStore();
  await store.activate('7');
  expect(store.getSnapshot()).toMatchObject({ phase: 'rejected', restoreFailed: true });
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
  await store.start('7', location);
  expect(apiClient.post).toHaveBeenCalledTimes(1);
  await store.start('7', location);
  expect((apiClient.post as jest.Mock).mock.calls[1][1]).toEqual(original.payload);
  expect(store.getSnapshot()).toMatchObject({ phase: 'confirmed', errandId: 'E-1' });
});
