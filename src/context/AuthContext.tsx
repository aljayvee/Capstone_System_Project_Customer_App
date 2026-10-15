import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { resetSocket } from '../services/socketClient';
import { apiClient } from '../services/apiClient';
import { endRealtimeSession, settleRealtimeSession } from '../firebase/realtimeSession';
import { clearCache } from '../services/swrCache';
import {
  setCustomerToken,
  setCustomerRefreshToken,
  getCustomerRefreshToken,
  setOnSessionExpired,
  SECURE_TOKEN_KEY,
  STORAGE_KEY_TOKEN_FALLBACK,
} from '../services/apiClient';

interface User {
  id: number | string;
  username: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  signUpMethod?: 'password' | 'google';
  googleId?: string | null;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string | null;
  avatar?: string | null;
  birthdate?: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (userData: User, token?: string, refreshToken?: string) => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = '@sugo_customer_user';
const ONBOARDING_COMPLETED_KEY = '@sugo_customer_onboarding_completed';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore persistent session on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser) as User;
            if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
              setUser(parsedUser);
              void AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true').catch(() => {});
            }
          } catch {
            // Invalid JSON, ignore
          }
        }

        let storedToken: string | null = null;
        try {
          storedToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        } catch {
          // SecureStore fallback to AsyncStorage
        }

        if (!storedToken) {
          storedToken = await AsyncStorage.getItem(STORAGE_KEY_TOKEN_FALLBACK);
        }

        if (storedToken) {
          setAccessToken(storedToken);
          setCustomerToken(storedToken);
          // A relaunch restores the JWT session silently, and the Firebase one
          // has to come back with it.
          await settleRealtimeSession(1500);
        }

        // Hydrate the refresh token as well.
        await getCustomerRefreshToken();
      } catch (error) {
        console.error('[AuthContext] Failed to restore persistent user session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (userData: User, token?: string, refreshToken?: string) => {
    if (token) {
      setAccessToken(token);
      setCustomerToken(token);
    }
    setUser(userData);

    // Opens the Firebase identity the chat thread and the live rider pin now
    // need. Awaited on the same bounded budget as the launch path, because the
    // screen the customer lands on after signing in may subscribe immediately,
    // and a listener opened before the session exists stays refused.
    await settleRealtimeSession();

    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true').catch(() => {});
    if (token) {
      try {
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
      } catch {
        // Fall through
      }
      await AsyncStorage.setItem(STORAGE_KEY_TOKEN_FALLBACK, token);
    }

    // The login response has always carried this; it used to be dropped on the
    // floor, which is why sessions died with their access token.
    if (refreshToken) {
      await setCustomerRefreshToken(refreshToken);
    }
  }, []);

  const updateUser = useCallback(async (updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updatedFields };
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged)).catch((err) =>
        console.error('[AuthContext] Failed to persist updated user:', err)
      );
      return merged;
    });
  }, []);

  const logout = useCallback(async () => {
    // Tell the server first, while the credentials still exist. This app never
    // called /auth/logout at all, so a signed-out device left a live session row
    // and a refresh token that stayed spendable for its full lifetime — which
    // matters a great deal more now that the lifetime is 30 days.
    //
    // Deliberately best-effort and not awaited into the failure path: a customer
    // signing out on a dead connection must still end up signed out locally.
    try {
      const storedRefreshToken = await getCustomerRefreshToken();
      if (storedRefreshToken) {
        await apiClient.post('/auth/logout', { refreshToken: storedRefreshToken });
      }
    } catch {
      // Offline or already invalid; local teardown below is what matters.
    }

    // Before the local teardown, so the Firebase credential cannot outlive the
    // account that owns it and go on reading chats after sign-out.
    await endRealtimeSession();
    // The cached errands, chats and addresses (services/swrCache.ts), so the
    // next account on this phone never opens on this one's.
    await clearCache();

    setUser(null);
    setAccessToken(null);
    setCustomerToken(null);
    // Drops the authenticated socket and every errand room joined under the
    // previous identity, so the next account to sign in on this device does not
    // inherit them.
    resetSocket();
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY_TOKEN_FALLBACK);
    try {
      await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    } catch {
      // Ignore
    }
    // Leaving this behind would let the next 401 silently resurrect the session
    // that was just signed out of.
    await setCustomerRefreshToken(null);
    // Explicitly guarantee onboarding completion persists on sign out so returning users land on Login
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true').catch(() => {});
  }, []);

  // One place decides what an unrecoverable 401 means. The interceptor has
  // already cleared the tokens by the time this fires; this clears the React
  // state, which is what actually returns the navigator to the Login screen.
  useEffect(() => {
    setOnSessionExpired(() => {
      // The Firebase credential goes with the session, as on sign-out: left
      // behind, it kept reading the expired account's chats.
      void endRealtimeSession();
      void clearCache();
      setUser(null);
      setAccessToken(null);
      resetSocket();
      void AsyncStorage.removeItem(USER_STORAGE_KEY);
      void AsyncStorage.removeItem(STORAGE_KEY_TOKEN_FALLBACK);
      SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => {});
      void AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true').catch(() => {});
    });
    return () => setOnSessionExpired(null);
  }, []);

  // Memoised so the context value only changes when the session actually does.
  // A fresh object literal here re-rendered every consumer on each provider
  // render, and any consumer keying an effect on a field of it inherited that
  // churn. The three actions are useCallback'd for the same reason — without
  // that, this useMemo would recompute on every render anyway.
  const value = useMemo<AuthContextType>(
    () => ({ user, accessToken, isLoading, login, updateUser, logout }),
    [user, accessToken, isLoading, login, updateUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
