import {
  scale,
  verticalScale,
  moderateScale,
  moderateVerticalScale,
  scaledFontSize,
  getDeviceCategory,
  getAspectRatioCategory,
  clamp,
  MAX_CONTENT_WIDTH,
} from '../utils/responsive';

describe('Responsive Scaling Engine (Samsung A04 360x800 Baseline)', () => {
  describe('clamp', () => {
    it('clamps numbers within specified min and max', () => {
      expect(clamp(5, 10, 20)).toBe(10);
      expect(clamp(15, 10, 20)).toBe(15);
      expect(clamp(25, 10, 20)).toBe(20);
    });
  });

  describe('device classification', () => {
    it('classifies compact devices (width < 350)', () => {
      expect(getDeviceCategory(320)).toBe('compact'); // iPhone SE
      expect(getDeviceCategory(349)).toBe('compact');
    });

    it('classifies standard devices (350 <= width < 414)', () => {
      expect(getDeviceCategory(360)).toBe('standard'); // Samsung A04 baseline
      expect(getDeviceCategory(375)).toBe('standard'); // iPhone 13/14
      expect(getDeviceCategory(392)).toBe('standard'); // Samsung A14 / 1080p @ 2.75x
      expect(getDeviceCategory(412)).toBe('standard'); // Pixel 7
    });

    it('classifies phablet devices (414 <= width < 600)', () => {
      expect(getDeviceCategory(414)).toBe('phablet'); // iPhone Plus/Max
      expect(getDeviceCategory(428)).toBe('phablet'); // iPhone 14 Pro Max
      expect(getDeviceCategory(480)).toBe('phablet');
    });

    it('classifies tablet/unfolded foldable devices (width >= 600)', () => {
      expect(getDeviceCategory(600)).toBe('tablet');
      expect(getDeviceCategory(768)).toBe('tablet'); // iPad
      expect(getDeviceCategory(800)).toBe('tablet');
    });

    it('identifies tall aspect ratios (e.g. Z-Flip ~22:9)', () => {
      // Z Flip inner: 360 x 900 -> ratio 2.5
      expect(getAspectRatioCategory(360, 900)).toBe('tall');
      // Standard: 360 x 700 -> ratio 1.94
      expect(getAspectRatioCategory(360, 700)).toBe('standard');
      // Tablet / wide: 768 x 1024 -> ratio 1.33
      expect(getAspectRatioCategory(768, 1024)).toBe('wide');
    });
  });

  describe('mathematical scaling accuracy on Samsung A04 baseline', () => {
    it('returns exact base size on Samsung A04 base width 360', () => {
      expect(scale(16, 360)).toBe(16);
      expect(moderateScale(16, 0.30, 360)).toBe(16);
      expect(scaledFontSize(16, 0.20, 360)).toBe(16);
    });

    it('applies damped scaling on compact screens (320dp)', () => {
      const linear = scale(16, 320); // 14.22
      const moderate = moderateScale(16, 0.30, 320); // 15
      const font = scaledFontSize(16, 0.20, 320); // 16

      expect(linear).toBeLessThan(15);
      expect(moderate).toBeGreaterThan(linear);
      expect(moderate).toBeLessThanOrEqual(16);
      expect(font).toBeGreaterThanOrEqual(14);
    });

    it('prevents fonts from ballooning on 1080x2408 screens (392dp - 428dp)', () => {
      // On 1080p screens, a base 16 font should stay clamped within 106% (17)
      const f1080p = scaledFontSize(16, 0.20, 392);
      expect(f1080p).toBeLessThanOrEqual(17);

      const fPhablet = scaledFontSize(16, 0.20, 428);
      expect(fPhablet).toBeLessThanOrEqual(17);

      const hugeTitle = scaledFontSize(24, 0.20, 428);
      expect(hugeTitle).toBeLessThanOrEqual(25);
    });

    it('ensures scaledFontSize never violates safety clamps', () => {
      // On an extreme tablet (800dp), a base 16 font should not balloon beyond 106% (17)
      const bigFont = scaledFontSize(16, 0.20, 800);
      expect(bigFont).toBeLessThanOrEqual(17);

      // On an extreme small screen (280dp), a base 16 font should not drop below 85% (14)
      const smallFont = scaledFontSize(16, 0.20, 280);
      expect(smallFont).toBeGreaterThanOrEqual(14);
    });
  });

  describe('container limits', () => {
    it('defines max content width for tablets', () => {
      expect(MAX_CONTENT_WIDTH).toBe(580);
    });
  });
});
