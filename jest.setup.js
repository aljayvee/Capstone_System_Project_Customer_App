// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = (props) => {
    return React.createElement(
      View,
      { ...props, testID: props.testID || 'mock-map-view' },
      props.children
    );
  };
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

  return {
    __esModule: true,
    default: MockMapView,
    MapView: MockMapView,
    Marker: MockMarker,
    Callout: MockCallout,
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: 'default',
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
