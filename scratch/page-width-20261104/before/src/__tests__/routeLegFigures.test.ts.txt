import { legFigures } from '../hooks/useLiveRoute';
import { getErrandProgressStage } from '../utils/errandProgress';

// Errand ...99e1b3 as production routed it: rider in Banga, one store and the
// customer in Tacurong.
const TO_STORE = { distanceMeters: 52900, durationSeconds: 3600 };
const TO_CUSTOMER = { distanceMeters: 2800, durationSeconds: 300 };

describe('legFigures', () => {
  it('splits a rider-to-store-to-customer route the way the lines are drawn', () => {
    expect(legFigures([TO_STORE, TO_CUSTOMER], true)).toEqual({
      pickupDistanceMeters: 52900,
      pickupDurationSeconds: 3600,
      deliveryDistanceMeters: 2800,
      deliveryDurationSeconds: 300,
      nextStopRoadMeters: 52900,
    });
  });

  it('adds up every store leg into the shopping run', () => {
    const between = { distanceMeters: 1200, durationSeconds: 180 };
    const figures = legFigures([TO_STORE, between, TO_CUSTOMER], true);
    expect(figures.pickupDistanceMeters).toBe(54100);
    expect(figures.pickupDurationSeconds).toBe(3780);
    // The next stop is still only the first leg away.
    expect(figures.nextStopRoadMeters).toBe(52900);
  });

  it('counts a single leg as the delivery run', () => {
    expect(legFigures([TO_CUSTOMER], true)).toMatchObject({
      pickupDistanceMeters: null,
      deliveryDistanceMeters: 2800,
      nextStopRoadMeters: null,
    });
  });

  it('has no next stop distance when the route does not start at the rider', () => {
    expect(legFigures([TO_STORE, TO_CUSTOMER], false).nextStopRoadMeters).toBeNull();
  });

  it('returns nothing for a route without legs', () => {
    expect(legFigures([], true).deliveryDistanceMeters).toBeNull();
  });
});

describe('the traveling-to-store label', () => {
  const RIDER = { latitude: 6.4117567, longitude: 124.76903 };
  const JULIES = { storeName: "Julie's Bakeshop", latitude: 6.6961606, longitude: 124.6728304, sequence: 1 };
  const base = { status: 'IN_TRANSIT', itemsPurchasedAt: null, riderLocation: RIDER, pinpoints: [JULIES] };

  it('uses the road distance when the route has one', () => {
    const stage = getErrandProgressStage({ ...base, nextStopRoadMeters: 52900 });
    expect(stage.subLabel).toBe("52.9 km from Julie's Bakeshop");
  });

  it('falls back to the straight-line distance without a route', () => {
    const stage = getErrandProgressStage(base);
    expect(stage.subLabel).toBe("33.4 km from Julie's Bakeshop");
  });

  it('names the next stop in visiting order when quoting road distance', () => {
    // The nearer store as the crow flies is visited second.
    const near = { storeName: 'Near Store', latitude: 6.42, longitude: 124.77, sequence: 2 };
    const stage = getErrandProgressStage({ ...base, pinpoints: [near, JULIES], nextStopRoadMeters: 52900 });
    expect(stage.subLabel).toBe("52.9 km from Julie's Bakeshop");
  });
});
