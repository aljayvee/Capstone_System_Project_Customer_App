import * as SecureStore from 'expo-secure-store';

/**
 * The server-issued token that says this device passed the second sign-in
 * factor in the last 30 days. Sent as `mfaTrustToken` with a password or
 * Google sign-in so the server can skip the code on a device it already knows.
 *
 * It marks the device, not the session, so logout leaves it in place. Every
 * call swallows keystore failures: the worst a lost token costs is one more
 * code at the next sign-in.
 */
const MFA_TRUST_KEY = 'sugo_customer_mfa_trust';

export async function getMfaTrustToken(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(MFA_TRUST_KEY)) || null;
  } catch {
    return null;
  }
}

export async function saveMfaTrustToken(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    await SecureStore.setItemAsync(MFA_TRUST_KEY, token);
  } catch {
    // Nothing to recover: the next sign-in on this device asks for a code.
  }
}

export async function clearMfaTrustToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MFA_TRUST_KEY);
  } catch {
    // Already gone, or the keystore is unavailable.
  }
}

/** The sign-in body field, present only when this device holds a token. */
export async function mfaTrustField(): Promise<{ mfaTrustToken?: string }> {
  const mfaTrustToken = await getMfaTrustToken();
  return mfaTrustToken ? { mfaTrustToken } : {};
}

export type MfaFactor = 'SMS' | 'EMAIL';

/**
 * A sign-in whose password or Google check passed and which now needs the
 * second factor. `challengeToken` is single use: resending the email code
 * returns a new one.
 */
export interface LoginChallenge {
  challengeToken: string;
  factors: MfaFactor[];
  maskedEmail?: string | null;
  maskedPhone?: string | null;
  /** Last four digits of the account's number. */
  phoneHint?: string | null;
  expiresInSeconds?: number;
}

/**
 * The challenge in a `/customers/login` (`mfaRequired`) or
 * `/customers/google-login` (`status: "MFA_REQUIRED"`) reply, or null for a
 * reply that already signed the customer in. Throws on a challenge with no
 * token, which would otherwise be read as a session with no access token.
 */
export function readLoginChallenge(data: any): LoginChallenge | null {
  if (!data || (data.mfaRequired !== true && data.status !== 'MFA_REQUIRED')) return null;
  if (typeof data.challengeToken !== 'string' || !data.challengeToken) {
    throw new Error('Sign-in challenge is missing its token');
  }
  const factors = (Array.isArray(data.factors) ? data.factors : []).filter(
    (f: unknown): f is MfaFactor => f === 'SMS' || f === 'EMAIL'
  );
  return {
    challengeToken: data.challengeToken,
    // Every account has an email address, so a reply naming no factor still
    // gets one. The rider app reads it the same way.
    factors: factors.length > 0 ? factors : ['EMAIL'],
    maskedEmail: data.maskedEmail ?? null,
    maskedPhone: data.maskedPhone ?? null,
    phoneHint: data.phoneHint ?? null,
    expiresInSeconds: typeof data.expiresInSeconds === 'number' ? data.expiresInSeconds : undefined,
  };
}
