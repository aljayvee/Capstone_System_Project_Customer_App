import { push, ref } from 'firebase/database';
import { database } from '../firebase/config';
import type { DeliveryLocation } from '../hooks/useDefaultDeliveryLocation';
import { apiClient } from './apiClient';
import { toApiError } from './ApiError';
import { buildErrandPayload, publishSubmittedPabili, submitPabili } from './pabiliSubmit';
import { pabiliDraftStore, readStoredDraft, type PabiliDraft } from './pabiliDraft';

const configuredTimeout = Number(process.env.EXPO_PUBLIC_ORDER_SUBMISSION_TIMEOUT_MS);
export const ORDER_SUBMISSION_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout >= 10000
  ? Math.min(configuredTimeout, 120000) : 30000;
export const ORDER_SUBMISSION_SLOW_MS = 8000;

export interface SubmissionState {
  ownerId: string | null;
  phase: 'idle' | 'sending' | 'unconfirmed' | 'rejected' | 'confirmed';
  slow: boolean;
  submissionId?: string;
  errandId?: string;
  error?: unknown;
  storageFailed?: boolean;
  restoreFailed?: boolean;
}

/** Survives screen unmounts. The durable request itself lives in pabiliDraft. */
export class PabiliSubmissionStore {
  private state: SubmissionState = { ownerId: null, phase: 'idle', slow: false };
  private listeners = new Set<() => void>();
  private attempt = 0;
  private hydration: Promise<void> | null = null;
  private slowTimer?: ReturnType<typeof setTimeout>;
  private timeoutTimer?: ReturnType<typeof setTimeout>;
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private set(patch: Partial<SubmissionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private clearTimers() { clearTimeout(this.slowTimer); clearTimeout(this.timeoutTimer); }
  private current(ownerId: string, id: string) {
    return this.state.ownerId === ownerId && this.state.submissionId === id && this.state.phase !== 'confirmed';
  }

  activate(ownerId: string, force = false): Promise<void> {
    if (!force && this.state.ownerId === ownerId) return this.hydration ?? Promise.resolve();
    this.clearTimers();
    this.attempt++;
    if (pabiliDraftStore.ownerId !== ownerId) pabiliDraftStore.detach();
    this.set({ ownerId, phase: 'idle', slow: false, submissionId: undefined, errandId: undefined, error: undefined, restoreFailed: false, storageFailed: false });
    const task = (async () => {
      const draft = !force && pabiliDraftStore.ownerId === ownerId
        ? pabiliDraftStore.getSnapshot() : await readStoredDraft(ownerId, Date.now(), true);
      if (this.state.ownerId !== ownerId || !draft) return;
      if (force || pabiliDraftStore.ownerId !== ownerId || draft.submission) pabiliDraftStore.begin(ownerId, draft);
      if (!draft.submission) return;
      const id = draft.submission.id;
      this.set({ phase: 'unconfirmed', submissionId: id });
      if (draft.submission.confirmedErrandId) {
        this.confirm(ownerId, id, draft.submission.confirmedErrandId);
        return;
      }
      // Storage hydration finishes before background reconciliation, so a manual
      // retry waits for the saved identity, not for another slow network lookup.
      void this.recover(ownerId, draft);
    })().catch((error) => {
      if (this.state.ownerId === ownerId) this.set({ phase: 'rejected', storageFailed: true, restoreFailed: true, error });
    });
    // Hydration must not hold a manual retry behind a slow recovery lookup.
    this.hydration = task;
    void task.finally(() => { if (this.hydration === task) this.hydration = null; });
    return task;
  }

  private async lookup(id: string): Promise<{ id: string; deliveryFee?: number } | null> {
    const { data } = await apiClient.get(`/errands/submissions/${encodeURIComponent(id)}`, { timeout: 15000 });
    // Refuse a legacy/unsupported API rather than silently creating unsafe retries.
    if (data?.submissionId !== id) throw new Error('Submission lookup unavailable');
    if (data.status === 'CONFIRMED' && data.errand?.id) return data.errand;
    if (data.status === 'NOT_FOUND' && data.errand === null) return null;
    throw new Error('Invalid submission status');
  }

  private async recover(ownerId: string, draft: PabiliDraft) {
    const submission = draft.submission!;
    try {
      const found = await this.lookup(submission.id);
      if (found && this.current(ownerId, submission.id)) {
        publishSubmittedPabili(draft, submission.location, ownerId, found);
        this.confirm(ownerId, submission.id, String(found.id));
      }
    } catch { /* An offline recovery leaves the saved request available for retry. */ }
  }

  async start(ownerId: string, location?: DeliveryLocation | null): Promise<void> {
    if (this.state.ownerId !== ownerId) await this.activate(ownerId);
    else if (this.hydration) await this.hydration;
    if (this.state.restoreFailed) await this.activate(ownerId, true);
    if (this.state.restoreFailed) return;
    if (this.state.ownerId !== ownerId || this.state.phase === 'sending') return;
    const existing = pabiliDraftStore.getSnapshot();
    if (!existing || pabiliDraftStore.ownerId !== ownerId || (!existing.submission && !location)) return;
    const attempt = ++this.attempt;
    this.clearTimers();
    this.set({ phase: 'sending', slow: false, error: undefined, storageFailed: false, errandId: undefined });
    this.slowTimer = setTimeout(() => this.set({ slow: true }), ORDER_SUBMISSION_SLOW_MS);
    this.timeoutTimer = setTimeout(() => this.set({ phase: 'unconfirmed' }), ORDER_SUBMISSION_TIMEOUT_MS);
    let draft: PabiliDraft;
    try {
      if (existing.submission) draft = existing;
      else {
        // Firebase push keys are generated locally; this performs no network write.
        const key = push(ref(database, 'submissionIds')).key;
        if (!key) throw new Error('Cannot generate submission identity');
        const id = `submission-${key}`;
        this.set({ submissionId: id });
        draft = await pabiliDraftStore.freezeSubmission(ownerId, {
          id, payload: { ...buildErrandPayload(existing, location!, ownerId), submissionId: id }, location: location!,
        });
      }
    } catch (error) {
      if (this.state.ownerId === ownerId && attempt === this.attempt) {
        this.clearTimers();
        this.set({ phase: 'rejected', error, storageFailed: true });
      }
      return;
    }
    const submission = draft.submission!;
    if (this.state.ownerId !== ownerId) return;
    this.set({ submissionId: submission.id });
    let posting = false;
    try {
      const found = await this.lookup(submission.id);
      if (!this.current(ownerId, submission.id) || attempt !== this.attempt) return;
      if (found) {
        publishSubmittedPabili(draft, submission.location, ownerId, found);
        this.confirm(ownerId, submission.id, String(found.id));
        return;
      }
      const sent = await pabiliDraftStore.markSubmissionSent(ownerId, submission.id);
      if (!this.current(ownerId, submission.id) || attempt !== this.attempt) return;
      posting = true;
      const errandId = await submitPabili(sent, submission.location, ownerId, sent.submission);
      // Even a superseded attempt's late success settles this same submission.
      this.confirm(ownerId, submission.id, errandId);
    } catch (error) {
      if (!this.current(ownerId, submission.id) || attempt !== this.attempt) return;
      this.clearTimers();
      const status = toApiError(error).status;
      // A retry's rejection cannot disprove an earlier request still in flight.
      if (posting && !submission.postStarted && (status === 400 || status === 422)) {
        try {
          await pabiliDraftStore.rejectSubmission(ownerId, submission.id);
          if (this.current(ownerId, submission.id)) this.set({ phase: 'rejected', error });
        } catch { this.set({ phase: 'unconfirmed', error }); }
      } else this.set({ phase: 'unconfirmed', error });
    }
  }

  private confirm(ownerId: string, id: string, errandId: string) {
    if (!this.current(ownerId, id)) return;
    this.clearTimers();
    this.set({ phase: 'confirmed', errandId, slow: false, error: undefined });
    void pabiliDraftStore.confirmSubmission(ownerId, id, errandId);
  }

  acknowledge() {
    if (this.state.phase === 'confirmed') this.set({ phase: 'idle', errandId: undefined, submissionId: undefined });
  }

  deactivate() {
    this.clearTimers();
    this.attempt++;
    this.hydration = null;
    this.set({ ownerId: null, phase: 'idle', slow: false, submissionId: undefined, errandId: undefined, error: undefined });
    pabiliDraftStore.detach();
  }

}

export const pabiliSubmissionStore = new PabiliSubmissionStore();
