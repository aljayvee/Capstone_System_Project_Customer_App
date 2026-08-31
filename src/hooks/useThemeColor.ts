import { useColorScheme } from 'react-native';
import { LightColors, DarkColors } from '../config/theme';
import { useThemeContext, ThemeMode } from '../context/ThemeContext';

export function useThemeColor() {
  try {
    const context = useThemeContext();
    return context;
  } catch {
    // Fallback if component is rendered outside ThemeProvider
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;

    return {
      themeMode: 'system' as ThemeMode,
      setThemeMode: async (_mode: ThemeMode) => {},
      colors,
      isDark,
      colorScheme: (colorScheme ?? 'light') as 'light' | 'dark',
    };
  }
}
