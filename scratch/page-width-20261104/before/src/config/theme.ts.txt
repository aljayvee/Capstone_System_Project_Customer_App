import { MobileLight, MobileDark } from "./palette";

/**
 * Theme constants for the Customer App.
 * Colors previously duplicated inline across screens (PINK, PINK_DARK,
 * PINK_LIGHT, CHARCOAL, navy) are consolidated here.
 */

export const FontFamily = {
  regular: 'Urbanist_400Regular',
  medium: 'Urbanist_500Medium',
  semibold: 'Urbanist_600SemiBold',
  bold: 'Urbanist_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const LightColors = MobileLight;

export const DarkColors = MobileDark;

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

// Dedicated Auth Typography Ramp for high-legibility authentication surfaces
export {
  AuthFontSizes,
  scaledAuthFontSize,
  getAuthLineHeight,
  AuthFontSizeMultipliers,
  AuthContainerHeights,
} from './authTypography';

// Dedicated Customer Portal Typography & Layout Ramp
export {
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
  type PortalTypographyRole,
} from './portalTypography';

