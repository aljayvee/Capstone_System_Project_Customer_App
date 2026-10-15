import { ApiError, toApiError } from '../services/ApiError';
import {
  toUserMessage,
  isSessionEnded,
  retryAfterSeconds,
  RETRY_LABEL,
  OFFLINE_MESSAGE,
  TIMEOUT_MESSAGE,
  SERVER_MESSAGE,
  SESSION_ENDED_MESSAGE,
} from '../services/errorMessages';

function serverError(status: number, message?: string, headers?: Record<string, string>) {
  return {
    response: {
      status,
      data: message ? { error: message } : {},
      headers: headers ?? {},
    },
    config: { url: '/errands/42' },
    message: 'Request failed with status code ' + status,
  };
}

describe('toApiError', () => {
  it('classifies a request that never landed as offline', () => {
    const err = toApiError({ code: 'ERR_NETWORK', message: 'Network Error', config: { url: '/x' } });
    expect(err.isOffline).toBe(true);
    expect(err.isTimeout).toBe(false);
    expect(err.status).toBeUndefined();
  });

  it('classifies an aborted request as a timeout, not as offline', () => {
    const err = toApiError({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' });
    expect(err.isTimeout).toBe(true);
    expect(err.isOffline).toBe(false);
  });

  it('keeps the status and the server text when the server answered', () => {
    const err = toApiError(serverError(404, 'Errand not found'));
    expect(err.status).toBe(404);
    expect(err.isOffline).toBe(false);
    expect(err.serverMessage).toBe('Errand not found');
  });

  it('reads Retry-After on a 429, in seconds or as an HTTP date', () => {
    expect(toApiError(serverError(429, 'Slow down', { 'retry-after': '90' })).retryAfterSeconds).toBe(90);
    expect(
      toApiError(serverError(429, 'Slow down', { 'ratelimit-reset': '45' })).retryAfterSeconds
    ).toBe(45);
  });

  it('passes an ApiError straight through rather than re-wrapping it', () => {
    const original = new ApiError('boom', { status: 500 });
    expect(toApiError(original)).toBe(original);
  });
});

describe('toUserMessage', () => {
  it('says offline before anything else', () => {
    expect(toUserMessage(new ApiError('Network Error', { isOffline: true }))).toBe(OFFLINE_MESSAGE);
  });

  it('names the wait rather than the failure on a timeout', () => {
    expect(toUserMessage(new ApiError('timeout', { isTimeout: true }))).toBe(TIMEOUT_MESSAGE);
  });

  it('calls a wrong password a wrong password', () => {
    expect(toUserMessage(new ApiError('Invalid username or password', { status: 401 }), 'login')).toBe(
      'Wrong password.'
    );
  });

  it('never leaks the server text on a login 401', () => {
    const message = toUserMessage(
      new ApiError('please use secure cookies', {
        status: 401,
        serverMessage: 'please use secure cookies',
      }),
      'login'
    );
    expect(message).toBe('Wrong password.');
    expect(message).not.toContain('cookies');
  });

  it('treats a 401 anywhere else as the session ending', () => {
    expect(toUserMessage(new ApiError('nope', { status: 401 }), 'errand')).toBe(SESSION_ENDED_MESSAGE);
  });

  it('prefers the server deniedMessage on a 403', () => {
    expect(
      toUserMessage(
        new ApiError('x', { status: 403, serverMessage: 'This account has been deactivated.' }),
        'login'
      )
    ).toBe('This account has been deactivated.');
  });

  it('explains a missing errand in errand terms', () => {
    expect(toUserMessage(new ApiError('x', { status: 404 }), 'errand')).toBe(
      "We couldn't find that errand. It may have been cancelled."
    );
  });

  it('turns a 429 into a wait the customer can act on', () => {
    expect(
      toUserMessage(new ApiError('x', { status: 429, retryAfterSeconds: 600 }))
    ).toBe('Too many tries. Wait 10 minutes and try again.');
    expect(toUserMessage(new ApiError('x', { status: 429, retryAfterSeconds: 45 }))).toBe(
      'Too many tries. Wait 50 seconds and try again.'
    );
    expect(toUserMessage(new ApiError('x', { status: 429 }))).toBe(
      'Too many tries. Wait a few minutes and try again.'
    );
  });

  it('passes a 422 validation message through, because the server wrote it for the customer', () => {
    expect(
      toUserMessage(
        new ApiError('x', { status: 422, serverMessage: 'Password must be at least 6 characters' }),
        'register'
      )
    ).toBe('Password must be at least 6 characters');
  });

  it('does not blame the customer for a 500', () => {
    expect(toUserMessage(new ApiError('x', { status: 500 }))).toBe(SERVER_MESSAGE);
    expect(toUserMessage(new ApiError('x', { status: 503 }))).toBe(
      'Sugo is down for maintenance. We will be back shortly.'
    );
  });

  it('handles something that is not an axios error at all', () => {
    expect(toUserMessage(new Error('undefined is not an object'))).toBe(
      'Something went wrong. Tap to try again.'
    );
  });
});

describe('helpers', () => {
  it('reports a session end only on a 401', () => {
    expect(isSessionEnded(new ApiError('x', { status: 401 }))).toBe(true);
    expect(isSessionEnded(new ApiError('x', { status: 403 }))).toBe(false);
  });

  it('reports a retry window only on a 429', () => {
    expect(retryAfterSeconds(new ApiError('x', { status: 429, retryAfterSeconds: 30 }))).toBe(30);
    expect(retryAfterSeconds(new ApiError('x', { status: 500, retryAfterSeconds: 30 }))).toBeUndefined();
  });

  it('exports one retry word for the whole app', () => {
    expect(RETRY_LABEL).toBe('Try again');
  });
});

describe('offline classification is not a catch-all', () => {
  it('recognises the axios and React Native network messages', () => {
    expect(toApiError({ message: 'Network Error', config: {} }).isOffline).toBe(true);
    expect(toApiError({ message: 'Network request failed', config: {} }).isOffline).toBe(true);
  });

  it('does not call a rendering bug an offline device', () => {
    expect(toApiError(new TypeError('undefined is not an object')).isOffline).toBe(false);
    expect(toApiError('some thrown string').isOffline).toBe(false);
  });
});
