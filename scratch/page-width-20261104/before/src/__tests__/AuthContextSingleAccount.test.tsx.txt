// AuthContext.login holds ONE account. Two sign-ins that overlap used to
// interleave across login()'s awaits and leave the screen showing one account,
// the API token belonging to the other, and the stored session (what the next
// launch restores) belonging to whichever wrote last (reported 2026-10-28).
import React from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react-native';

const mockStore = new Map<string, string>();
const mockSettle = jest.fn();
const mockSetCustomerToken = jest.fn();
const mockSetCustomerRefreshToken = jest.fn();
const mockApiPost = jest.fn();
const mockAxiosPost = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((k: string, v: string) => { mockStore.set(k, v); return Promise.resolve(null); }),
  getItem: jest.fn((k: string) => Promise.resolve(mockStore.get(k) ?? null)),
  removeItem: jest.fn((k: string) => { mockStore.delete(k); return Promise.resolve(null); }),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((k: string, v: string) => { mockStore.set(`secure:${k}`, v); return Promise.resolve(); }),
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockStore.get(`secure:${k}`) ?? null)),
  deleteItemAsync: jest.fn((k: string) => { mockStore.delete(`secure:${k}`); return Promise.resolve(); }),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: (...args: any[]) => mockAxiosPost(...args) },
}));

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: any[]) => mockApiPost(...args), defaults: { baseURL: 'https://api.test/api' } },
  setCustomerToken: (t: string | null) => mockSetCustomerToken(t),
  setCustomerRefreshToken: (t: string | null) => { mockSetCustomerRefreshToken(t); return Promise.resolve(); },
  getCustomerRefreshToken: () => Promise.resolve(null),
  setOnSessionExpired: jest.fn(),
  SECURE_TOKEN_KEY: 'jwt',
  STORAGE_KEY_TOKEN_FALLBACK: '@jwt',
}));

jest.mock('../firebase/realtimeSession', () => ({
  settleRealtimeSession: (...args: any[]) => mockSettle(...args),
  endRealtimeSession: () => Promise.resolve(),
}));
jest.mock('../services/socketClient', () => ({ resetSocket: jest.fn() }));
jest.mock('../services/swrCache', () => ({ clearCache: () => Promise.resolve() }));

import { AuthProvider, useAuth } from '../context/AuthContext';

const JUAN = { id: 11, username: 'juan' };
const MARIA = { id: 22, username: 'maria.g' };
const OWNER_OF: Record<string, number> = { 'tok-juan': 11, 'rt-juan': 11, 'tok-maria': 22, 'rt-maria': 22 };

let ctx: ReturnType<typeof useAuth>;
function Probe() {
  ctx = useAuth();
  return null;
}

function lastArg(fn: jest.Mock) {
  return fn.mock.calls[fn.mock.calls.length - 1]?.[0];
}

async function mount() {
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(ctx.isLoading).toBe(false));
}

beforeEach(() => {
  mockStore.clear();
  mockSettle.mockReset().mockResolvedValue(true);
  mockSetCustomerToken.mockReset();
  mockSetCustomerRefreshToken.mockReset();
  mockApiPost.mockReset().mockResolvedValue({ data: {} });
  mockAxiosPost.mockReset().mockResolvedValue({ data: {} });
});

afterEach(() => cleanup());

describe('AuthContext signs in one account at a time', () => {
  it('never mixes two overlapping sign-ins into one session', async () => {
    await mount();
    let finishFirst!: (v: boolean) => void;
    mockSettle.mockImplementationOnce(() => new Promise<boolean>((r) => { finishFirst = r; }));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = ctx.login(JUAN as any, 'tok-juan', 'rt-juan').then(() => 'ok', (e) => e);
      second = ctx.login(MARIA as any, 'tok-maria', 'rt-maria').then(() => 'ok', (e) => e);
    });
    await act(async () => {
      finishFirst(true);
      await first;
      await second;
    });

    const shown = Number(ctx.user?.id);
    const stored = Number(JSON.parse(mockStore.get('@sugo_customer_user') as string).id);
    // Every place the session lives names the same account.
    expect(stored).toBe(shown);
    expect(OWNER_OF[mockStore.get('secure:jwt') as string]).toBe(shown);
    expect(OWNER_OF[mockStore.get('@jwt') as string]).toBe(shown);
    expect(OWNER_OF[lastArg(mockSetCustomerToken)]).toBe(shown);
    expect(OWNER_OF[lastArg(mockSetCustomerRefreshToken)]).toBe(shown);
    // And it is the account that got there first.
    expect(shown).toBe(JUAN.id);
    await expect(second).resolves.toBeInstanceOf(Error);
  });

  it("signs the refused account's new server session out with its own tokens", async () => {
    await mount();
    await act(async () => { await ctx.login(JUAN as any, 'tok-juan', 'rt-juan'); });
    let refused: unknown;
    await act(async () => {
      refused = await ctx.login(MARIA as any, 'tok-maria', 'rt-maria').then(() => 'ok', (e) => e);
    });

    expect(refused).toBeInstanceOf(Error);
    expect(ctx.user?.id).toBe(JUAN.id);
    // Not through apiClient: its interceptor would attach juan's access token,
    // and /auth/logout blocklists whatever access token it is handed.
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockAxiosPost).toHaveBeenCalledWith(
      '/auth/logout',
      { refreshToken: 'rt-maria' },
      expect.objectContaining({
        baseURL: 'https://api.test/api',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-maria' }),
      })
    );
  });

  it('still lets the same account sign in again over its own session', async () => {
    await mount();
    await act(async () => { await ctx.login(JUAN as any, 'tok-juan', 'rt-juan'); });
    await act(async () => { await ctx.login({ ...JUAN, firstName: 'Juan' } as any, 'tok-juan-2', 'rt-juan-2'); });

    expect(ctx.user).toEqual(expect.objectContaining({ id: 11, firstName: 'Juan' }));
    expect(lastArg(mockSetCustomerToken)).toBe('tok-juan-2');
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('lets a different account sign in once the first has signed out', async () => {
    await mount();
    await act(async () => { await ctx.login(JUAN as any, 'tok-juan', 'rt-juan'); });
    await act(async () => { await ctx.logout(); });
    await act(async () => { await ctx.login(MARIA as any, 'tok-maria', 'rt-maria'); });

    expect(ctx.user?.id).toBe(MARIA.id);
    expect(OWNER_OF[mockStore.get('secure:jwt') as string]).toBe(MARIA.id);
  });

  it('refuses a different account over a session restored at launch', async () => {
    mockStore.set('@sugo_customer_user', JSON.stringify(JUAN));
    mockStore.set('secure:jwt', 'tok-juan');
    await mount();
    expect(ctx.user?.id).toBe(JUAN.id);

    let refused: unknown;
    await act(async () => {
      refused = await ctx.login(MARIA as any, 'tok-maria', 'rt-maria').then(() => 'ok', (e) => e);
    });
    expect(refused).toBeInstanceOf(Error);
    expect(ctx.user?.id).toBe(JUAN.id);
  });
});
