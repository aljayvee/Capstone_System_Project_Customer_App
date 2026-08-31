import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, ThemeColors } from '../config/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: ThemeColors;
  colorScheme: 'light' | 'dark';
}

const STORAGE_KEY = '@sugo_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    if (mode === themeMode) return;

    // Smooth layout animation for theme transitions to prevent eye strain
    LayoutAnimation.configureNext({
      duration: 350,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });

    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save theme mode preference:', e);
    }
  };

  const isDark =
    themeMode === 'dark' ? true : themeMode === 'light' ? false : systemColorScheme === 'dark';

  const colors = isDark ? DarkColors : LightColors;
  const activeScheme = isDark ? 'dark' : 'light';

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        isDark,
        colors,
        colorScheme: activeScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}

export const useTheme = useThemeContext;
