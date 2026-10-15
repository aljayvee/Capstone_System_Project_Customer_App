import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, initializeAuth, inMemoryPersistence, type Auth } from 'firebase/auth';

declare const process: { env: Record<string, string | undefined> };

const firebaseConfig = {
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://capstonedata-3589c-default-rtdb.asia-southeast1.firebasedatabase.app/',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'capstonedata-3589c',
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'capstonedata-3589c.firebaseapp.com',
};

/**
 * True when this build can authenticate, not merely connect.
 *
 * Without an api key `signInWithCustomToken` fails before it reaches the
 * network, and since the Realtime Database rules now require an identity, that
 * means no chat and no live rider pin. Checked explicitly so the failure is
 * reported as "not configured" rather than surfacing as a mystery permission
 * error at the first subscription.
 */
export const isFirebaseAuthConfigured = Boolean(firebaseConfig.apiKey);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const database = getDatabase(app);

/**
 * Explicit in-memory persistence rather than a bare `getAuth`.
 *
 * On React Native the default warns about missing AsyncStorage persistence and
 * then behaves as in-memory anyway. Stating it removes the warning and, more
 * importantly, makes the lifetime deliberate: this Firebase session is meant to
 * die with the process. The app restores its own JWT session on launch and
 * mints a fresh Firebase token from it in one round trip, so persisting a
 * second credential would only create one that can outlive the session that
 * justified it.
 *
 * `initializeAuth` throws if the app already has an Auth instance, which is
 * reachable under Fast Refresh, so the fallback returns the existing one.
 */
function createAuth(): Auth {
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
