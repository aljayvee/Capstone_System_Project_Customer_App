import { FontFamily } from './theme';
import { BASE_WIDTH, Breakpoints, clamp, moderateScale, sizingWidth } from '../utils/responsive';

/**
 * Dedicated ergonomic Auth Typography Ramp for CustomerApp
 * (Login, Forgot Password, Register/Sign Up).
 *
 * Guarantees strict legibility floors:
 * - 12sp minimum floor for micro-labels, uppercase headers, and error pills.
 * - 15sp standard for form text inputs (prevents mobile auto-zoom and squinting).
 * - 16sp bold for primary action CTAs.
 * - Proportional line-heights to eliminate text overlap and descender clipping.
 */
export const AuthFontSizes = {
  /** Minimum practical floor for uppercase labels, error pills, and small hints */
  xs: 12,
  /** Subtitles, secondary links, cooldown counters, and secondary text */
  sm: 13.5,
  /** Form text inputs, standard body instructions */
  base: 15,
  /** Primary button CTAs, prominent links */
  md: 16,
  /** Section titles, card callouts */
  lg: 18,
  /** Prominent step headers, sub-hero titles */
  xl: 20,
  /** Hero headlines, sheet titles */
  xxl: 24,
} as const;

export type AuthTypographyRole = 'display' | 'heading' | 'input' | 'body' | 'label';

/**
 * Tier-aware responsive font scaling for authentication forms:
 * - Compact screens (<350dp): gentle scaling with strict safety floors
 *   (labels never drop below 11.5sp, inputs never drop below 14.5sp).
 * - Standard screens (350–413dp): reference scale centered on Samsung A04 / iPhone baseline.
 * - Wider than 360 dp (2026-10-13): the 360 dp size, no larger, as in
 *   scaledPortalFontSize (see sizingWidth). It used to scale up to 1.18x.
 */
export function scaledAuthFontSize(size: number, width?: number): number {
  const screenWidth = sizingWidth(width);

  if (screenWidth < Breakpoints.compact) {
    // Compact screens: dampen scaling and enforce safety floor
    const scaled = moderateScale(size, 0.15, screenWidth);
    const minFloor = size >= AuthFontSizes.base ? 14.5 : 11.5;
    return Math.max(minFloor, scaled);
  }

  if (screenWidth < Breakpoints.standard) {
    // Standard mobile screens (350 - 413dp)
    const scaled = moderateScale(size, 0.20, screenWidth);
    const minAllowed = Math.round(size * 0.95);
    const maxAllowed = Math.round(size * 1.06);
    return clamp(scaled, minAllowed, maxAllowed);
  }

  // Phablets and Tablets (414dp+)
  const scaled = moderateScale(size, 0.25, screenWidth);
  const maxAllowed = Math.round(size * 1.18);
  return clamp(scaled, size, maxAllowed);
}

/**
 * Calculates dynamic proportional line-height based on font size and typography role.
 * Eliminates descender clipping ('g', 'y', 'p', 'q') and prevents multi-line collision.
 */
export function getAuthLineHeight(fontSize: number, role: AuthTypographyRole = 'body'): number {
  switch (role) {
    case 'display':
    case 'heading':
      // 1.25x – 1.30x for headings and titles
      return Math.round(fontSize * 1.28);
    case 'input':
      // 1.35x for single-line inputs
      return Math.round(fontSize * 1.36);
    case 'label':
      // 1.36x – 1.40x for form field labels and uppercase headers
      return Math.round(fontSize * 1.38);
    case 'body':
    default:
      // 1.42x – 1.46x for readable multi-line body and helper text
      return Math.round(fontSize * 1.44);
  }
}

/**
 * Coordinated accessibility font scale multipliers (maxFontSizeMultiplier).
 * Balances OS-level accessibility font preferences while safeguarding UI bounds.
 */
export const AuthFontSizeMultipliers = {
  /** Badges, uppercase labels, error pills, and compact tags */
  label: 1.15,
  /** Form text inputs and PIN/OTP fields */
  input: 1.20,
  /** Primary buttons and interactive link pills */
  button: 1.20,
  /** Headings and display titles */
  heading: 1.20,
  /** Multi-line descriptions, notices, hints, and helper paragraphs */
  body: 1.25,
} as const;

/**
 * Recommended container geometry tokens for Auth forms (WCAG 2.2 AA compliant).
 */
export const AuthContainerHeights = {
  inputMinHeight: 52,
  buttonMinHeight: 54,
  touchTargetMin: 48,
  inputBorderRadius: 10,
} as const;
