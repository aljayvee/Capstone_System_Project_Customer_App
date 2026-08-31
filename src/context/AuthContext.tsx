import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { resetSocket } from '../services/socketClient';
import { apiClient } from '../services/apiClient';
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore persistent session on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
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
        }

        // Hydrate the refresh token as well. Without this, an app reopened
        // after its access token had already aged out (the common case — a
        // phone is usually closed for longer than 15 minutes) would find
        // nothing to refresh with and bounce the user to Login, which is the
        // exact behaviour this change exists to remove.
        await getCustomerRefreshToken();

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
            setUser(parsedUser);
          }
        }
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

    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
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
  }, []);

  // One place decides what an unrecoverable 401 means. The interceptor has
  // already cleared the tokens by the time this fires; this clears the React
  // state, which is what actually returns the navigator to the Login screen.
  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      setAccessToken(null);
      resetSocket();
      void AsyncStorage.removeItem(USER_STORAGE_KEY);
      void AsyncStorage.removeItem(STORAGE_KEY_TOKEN_FALLBACK);
      SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => {});
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
