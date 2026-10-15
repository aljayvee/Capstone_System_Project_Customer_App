import type { AxiosError } from 'axios';

/**
 * What a failed request actually was.
 *
 * The response interceptor used to reject with a bare `new Error(message)`,
 * which threw away `err.code` and `err.response`. Everything downstream then
 * had to guess: useActiveErrands asked `err.code === 'ERR_NETWORK' || !err.response`
 * and got `true` for every failure including a clean 404, because both fields
 * were always undefined by the time it looked.
 *
 * This carries the shape forward instead. `message` still holds the server's
 * own text so logging and 422 validation passthrough keep working; the classified
 * fields are what UI code should branch on. Screens must not render `message`
 * directly - run it through toUserMessage() in errorMessages.ts.
 */
export class ApiError extends Error {
  /** HTTP status. Undefined when the request never reached the server. */
  readonly status?: number;
  /** Axios code: ERR_NETWORK, ECONNABORTED, ERR_BAD_RESPONSE, ... */
  readonly code?: string;
  /** The request never landed. Device offline, DNS failure, connection refused. */
  readonly isOffline: boolean;
  /** The request landed (or may have) but we gave up waiting. */
  readonly isTimeout: boolean;
  /** Seconds until a 429 lifts, when the server told us. */
  readonly retryAfterSeconds?: number;
  /** Request path, for logging. */
  readonly endpoint?: string;
  /** Raw text the server sent, if any. Never render this directly. */
  readonly serverMessage?: string;

  constructor(
    message: string,
    fields: {
      status?: number;
      code?: string;
      isOffline?: boolean;
      isTimeout?: boolean;
      retryAfterSeconds?: number;
      endpoint?: string;
      serverMessage?: string;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = fields.status;
    this.code = fields.code;
    this.isOffline = fields.isOffline ?? false;
    this.isTimeout = fields.isTimeout ?? false;
    this.retryAfterSeconds = fields.retryAfterSeconds;
    this.endpoint = fields.endpoint;
    this.serverMessage = fields.serverMessage;
    // Required for `instanceof` to survive transpilation of a subclassed builtin.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Both headers are read because express-rate-limit sends `RateLimit-Reset`
 * (seconds remaining) under standardHeaders, while proxies and CDNs in front of
 * it send `Retry-After` (seconds, or an HTTP date).
 */
function parseRetryAfter(headers: unknown): number | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const bag = headers as Record<string, unknown>;
  const raw = bag['retry-after'] ?? bag['Retry-After'] ?? bag['ratelimit-reset'] ?? bag['RateLimit-Reset'];
  if (raw === undefined || raw === null) return undefined;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.ceil(asNumber);

  // HTTP-date form.
  const asDate = Date.parse(String(raw));
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return undefined;
}

function looksLikeNetworkMessage(message: string): boolean {
  const lower = message.toLowerCase();
  // axios says "Network Error"; the React Native adapter says "Network request
  // failed". Substring tests, deliberately, so no escape can be lost in transit.
  return lower.includes('network error') || lower.includes('network request failed');
}

export function toApiError(error: AxiosError | any): ApiError {
  // Already classified - happens when a caller re-throws what it caught.
  if (error instanceof ApiError) return error;

  const response = error?.response;
  const status: number | undefined = response?.status;
  const code: string | undefined = error?.code;
  const endpoint: string | undefined = error?.config?.url;

  // Axios reports its own timeout as ECONNABORTED with no response. Some
  // Android builds surface it as ETIMEDOUT instead.
  const isTimeout =
    !response && (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(String(error?.message ?? '')));

  // "No response" alone is not enough to call it offline. A TypeError thrown
  // inside a .then() has no response either, and telling someone to check their
  // Wi-Fi because of a rendering bug sends them to fix a working router. So the
  // failure must actually look like one from the transport: a network code, a
  // network message, or an axios error that carried a request and came back
  // with nothing.
  const NETWORK_CODES = ['ERR_NETWORK', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EAI_AGAIN'];
  const message = String(error?.message ?? '');
  const cameFromAxios = Boolean(error?.isAxiosError || error?.config || error?.request);
  const isOffline =
    !response &&
    !isTimeout &&
    (NETWORK_CODES.includes(String(code)) ||
      looksLikeNetworkMessage(message) ||
      (cameFromAxios && !code));

  const serverMessage: string | undefined =
    response?.data?.error ?? response?.data?.message ?? undefined;

  return new ApiError(serverMessage || message || 'Request failed', {
    status,
    code,
    isOffline,
    isTimeout,
    retryAfterSeconds: status === 429 ? parseRetryAfter(response?.headers) : undefined,
    endpoint,
    serverMessage,
  });
}
