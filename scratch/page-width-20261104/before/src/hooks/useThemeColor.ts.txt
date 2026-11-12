import { useColorScheme } from 'react-native';
import { LightColors, DarkColors } from '../config/theme';
import { useThemeContext, ThemeMode } from '../context/ThemeContext';

export function useThemeColor() {
  try {
    const context = useThemeContext();
    return context;
  } catch {
    // Fallback if component is rendered outside ThemeProvider
    return {
      themeMode: 'light' as ThemeMode,
      setThemeMode: async (_mode: ThemeMode) => {},
      colors: LightColors,
      isDark: false,
      colorScheme: 'light' as 'light' | 'dark',
    };
  }
}
