import { useEffect, useSyncExternalStore } from 'react';
import { pabiliSubmissionStore } from '../services/pabiliSubmission';

export function usePabiliSubmission(userId: string | number) {
  const ownerId = String(userId);
  const state = useSyncExternalStore(pabiliSubmissionStore.subscribe, pabiliSubmissionStore.getSnapshot, pabiliSubmissionStore.getSnapshot);
  useEffect(() => { void pabiliSubmissionStore.activate(ownerId); }, [ownerId]);
  return state.ownerId === ownerId ? state : { ownerId, phase: 'idle' as const, slow: false };
}
