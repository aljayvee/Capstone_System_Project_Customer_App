import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import {
  getCustomerToken,
  refreshCustomerSession,
  SECURE_TOKEN_KEY,
  STORAGE_KEY_TOKEN_FALLBACK,
} from './apiClient';

/**
 * Single authenticated Socket.IO connection for the whole app.
 *
 * Replaces three independent, unauthenticated `io(API_BASE_URL)` calls that
 * each screen made for itself. Two reasons that had to change:
 *
 *  - Without a token the server cannot tell who is connecting, so it could only
 *    ever broadcast events to everyone. Anything private — a rider's live
 *    position, an ETA — was therefore either leaked to every connected client
 *    or could not be sent at all.
 *  - Three sockets per app meant three handshakes, three reconnect storms on a
 *    flaky connection, and no shared knowledge of connection state.
 */
let socket: Socket | null = null;
let appStateSubscription: { remove: () => void } | null = null;

// Errand rooms this client wants to be in. Re-sent after every reconnect: room
// membership lives on the server side of a connection and does not survive one
// dropping, which on a weak signal happens routinely.
const subscribedErrands = new Set<string>();

/**
 * The access token to hand the handshake, refreshed first if it has aged out.
 *
 * Reconnects happen exactly when the app has been asleep — backgrounded, out of
 * signal — which is also when the token is most likely to have expired. Renewing
 * here means the socket comes back authenticated rather than anonymous.
 */
async function resolveToken(): Promise<string | null> {
  const inMemory = getCustomerToken();
  if (inMemory && !isTokenExpired(inMemory)) return inMemory;

  let stored: string | null = null;
  try {
    stored =
      (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) ||
      (await AsyncStorage.getItem(STORAGE_KEY_TOKEN_FALLBACK));
  } catch {
    stored = null;
  }

  if (stored && !isTokenExpired(stored)) return stored;

  // Everything we hold is stale. Spend the refresh token — single-flighted in
  // apiClient, so a socket reconnect racing an HTTP 401 does one refresh
  // between them rather than two, which would trip the server's replay
  // detection and revoke the session.
  try {
    return await refreshCustomerSession();
  } catch {
    // Refresh failed: the session is genuinely over. Connect anonymously rather
    // than not at all — the interceptor's session-expired path will sign the
    // customer out on their next HTTP call, and that is where that decision
    // belongs.
    return null;
  }
}

function resubscribeAll(active: Socket) {
  subscribedErrands.forEach((errandId) => {
    active.emit('subscribe:errand', errandId);
  });
}

export async function getSocket(): Promise<Socket> {
  if (socket) return socket;

  socket = io(API_BASE_URL, {
    // A FUNCTION, not a value. socket.io calls this before every connection
    // attempt, including every automatic reconnect, so the handshake always
    // carries a currently-valid access token.
    //
    // This used to be a plain object holding the token read once at startup.
    // Access tokens live 15 minutes; the socket lives as long as the app does.
    // So roughly a quarter-hour in, the first reconnect would hand the server
    // an expired token — and the server's auth middleware is deliberately
    // non-blocking, so instead of failing loudly the socket connected as
    // ANONYMOUS. An anonymous socket joins no identity room and is refused by
    // `subscribe:errand`, which is precisely the "realtime silently stopped and
    // I have to leave the screen and come back" symptom: navigating away and
    // returning re-ran the fetch over HTTP, where the interceptor refreshes the
    // token properly.
    auth: async (cb: (data: Record<string, unknown>) => void) => {
      const token = await resolveToken();
      cb(token ? { token } : {});
    },
    // No `transports` option on purpose — socket.io's default is
    // ['polling', 'websocket']: connect over HTTP long-polling first, then
    // silently upgrade to a websocket if the network allows one.
    //
    // Listing them explicitly is what broke this. `['websocket', 'polling']`
    // does not mean "try websocket, fall back to polling"; it means attempt a
    // raw websocket handshake FIRST, which on an emulator or a LAN dev server
    // frequently fails outright and leaves the client retrying it forever —
    // the repeating "connection error: websocket error" this produced. The
    // rider app and the web dashboard both omit the option for exactly this
    // reason; the customer app was the only client overriding it.
  });

  socket.on('connect', () => {
    if (socket) resubscribeAll(socket);
  });

  // Surfaces what used to be silent. A handshake that fails leaves every screen
  // waiting forever for events that will never arrive.
  socket.on('connect_error', (err: Error) => {
    console.warn('[socket] connection error:', err?.message);
  });

  // React Native suspends sockets when the app is backgrounded; returning to the
  // foreground with a dead socket is the single most common way a customer ends
  // up staring at a tracking screen that has silently stopped updating.
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && socket && !socket.connected) {
        socket.connect();
      }
    });
  }

  return socket;
}

/** Joins an errand's private channel, and keeps it joined across reconnects. */
export async function subscribeToErrand(errandId: string): Promise<void> {
  subscribedErrands.add(errandId);
  const active = await getSocket();
  if (active.connected) {
    active.emit('subscribe:errand', errandId);
  }
}

export async function unsubscribeFromErrand(errandId: string): Promise<void> {
  subscribedErrands.delete(errandId);
  if (socket?.connected) {
    socket.emit('unsubscribe:errand', errandId);
  }
}

/** Called on logout: a new sign-in must not inherit the old identity's rooms. */
export function resetSocket(): void {
  subscribedErrands.clear();
  socket?.disconnect();
  socket = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}
