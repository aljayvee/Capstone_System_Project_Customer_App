import { LightColors, DarkColors, FontSizes } from '../config/theme';

/**
 * The palette's accessibility guarantees, as tests.
 *
 * The mirror of the Rider App's tests/palette.test.ts, deliberately: the two
 * apps share a token vocabulary, and a guarantee enforced in one and not the
 * other is how they drift apart again.
 *
 * These caught twelve real failures when first written — five in the light
 * palette and seven in the dark, including textLight at 2.13:1 on bgGray. The
 * dark ones had never been measured at all, which is the ordinary way a dark
 * mode ships looking fine and failing.
 */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_BODY = 4.5;

const PAIRINGS: Array<[keyof typeof LightColors, keyof typeof LightColors]> = [
  ['success', 'successBg'],
  ['warning', 'warningBg'],
  ['danger', 'dangerBg'],
  ['info', 'infoBg'],
];

const TEXT_TOKENS = ['textDark', 'textMedium', 'textGray', 'textLight'] as const;
const SURFACES = ['bgWhite', 'bgGray', 'bgApp', 'card'] as const;

describe('the light palette', () => {
  it.each(PAIRINGS)('puts %s on %s at 4.5:1 or better', (ink, surface) => {
    expect(contrast(LightColors[ink], LightColors[surface])).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(TEXT_TOKENS)('keeps %s readable on every surface', (token) => {
    for (const surface of SURFACES) {
      expect(contrast(LightColors[token], LightColors[surface])).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});

describe('the dark palette', () => {
  it('defines every token the light palette does', () => {
    // A missing key renders as `undefined`, which React Native treats as "no
    // colour" — invisible text rather than a crash.
    expect(Object.keys(DarkColors).sort()).toEqual(Object.keys(LightColors).sort());
  });

  it.each(PAIRINGS)('puts %s on %s at 4.5:1 or better', (ink, surface) => {
    expect(contrast(DarkColors[ink], DarkColors[surface])).toBeGreaterThanOrEqual(AA_BODY);
  });

  it.each(TEXT_TOKENS)('keeps %s readable on every surface', (token) => {
    for (const surface of SURFACES) {
      expect(contrast(DarkColors[token], DarkColors[surface])).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});

describe('the type scale', () => {
  it('puts body text at Material\'s 16sp', () => {
    expect(FontSizes.base).toBe(16);
  });

  it('matches the Rider App step for step', () => {
    // Both apps resolve the same names to the same values. If one moves, this
    // fails rather than the two quietly diverging.
    expect(FontSizes).toMatchObject({
      xs: 12,
      sm: 14,
      base: 16,
      md: 18,
      lg: 20,
      xl: 22,
      xxl: 26,
      huge: 32,
    });
  });
});
