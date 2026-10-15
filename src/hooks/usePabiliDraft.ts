import { useSyncExternalStore } from 'react';
import { pabiliDraftStore, type PabiliDraft } from '../services/pabiliDraft';

/** The pabili list being written, shared by the hub, the store editor and the review. */
export function usePabiliDraft(): PabiliDraft | null {
  return useSyncExternalStore(pabiliDraftStore.subscribe, pabiliDraftStore.getSnapshot, pabiliDraftStore.getSnapshot);
}
