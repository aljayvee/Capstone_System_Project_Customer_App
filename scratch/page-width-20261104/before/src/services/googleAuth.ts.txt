import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebase/config';

declare const process: { env: Record<string, string | undefined> };

const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '39494270128-6cp0uhbuj4oqvqhgcjtoaut40htat9fo.apps.googleusercontent.com';

let isConfigured = false;

export function configureGoogleSignIn(): void {
  if (isConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: false,
    });
    isConfigured = true;
  } catch (error) {
    console.warn('[GoogleAuth] Failed to configure GoogleSignin:', error);
  }
}

export interface GoogleAuthResult {
  firebaseIdToken: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  googleUid: string;
}

/**
 * Initiates native Android/iOS Google Play Services account picker,
 * exchanges credential with Firebase Auth, and returns verified tokens and user info.
 */
export async function signInWithGoogleNative(): Promise<GoogleAuthResult | null> {
  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response: any = await GoogleSignin.signIn();

    // v16+ returns { type: 'cancelled', data: null } if the user backs out or dismisses the sheet
    if (response?.type === 'cancelled') {
      return null;
    }

    // Support both v13+ response structure ({ data: { idToken, user } }) and legacy
    const idToken = response?.data?.idToken || response?.idToken;
    const user = response?.data?.user || response?.user;

    if (!idToken) {
      if (response?.type === 'noSavedCredentialFound') {
        return null;
      }
      throw new Error('Google Sign-In did not return an ID token. Please check configuration.');
    }

    // Exchange Google credential with Firebase Auth
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseIdToken = await userCredential.user.getIdToken();

    const email = userCredential.user.email || user?.email || '';
    const displayName = userCredential.user.displayName || user?.name || '';
    const nameParts = displayName.trim().split(/\s+/);
    const firstName = user?.givenName || nameParts[0] || 'Customer';
    const lastName = user?.familyName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    return {
      firebaseIdToken,
      email,
      name: displayName,
      firstName,
      lastName,
      photoUrl: userCredential.user.photoURL || user?.photo || null,
      googleUid: userCredential.user.uid,
    };
  } catch (error: any) {
    const code = String(error?.code || '');
    if (
      code === statusCodes.SIGN_IN_CANCELLED ||
      code === '12501' ||
      error?.message?.toLowerCase().includes('cancel')
    ) {
      // User cancelled the sign-in flow gracefully
      return null;
    }
    if (code === statusCodes.IN_PROGRESS || code === '12502') {
      // Operation is in progress already
      return null;
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE || code === '12500') {
      throw new Error('Google Play Services is not available or outdated on this device.');
    }
    if (code === '10' || code === 'DEVELOPER_ERROR') {
      throw new Error(
        'Google Sign-In Configuration Error (10): Ensure your SHA-1 is added in Firebase and download the latest google-services.json.'
      );
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Google Sign-In provider is disabled in Firebase Authentication console. Please enable it in Firebase.'
      );
    }
    console.error('[GoogleAuth] Error during native Google sign-in:', error);
    throw error;
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
    await auth.signOut();
  } catch {
    // Non-blocking cleanup
  }
}
