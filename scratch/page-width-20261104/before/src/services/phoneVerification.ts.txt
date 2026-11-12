import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { apiClient } from './apiClient';

/**
 * Verifies a Philippine mobile number by SMS code.
 *
 * The code is sent and checked by Firebase on the portal's verify-phone page
 * (Firebase phone sign-in needs a web reCAPTCHA), opened in an auth browser
 * session; the page redirects back to the app with a Firebase ID token for the
 * number. The token is then shown to `POST /customers/verify-phone-firebase`,
 * which, for a signed-in customer, marks the number verified on the account.
 *
 * Shared by Edit Account and the Home tab's "verify your number" reminder, so
 * both verify the same way. Never throws: the caller gets a result to show.
 */
export type PhoneVerificationResult =
  /** `confirmed`: the server recorded it. False keeps the token, which a profile save sends again. */
  | { status: 'verified'; idToken: string; confirmed: boolean; error?: unknown }
  | { status: 'cancelled' }
  | { status: 'failed'; error: unknown };

/** "+639171234567" from "9171234567", "09171234567", "639171234567" or "+63 917 123 4567". */
export function toPhilippineE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const ten = digits.length === 12 && digits.startsWith('63') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return ten.length === 10 && ten.startsWith('9') ? `+63${ten}` : null;
}

export type MfaSmsResult =
  | { status: 'verified'; idToken: string }
  | { status: 'cancelled' }
  | { status: 'failed'; error: unknown };

/**
 * The second sign-in factor by SMS. Same portal page, `purpose=mfa`: the
 * customer is not signed in yet, so the app never puts the full number in the
 * URL, only `hint` (the last four digits the server sent) for the page to show.
 * The returned ID token goes to `POST /auth/verify-login-otp`, which checks
 * it against the account's number; nothing is posted here. Never throws.
 */
export async function verifyLoginBySms(phoneHint: string | null | undefined): Promise<MfaSmsResult> {
  try {
    const redirectUrl = Linking.createURL('mfa-verified');
    const hint = (phoneHint || '').replace(/\D/g, '').slice(-4);
    const authUrl =
      `https://portal.sugo-express.org/verify-phone?purpose=mfa` +
      (hint ? `&hint=${encodeURIComponent(hint)}` : '') +
      `&redirect=${encodeURIComponent(redirectUrl)}`;
    const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (authResult.type !== 'success' || !authResult.url) return { status: 'cancelled' };
    const token = (Linking.parse(authResult.url).queryParams?.token as string) || null;
    if (!token) return { status: 'cancelled' };
    return { status: 'verified', idToken: token };
  } catch (error) {
    return { status: 'failed', error };
  }
}

export async function verifyPhoneBySms(phone: string): Promise<PhoneVerificationResult> {
  const fullPhone = toPhilippineE164(phone);
  if (!fullPhone) return { status: 'failed', error: new Error('Enter a 10-digit number starting with 9.') };

  try {
    const redirectUrl = Linking.createURL('phone-verified');
    const authUrl = `https://portal.sugo-express.org/verify-phone?phone=${encodeURIComponent(fullPhone)}&redirect=${encodeURIComponent(redirectUrl)}`;
    const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (authResult.type !== 'success' || !authResult.url) return { status: 'cancelled' };
    const token = (Linking.parse(authResult.url).queryParams?.token as string) || null;
    if (!token) return { status: 'cancelled' };

    try {
      await apiClient.post('/customers/verify-phone-firebase', { idToken: token, phone: fullPhone });
    } catch (error) {
      // The token still proves the number: Edit Account sends it again with
      // the profile save. The Home reminder has nothing to save, so it reports.
      return { status: 'verified', idToken: token, confirmed: false, error };
    }
    return { status: 'verified', idToken: token, confirmed: true };
  } catch (error) {
    return { status: 'failed', error };
  }
}
