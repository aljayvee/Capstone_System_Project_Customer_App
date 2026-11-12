import { StyleSheet, type ViewStyle } from 'react-native';
import { FontFamily, PortalFontSizes, scaledPortalFontSize } from './theme';

/** Shared Home/Stage 1 glass finish for Customer App search controls. */
export const searchFieldStyles = StyleSheet.create({
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderWidth: 1.2,
    borderRadius: 24,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    paddingVertical: 10,
  },
});

export function getSearchFieldSurface(isDark: boolean): ViewStyle {
  return {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
  };
}
