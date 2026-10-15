import { ApiError, toApiError } from './ApiError';

/**
 * Where the failure happened, so the same status code can say the right thing.
 * A 404 on an errand is "that errand is gone"; a 404 on a profile save is not.
 */
export type ErrorContext =
  | 'login'
  | 'register'
  | 'otp'
  | 'password-reset'
  | 'errand'
  | 'chat'
  | 'profile'
  | 'location'
  | 'payment'
  | 'generic';

/**
 * The one retry word. Four different labels used to ship - "Try Again",
 * "Tap to Refresh", "Check Status Now", "Reload from Server" - which reads as
 * four different products. Import this instead of typing a new one.
 */
export const RETRY_LABEL = 'Try again';

export const OFFLINE_MESSAGE = "You're offline. Check your Wi-Fi or mobile data.";
export const TIMEOUT_MESSAGE = 'That took longer than usual. Tap to try again.';
export const GENERIC_MESSAGE = 'Something went wrong. Tap to try again.';
export const SERVER_MESSAGE = 'Sugo is having trouble right now. Try again in a moment.';
export const SESSION_ENDED_MESSAGE = "You've been signed out. Sign in again to continue.";

function formatWait(seconds: number): string {
  if (seconds <= 90) {
    const rounded = Math.max(1, Math.ceil(seconds / 10) * 10);
    return `${rounded} seconds`;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

function notFoundMessage(context: ErrorContext): string {
  switch (context) {
    case 'errand':
      return "We couldn't find that errand. It may have been cancelled.";
    case 'chat':
      return 'This conversation is no longer available.';
    case 'location':
      return "We couldn't find that saved place. It may have been removed.";
    case 'payment':
      return "We couldn't find that payment. Refresh and try again.";
    default:
      return "We couldn't find what you were looking for.";
  }
}

function badRequestMessage(error: ApiError, context: ErrorContext): string {
  // The server's validators already speak plainly ("Password must be at least
  // 6 characters"), and they know things the client does not. Pass those
  // through; invent copy only when there is nothing to pass.
  if (error.serverMessage) return error.serverMessage;

  switch (context) {
    case 'otp':
      return "That code didn't work. Check the digits and try again.";
    case 'login':
      return 'Check your username and password, then try again.';
    default:
      return 'Some details need fixing before we can continue.';
  }
}

function unauthorizedMessage(context: ErrorContext): string {
  switch (context) {
    // Asked for explicitly. Note the server deliberately returns the same 401
    // for an unknown username as for a bad password, so it cannot be used to
    // discover which accounts exist - this line covers both cases.
    case 'login':
      return 'Wrong password.';
    case 'otp':
      return "That code didn't work. Request a new one and try again.";
    case 'password-reset':
      return 'That reset link has expired. Start again to get a new code.';
    default:
      return SESSION_ENDED_MESSAGE;
  }
}

/**
 * The single place an error becomes something a person reads.
 *
 * Never render `error.message` in the UI. The app points at a deployed backend
 * whose text we do not control, and whatever a CDN or WAF in front of it decides
 * to say used to land straight in the login banner. Status codes we do control.
 */
export function toUserMessage(error: unknown, context: ErrorContext = 'generic'): string {
  const apiError = toApiError(error);

  if (apiError.isOffline) return OFFLINE_MESSAGE;
  if (apiError.isTimeout) return TIMEOUT_MESSAGE;

  const status = apiError.status;
  if (status === undefined) return GENERIC_MESSAGE;

  if (status === 401) return unauthorizedMessage(context);

  if (status === 403) {
    // requireRole and the account-state guards send a deniedMessage written for
    // the customer ("This account has been deactivated."). Prefer it.
    return apiError.serverMessage || "This account can't do that.";
  }

  if (status === 404) return notFoundMessage(context);

  if (status === 409) {
    return context === 'errand'
      ? 'Someone updated this errand while you were looking. Refresh to see the latest.'
      : 'That changed while you were looking. Refresh to see the latest.';
  }

  if (status === 429) {
    const wait = apiError.retryAfterSeconds;
    return wait
      ? `Too many tries. Wait ${formatWait(wait)} and try again.`
      : 'Too many tries. Wait a few minutes and try again.';
  }

  if (status === 503) {
    return 'Sugo is down for maintenance. We will be back shortly.';
  }

  if (status >= 500) return SERVER_MESSAGE;

  if (status === 400 || status === 422) return badRequestMessage(apiError, context);

  return GENERIC_MESSAGE;
}

/** True when the right response is to send the customer back to sign-in. */
export function isSessionEnded(error: unknown): boolean {
  const apiError = toApiError(error);
  return apiError.status === 401;
}

/** Seconds a 429 asked us to wait, for RateLimitCountdown. */
export function retryAfterSeconds(error: unknown): number | undefined {
  const apiError = toApiError(error);
  return apiError.status === 429 ? apiError.retryAfterSeconds : undefined;
}
