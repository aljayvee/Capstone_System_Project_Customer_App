import { BASE_WIDTH, Breakpoints, clamp, moderateScale, sizingWidth } from '../utils/responsive';

/**
 * Dedicated ergonomic Portal Typography & Layout Ramp for CustomerApp
 * (CustomerPortalScreen, BottomNav, HomeTab, TrackTab, ErrandsTab, ChatTab, AccountTab).
 *
 * Impeccable Design & Accessibility Invariants:
 * - 12sp strict minimum legibility floor for metadata, badges, and timestamps.
 * - 14.5sp standard readable body text for card contents, descriptions, and list rows.
 * - 16sp-17sp prominent hierarchy for store headlines, prices, and fees.
 * - 20sp-24sp display hierarchy for tab titles and section hero headers.
 * - Proportional dynamic line-heights to eliminate font descender clipping.
 * - WCAG 2.2 AA compliant touch target clearances (>= 48dp).
 */
export const PortalFontSizes = {
  /** Minimum practical floor for metadata tags, timestamps, status pills, and counter badges */
  micro: 12,
  /** Secondary supporting copy, item counts, helper labels, and captions */
  caption: 13,
  /** Standard readable body descriptions, address strings, chat snippets, and item titles */
  body: 14.5,
  /** Section subheadings, card titles, merchant store headers, and tab navigation labels */
  subheading: 16,
  /** Prominent numerical currency figures, delivery fees, and order totals */
  price: 17,
  /** Primary tab screen headers, section banners, and modal dialog titles */
  title: 20,
  /** Hero headlines and primary greeting headers */
  hero: 24,
} as const;

export type PortalTypographyRole = 'display' | 'heading' | 'body' | 'label' | 'price';

/**
 * 4-Tier responsive font scaling engine for Customer Portal screens:
 * - Compact screens (<350dp): gentle scaling with strict safety floors
 *   (labels/badges never drop below 11.5sp, body text never drops below 14sp).
 * - Standard screens (350–413dp): reference scale calibrated against Samsung A04 / modern mobile baseline.
 * - Wider than 360 dp (2026-10-13): the 360 dp size, no larger. Phablets and
 *   tablets used to scale up to 1.18x, which made a big phone show the same
 *   screenful zoomed in; now the extra width shows more instead (sizingWidth).
 */
export function scaledPortalFontSize(size: number, width?: number): number {
  const screenWidth = sizingWidth(width);

  if (screenWidth < Breakpoints.compact) {
    // Compact screens: dampen scaling and enforce strict safety floors
    const scaled = moderateScale(size, 0.15, screenWidth);
    const minFloor = size >= PortalFontSizes.body ? 14.0 : 11.5;
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
 * Eliminates descender clipping ('g', 'y', 'p', 'q') on custom Inter fonts.
 */
export function getPortalLineHeight(
  fontSize: number,
  roleOrMultiplier: PortalTypographyRole | number = 'body'
): number {
  if (typeof roleOrMultiplier === 'number') {
    return Math.round(fontSize * roleOrMultiplier);
  }

  switch (roleOrMultiplier) {
    case 'display':
    case 'heading':
      // 1.25x – 1.30x for headings and titles
      return Math.round(fontSize * 1.28);
    case 'price':
      // 1.32x – 1.36x for prices and single-line figures
      return Math.round(fontSize * 1.34);
    case 'label':
      // 1.36x – 1.40x for badges, pills, and compact uppercase tags
      return Math.round(fontSize * 1.38);
    case 'body':
    default:
      // 1.42x – 1.46x for readable multi-line body and descriptions
      return Math.round(fontSize * 1.44);
  }
}

/**
 * Standard touch target geometry for Customer Portal components (WCAG 2.2 AA compliant).
 */
export const PortalTouchTargets = {
  /** Minimum touch bounding box dimension for buttons, tabs, and interactive rows */
  minTouchTarget: 48,
  /** Alias for minTouchTarget */
  min: 48,
  /** Compact interactive element dimension (e.g. 44dp icon button) */
  compact: 44,
  /** Standard action button height */
  buttonHeight: 50,
  /** Compact action pill height (accompanied by hitSlop to satisfy 48dp) */
  pillHeight: 36,
  /** Filter pill height alias */
  filterPillHeight: 36,
  /** Standard hitSlop helper for compact interactive chips */
  compactHitSlop: { top: 8, bottom: 8, left: 6, right: 6 },
} as const;

/**
 * Coordinated accessibility font scale multipliers (maxFontSizeMultiplier).
 * Balances OS-level accessibility font scaling while protecting layout integrity.
 */
export const PortalFontSizeMultipliers = {
  /** Badges, uppercase tags, counter pills, and compact bottom tab labels */
  label: 1.15,
  /** Secondary captions, metadata, and timestamps */
  caption: 1.15,
  /** Subheadings, card titles, button labels, and prices */
  subheading: 1.20,
  /** Title headers and screen headlines */
  title: 1.20,
  /** Button labels */
  button: 1.20,
  /** Card titles and structured rows */
  card: 1.20,
  /** Body text, instructions, and multi-line descriptions */
  body: 1.25,
} as const;
