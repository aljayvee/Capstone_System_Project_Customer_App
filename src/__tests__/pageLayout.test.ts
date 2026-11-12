import { getPageLayout, MAX_CONTENT_WIDTH } from '../utils/responsive';

describe('phone page layout', () => {
  it.each([320, 360, 392, 428, 599])('uses the safe width and one pair of 12 dp margins at %i dp', width => {
    expect(getPageLayout(width)).toMatchObject({ isPhone: true, frameWidth: width, gutter: 12, contentWidth: width - 24 });
  });

  it.each([600, 800])('retains the tablet cap and screen-specific gutter at %i dp', width => {
    expect(getPageLayout(width, { tabletGutter: 24 })).toMatchObject({
      isPhone: false, frameWidth: MAX_CONTENT_WIDTH, gutter: 24, contentWidth: 532,
    });
  });

  it.each([320, 360, 392, 428, 599, 600, 800])('subtracts asymmetric safe-area insets once at %i dp', width => {
    const layout = getPageLayout(width, { leftInset: 9, rightInset: 21 });
    const consumed = getPageLayout(width, { leftInset: 9, rightInset: 21, horizontalSafeAreaApplied: true });
    expect(layout.safeWidth).toBe(width - 30);
    expect(layout.frameWidth).toBe(Math.min(width - 30, width < 600 ? width : 580));
    expect(consumed.frameWidth).toBe(layout.frameWidth);
    expect(consumed.contentWidth).toBe(layout.contentWidth);
    expect([layout.leftMargin, layout.rightMargin]).toEqual([9, 21]);
    expect([consumed.leftMargin, consumed.rightMargin]).toEqual([0, 0]);
  });

  it('never returns a negative content width when space is exhausted', () => {
    expect(getPageLayout(20, { leftInset: 15, rightInset: 15 }).contentWidth).toBe(0);
  });
});
