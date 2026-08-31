// Mock react-native-safe-area-context using its own official jest mock —
// without this, SafeAreaProvider never resolves an onLayout measurement in
// the test renderer and renders with zero children.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Mock react-native-keyboard-controller with its shipped jest mock — the real
// module is a native one and has no JS implementation under the test renderer.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest')
);

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  // forwardRef so components can call the imperative camera methods they use
  // to frame a route. Without these the ref is a plain View and every
  // mapRef.current?.animateToRegion(...) throws on mount.
  const MockMapView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
      animateCamera: jest.fn(),
      fitToCoordinates: jest.fn(),
      fitToElements: jest.fn(),
      fitToSuppliedMarkers: jest.fn(),
      getCamera: jest.fn(() => Promise.resolve({ center: { latitude: 0, longitude: 0 }, zoom: 15 })),
    }));
    return React.createElement(
      View,
      { ...props, testID: props.testID || 'mock-map-view' },
      props.children
    );
  });
  MockMapView.displayName = 'MockMapView';
  const MockMarker = (props) => {
    return React.createElement(
      View,
      { ...props, testID: props.testID || 'mock-marker' },
      props.children
    );
  };
  const MockCallout = (props) => {
    return React.createElement(
      View,
      { ...props, testID: props.testID || 'mock-callout' },
      props.children
    );
  };

  const MockPolyline = (props) => {
    return React.createElement(View, { ...props, testID: props.testID || 'mock-polyline' });
  };

  // The geofence radius drawn around each pinned store. Absent from this mock
  // until now, which only went unnoticed because every existing test rendered
  // with no pinpoints at all.
  const MockCircle = (props) => {
    return React.createElement(View, { ...props, testID: props.testID || 'mock-circle' });
  };

  // The marker whose coordinate is an AnimatedRegion rather than a plain pair.
  // Tagged separately so a test can tell an interpolated marker from one that
  // teleports between fixes.
  const MockMarkerAnimated = (props) => {
    return React.createElement(
      View,
      { ...props, testID: props.testID || 'mock-marker-animated' },
      props.children
    );
  };
  MockMarker.Animated = MockMarkerAnimated;

  // Enough of AnimatedRegion to drive a marker: it holds a coordinate and
  // tweens toward the next one. The real class wraps four Animated.Values.
  class MockAnimatedRegion {
    constructor(region = {}) {
      this.__region = { ...region };
      this.__timings = [];
    }
    setValue(region) {
      this.__region = { ...region };
    }
    timing(config) {
      this.__timings.push(config);
      return {
        start: () => {
          this.__region = {
            ...this.__region,
            latitude: config.latitude,
            longitude: config.longitude,
          };
        },
      };
    }
  }

  return {
    __esModule: true,
    default: MockMapView,
    MapView: MockMapView,
    Marker: MockMarker,
    MarkerAnimated: MockMarkerAnimated,
    Callout: MockCallout,
    Polyline: MockPolyline,
    Circle: MockCircle,
    AnimatedRegion: MockAnimatedRegion,
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: 'default',
  };
});

// Mock react-native-reanimated.
//
// Loading the real one pulls in react-native-worklets, which reaches for a
// native module that does not exist under the test renderer and throws before
// any test body runs. Reanimated 4 ships a mock, but that mock imports its own
// index and so drags the same native module back in — hence a hand-written one
// covering exactly what this app uses (see Animated.View in CustomerPortalScreen
// and the shared-value animations in BottomNav).
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, Image, ScrollView } = require('react-native');

  const passthrough = (Component, name) => {
    const Wrapped = (props) => React.createElement(Component, props, props.children);
    Wrapped.displayName = name;
    return Wrapped;
  };

  const Animated = {
    View: passthrough(View, 'Animated.View'),
    Text: passthrough(Text, 'Animated.Text'),
    Image: passthrough(Image, 'Animated.Image'),
    ScrollView: passthrough(ScrollView, 'Animated.ScrollView'),
    createAnimatedComponent: (Component) => passthrough(Component, 'Animated.Custom'),
  };

  // Animations resolve instantly: the tests assert on settled output, never on
  // frames in between.
  const identity = (value) => value;
  const entering = { duration: () => entering, delay: () => entering, springify: () => entering };

  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (factory) => {
      try {
        return factory();
      } catch {
        return {};
      }
    },
    useAnimatedRef: () => ({ current: null }),
    withSpring: identity,
    withTiming: identity,
    withSequence: (...values) => values[values.length - 1],
    withDelay: (_delay, value) => value,
    withRepeat: identity,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    interpolate: (value) => value,
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: {
      linear: identity,
      ease: identity,
      quad: identity,
      cubic: identity,
      bezier: () => identity,
      in: identity,
      out: identity,
      inOut: identity,
    },
    FadeIn: entering,
    FadeOut: entering,
    FadeInDown: entering,
    FadeInUp: entering,
    SlideInRight: entering,
    SlideOutLeft: entering,
    Layout: entering,
  };
});

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
      removeListener: jest.fn(),
    }),
    useRoute: () => ({
      params: {
        user: { id: 'user1', username: 'testuser', firstName: 'Test', lastName: 'User' },
      },
    }),
  };
});

// Mock firebase/app
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

// Mock firebase/auth — the RN build is shipped as untranspiled ESM, so jest
// chokes on it at import time before any test body runs.
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
}));

// Mock firebase/database
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  onValue: jest.fn((ref, callback) => {
    callback({ val: () => null });
    return jest.fn();
  }),
  set: jest.fn(() => Promise.resolve()),
  push: jest.fn(() => ({ key: 'mock-push-key' })),
}));
