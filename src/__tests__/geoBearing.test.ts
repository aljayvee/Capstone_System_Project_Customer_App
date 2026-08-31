import { bearingBetween, haversineDistanceKm } from '../utils/geo';

// Two points either side of Tacurong City, used so the expected bearings are
// checkable against a map rather than being whatever the code happens to return.
const TACURONG = { latitude: 6.6926, longitude: 124.6759 };

describe('bearingBetween', () => {
  it('reads 0 degrees due north', () => {
    expect(bearingBetween(TACURONG, { ...TACURONG, latitude: TACURONG.latitude + 0.01 }))
      .toBeCloseTo(0, 1);
  });

  it('reads 90 degrees due east', () => {
    expect(bearingBetween(TACURONG, { ...TACURONG, longitude: TACURONG.longitude + 0.01 }))
      .toBeCloseTo(90, 1);
  });

  it('reads 180 degrees due south', () => {
    expect(bearingBetween(TACURONG, { ...TACURONG, latitude: TACURONG.latitude - 0.01 }))
      .toBeCloseTo(180, 1);
  });

  it('reads 270 degrees due west', () => {
    expect(bearingBetween(TACURONG, { ...TACURONG, longitude: TACURONG.longitude - 0.01 }))
      .toBeCloseTo(270, 1);
  });

  it('always returns a compass bearing, never a negative angle', () => {
    // North-west: the naive atan2 result here is negative, and feeding that
    // straight to a marker's rotation prop rotates it the wrong way.
    const northWest = bearingBetween(TACURONG, {
      latitude: TACURONG.latitude + 0.01,
      longitude: TACURONG.longitude - 0.01,
    });
    expect(northWest).toBeGreaterThan(270);
    expect(northWest).toBeLessThan(360);
  });
});

describe('short-way-round rotation', () => {
  // The wraparound rule the smoothing hook applies before deciding whether a
  // turn is big enough to redraw. Naively subtracting makes 359 -> 3 look like
  // a 356-degree turn, which spins the marker almost all the way round.
  const turn = (from: number, to: number) => Math.abs(((to - from + 540) % 360) - 180);

  it('treats a turn across north as small', () => {
    expect(turn(359, 3)).toBeCloseTo(4, 5);
    expect(turn(3, 359)).toBeCloseTo(4, 5);
  });

  it('still measures genuine large turns', () => {
    expect(turn(0, 90)).toBeCloseTo(90, 5);
    expect(turn(10, 190)).toBeCloseTo(180, 5);
  });
});

describe('tween duration', () => {
  const MIN = 600, MAX = 2500, METRES_PER_MS = 0.03;
  const duration = (km: number) =>
    Math.min(MAX, Math.max(MIN, (km * 1000) / METRES_PER_MS));

  it('floors at the minimum for a stationary rider', () => {
    expect(duration(0)).toBe(MIN);
  });

  it('scales a normal step between fixes', () => {
    // ~30 m of travel -> about a second, so the dot moves at a believable pace.
    expect(duration(0.03)).toBe(1000);
  });

  it('caps a long jump instead of letting the marker crawl', () => {
    expect(duration(1.5)).toBe(MAX);
  });

  it('agrees with the distance helper on a real step', () => {
    const km = haversineDistanceKm(TACURONG, { ...TACURONG, latitude: TACURONG.latitude + 0.0003 });
    expect(km).toBeGreaterThan(0.03);
    expect(km).toBeLessThan(0.04);
    expect(duration(km)).toBeGreaterThan(MIN);
    expect(duration(km)).toBeLessThan(MAX);
  });
});
