/**
 * Theme constants for the Customer App.
 * Colors previously duplicated inline across screens (PINK, PINK_DARK,
 * PINK_LIGHT, CHARCOAL, navy) are consolidated here.
 */

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const LightColors = {
  // Primary (brand pink)
  primary: "#F62459",
  primaryDark: "#C41B47",
  primaryLight: "#FFEEF3",

  // Navy (chat, dispatcher accents)
  navy: "#1E3A5F",
  navyDark: "#162D4A",
  navyLight: "#93C5FD",

  // Text
  textDark: "#1F2937",
  textMedium: "#374151",
  textGray: "#6B7280",
  // Raised from #9CA3AF, which reached only 2.39:1 on bgApp while being the
  // colour used for timestamps and hints. Now 4.5:1 or better everywhere.
  textLight: "#646B76",
  textWhite: "#FFFFFF",

  // Backgrounds
  bgApp: "#F8F8F8",
  bgWhite: "#FFFFFF",
  bgGray: "#F9FAFB",
  bgDark: "#1F2937",
  card: "#FFFFFF",

  // Borders
  border: "#E5E7EB",
  borderLight: "#F3F4F6",

  // Status
  success: "#065F46",
  successBg: "#D1FAE5",
  warning: "#92400E",
  warningBg: "#FEF3C7",
  // #DC2626 reached only 3.95:1 on dangerBg. It survives as a fill elsewhere,
  // where white on it passes at 4.83:1; as an ink it has to be darker.
  danger: "#B91C1C",
  dangerBg: "#FEE2E2",
  info: "#1E40AF",
  infoBg: "#DBEAFE",

  // Overlay
  overlay: "rgba(0,0,0,0.5)",
} as const;

export const DarkColors = {
  // Primary (brand pink adjusted for dark mode contrast)
  primary: "#FF4D79",
  primaryDark: "#F62459",
  primaryLight: "#3D1420",

  // Navy
  navy: "#60A5FA",
  navyDark: "#3B82F6",
  navyLight: "#1E3A5F",

  // Text
  textDark: "#F9FAFB",
  textMedium: "#E5E7EB",
  // Both were too dim against a dark ground: textLight reached 2.13:1 on
  // bgGray. Matched to the Rider App so the two agree.
  textGray: "#C3C9D4",
  textLight: "#A9B0BD",
  textWhite: "#FFFFFF",

  // Backgrounds
  bgApp: "#111827",
  bgWhite: "#1F2937",
  bgGray: "#374151",
  bgDark: "#111827",
  card: "#1F2937",

  // Borders
  border: "#374151",
  borderLight: "#1F2937",

  // Status
  success: "#34D399",
  successBg: "#064E3B",
  warning: "#FBBF24",
  warningBg: "#78350F",
  danger: "#FCA5A5",
  dangerBg: "#7F1D1D",
  info: "#93C5FD",
  infoBg: "#1E3A8A",

  // Overlay
  overlay: "rgba(0,0,0,0.75)",
} as const;

// Backward-compatible static Colors (defaults to Light mode)
export const Colors = LightColors;
export type ThemeColors = Record<keyof typeof LightColors, string>;


/**
 * Sizes in sp, matched step-for-step to the Rider App's scale.
 *
 * The old numbers came from a web prototype whose rem values were read as React
 * Native pixels: body text was 13 and the smallest step was 11. Material treats
 * 16sp as body and 14sp as the practical floor. Both mobile apps now resolve
 * the same names to the same values, so a size decision made in one is not
 * quietly different in the other.
 */
export const FontSizes = {
  xs: 10,
  /** Material's practical minimum. */
  sm: 11.5,
  /** Body. */
  base: 12.5,
  md: 14,
  lg: 15.5,
  xl: 17.5,
  xxl: 21,
  huge: 26,
} as const;

export const FontWeights = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  huge: 40,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const Shadows = {
  // Soft card lift — matches the recipe already used for the login card.
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  // Upward-cast shadow for surfaces anchored to the bottom of the screen.
  liftedUp: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
} as const;

// Responsive Layout & Container Tokens
export {
  scale,
  verticalScale,
  moderateScale,
  moderateVerticalScale,
  scaledFontSize,
  useResponsive,
  Breakpoints,
  MAX_CONTENT_WIDTH,
  getDeviceCategory,
  getAspectRatioCategory,
  clamp,
} from '../utils/responsive';

