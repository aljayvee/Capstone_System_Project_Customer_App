import { onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth, isFirebaseAuthConfigured } from './config';
import { apiClient, refreshCustomerSession } from '../services/apiClient';

/**
 * This app's Firebase identity, derived from the session it already holds.
 *
 * ## What this replaces
 *
 * Nothing. There was no Firebase identity: `getDatabase()` was called and
 * subscribed to as an anonymous client, which is why the Realtime Database
 * rules had to be wide open for chat and rider tracking to work at all, and why
 * tightening them stopped both without a single error message anywhere.
 *
 * ## Not a second sign-in
 *
 * The customer authenticates once, through the existing JWT flow, which is a
 * [LOCKED] contract and is untouched here. `POST /auth/firebase-token` exchanges
 * that proven session for a Firebase-shaped assertion of the same identity, so
 * the security rules can check who is asking. No password is typed twice and
 * there is no second user store.
 *
 * ## Why the session is not persisted
 *
 * `config.ts` pins in-memory persistence, so this Firebase session dies with the
 * process. That is the correct lifetime: the app always restores its own JWT
 * session on launch and can mint a fresh token from it in one round trip. A
 * persisted Firebase credential would be able to outlive the session that
 * justified it, which is the failure mode that made stale RTDB records report
 * long-dead riders as online.
 */

let inFlight: Promise<boolean> | null = null;

/**
 * Whether the signed-in Firebase user is the one the server minted for this
 * app, `customer_<id>`, which is the only uid the Realtime Database rules know.
 *
 * Not just "is anyone signed in". Google sign-in (services/googleAuth.ts) signs
 * this same Firebase instance in as the customer's Google account, to get the ID
 * token `/customers/google-login` verifies. That user has Google's uid, so after
 * a Google sign-in every chat, the live rider pin and location sharing were
 * refused until the app was restarted (2026-10-08), while this file reported
 * itself signed in and never minted the right identity.
 */
function hasCustomerIdentity(): boolean {
  return String(auth.currentUser?.uid ?? '').startsWith('customer_');
}

export type RealtimeAuthState = 'signed-in' | 'signed-out' | 'unavailable';

let lastState: RealtimeAuthState = 'signed-out';
const listeners = new Set<(state: RealtimeAuthState) => void>();

function publish(state: RealtimeAuthState) {
  lastState = state;
  listeners.forEach((listener) => listener(state));
}

export function onRealtimeAuthChange(listener: (state: RealtimeAuthState) => void): () => void {
  listeners.add(listener);
  listener(lastState);
  return () => {
    listeners.delete(listener);
  };
}

export function realtimeAuthState(): RealtimeAuthState {
  return lastState;
}

/**
 * Asks the server for a custom token, refreshing an aged-out session once.
 *
 * This call spends an access token like any other, but its URL matches the
 * `/auth/` arm of `CREDENTIAL_ENDPOINTS` in apiClient.ts, so the interceptor
 * passes its 401 straight through instead of refreshing. On a relaunch the
 * stored access token has usually expired, so every other launch request
 * recovered while this one did not, and the app came up with no Firebase
 * session: every chat refused, and "Try again" could not fix it. That matcher
 * is [LOCKED], so the one refresh-and-retry happens here, through the same
 * single-flight refresh the interceptor and the socket use.
 */
async function requestFirebaseToken() {
  try {
    return await apiClient.post('/auth/firebase-token');
  } catch (err) {
    if ((err as { status?: number } | null)?.status !== 401) throw err;
    await refreshCustomerSession();
    return apiClient.post('/auth/firebase-token');
  }
}

/**
 * Ensures this device has a Firebase session, minting one if it does not.
 *
 * Resolves false rather than throwing. Losing real-time must degrade the live
 * map and the chat thread, never break the app: placing and tracking an errand
 * runs over the REST API and is unaffected by anything in this file.
 *
 * Single-flighted, because several screens can ask at once on a cold start and
 * each extra exchange would churn a token for nothing.
 */
export async function ensureRealtimeSession(): Promise<boolean> {
  if (!isFirebaseAuthConfigured) {
    publish('unavailable');
    return false;
  }

  if (hasCustomerIdentity()) {
    publish('signed-in');
    return true;
  }

  return mintAndSignIn();
}

/**
 * Mints and signs in again even though a customer identity is present.
 *
 * For a listener the database just refused. A refusal is never the network:
 * offline, the database waits and resyncs without cancelling anything. It
 * means the connection is not presenting an identity the rules accept, most
 * often an ID token that expired while the phone slept, and that the device
 * still reports as signed in. ensureRealtimeSession sees `customer_<id>` and
 * returns at once, so retrying through it reused the refused identity and
 * could not recover (2026-10-11). A fresh sign-in pushes a new token onto the
 * open connection before the caller resubscribes.
 */
export async function renewRealtimeSession(): Promise<boolean> {
  if (!isFirebaseAuthConfigured) {
    publish('unavailable');
    return false;
  }
  return mintAndSignIn();
}

/** Single-flighted, so a renewal and a first sign-in share one exchange. */
function mintAndSignIn(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await requestFirebaseToken();
      const token = res.data?.token;
      if (!token) throw new Error('No token in response');

      // Replaces any other Firebase user, such as the Google account a Google
      // sign-in leaves behind (see hasCustomerIdentity).
      await signInWithCustomToken(auth, token);
      publish('signed-in');
      return true;
    } catch {
      // Includes the 503 returned when the server has no service account
      // configured. Same handling as any other failure: from here both mean
      // "no real-time identity", and the operator-facing reason is server-side.
      publish('unavailable');
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Waits for the Firebase session to settle, but never for long.
 *
 * Every Realtime Database subscription in this app has to open AFTER sign-in, not
 * before, and the reason is specific rather than defensive: the SDK's
 * `refreshAuthToken` re-authenticates the connection but does NOT re-send
 * outstanding listens — only a reconnect does, via `restoreState_`. So a listener
 * opened one tick too early is refused and then stays refused for the life of the
 * screen, with no retry and, until this change, no error either.
 *
 * Bounded because it sits on the app's startup path. If the mint is slow the app
 * proceeds without waiting; the session still arrives on its own and the next
 * screen to mount gets it. Blocking a customer out of their errand list because a
 * chat credential was slow would be a worse bug than the one this prevents.
 */
export async function settleRealtimeSession(timeoutMs = 4000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      ensureRealtimeSession(),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Drops the Firebase session, so it cannot outlive the account that owns it. */
export async function endRealtimeSession(): Promise<void> {
  if (!isFirebaseAuthConfigured) return;
  try {
    await signOut(auth);
  } catch {
    // Must never block the app's own sign-out, which has already cleared the
    // session that matters.
  }
  publish('signed-out');
}

// Keeps `lastState` honest when the SDK ends a session on its own.
if (isFirebaseAuthConfigured) {
  onAuthStateChanged(auth, (user) => {
    if (!user && lastState === 'signed-in') publish('signed-out');
  });
}
