import { useThemeColor } from './useThemeColor';

// Dark-mode hero gradient for the auth screens.
//
// The light palette's brand pink is a large, fully-saturated fill. On a phone in
// a dark room it is the single brightest thing on screen, and the app's own dark
// rules already forbid loud tinted surfaces (AGENTS.md, "Dark Mode Surface
// Purity"). Simply reusing DarkColors.primary makes it worse, not better —
// #FF4D79 is *lighter* than the light-mode pink, because that value is tuned for
// small accents like button fills and link text, not for a third of the screen.
//
// So the hero gets its own deepened pair: same hue, roughly a third of the
// luminance. White headline text clears 4.5:1 against both stops, and the
// pattern's low-opacity white line-art still reads.
const DARK_HERO_GRADIENT: readonly [string, string] = ['#8E1739', '#43141F'];

/**
 * The two gradient stops for the login / register / forgot-password hero.
 * Returned as a fixed-length tuple because expo-linear-gradient types `colors`
 * as requiring at least two entries.
 */
export function useAuthHeroGradient(): readonly [string, string] {
  const { colors, isDark } = useThemeColor();
  return isDark ? DARK_HERO_GRADIENT : [colors.primary, colors.primaryDark];
}
