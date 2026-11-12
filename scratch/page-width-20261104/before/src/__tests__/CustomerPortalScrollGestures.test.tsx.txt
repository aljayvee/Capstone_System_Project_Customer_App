import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';

const mockGetItem = jest.fn((key: string): Promise<string | null> => Promise.resolve(null));
const mockSetItem = jest.fn((key: string, val: string): Promise<null> => Promise.resolve(null));
const mockRemoveItem = jest.fn((key: string): Promise<null> => Promise.resolve(null));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, val: string) => mockSetItem(key, val),
  removeItem: (key: string) => mockRemoveItem(key),
}));

jest.useFakeTimers();

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: () => null,
}));

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style }: any) => <View style={style}>{children}</View>,
    BlurTargetView: ({ children, style }: any) => <View style={style}>{children}</View>,
  };
});

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() =>
    Promise.resolve({
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    })
  ),
}));

jest.mock('../firebase/location', () => ({
  saveCustomerLocation: jest.fn(() => Promise.resolve()),
}));

jest.mock('../hooks/useRegisterPushToken', () => ({
  useRegisterPushToken: jest.fn(),
}));

jest.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ unreadCount: 0, syncActiveErrands: jest.fn() }),
}));

const mockUser = { id: 42, firstName: 'Maria', lastName: 'Clara', username: 'mariaclara' };

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'fake-token',
  }),
}));

let capturedHomeTabProps: any = null;
let capturedSearchProps: any = null;

// Find stores as the Search tab; its own screen tests cover what it shows.
jest.mock('../screens/StoreSearchScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => null,
    StoreSearchView: (props: any) => {
      capturedSearchProps = props;
      return <View testID="mock-store-search-tab" />;
    },
  };
});

jest.mock('../screens/portal/HomeTab', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      capturedHomeTabProps = props;
      return (
        <View testID="mock-home-tab">
          <Text>Mock Home Tab</Text>
        </View>
      );
    },
  };
});

jest.mock('../screens/portal/ErrandsTab', () => () => null);
jest.mock('../screens/portal/TrackTab', () => () => null);
jest.mock('../screens/portal/ChatTab', () => () => null);

import CustomerPortalScreen from '../screens/CustomerPortalScreen';

describe('CustomerPortalScreen - Foodpanda Gesture-Anchor Scroll Stabilization', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => () => {}),
    isFocused: jest.fn(() => true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockImplementation(() => Promise.resolve(null));
  });

  afterEach(async () => {
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
  });

  it('provides onScroll, onScrollBeginDrag, and onScrollEndDrag to HomeTab', async () => {
    await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    expect(capturedHomeTabProps).not.toBeNull();
    expect(typeof capturedHomeTabProps.onScroll).toBe('function');
    expect(typeof capturedHomeTabProps.onScrollBeginDrag).toBe('function');
    expect(typeof capturedHomeTabProps.onScrollEndDrag).toBe('function');
  });

  it('holds current state when user holds scroll and makes micro-movements (< 45dp)', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    // Initial state: header is visible
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('auto');

    // User touches screen to begin dragging at y = 100
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 100 } },
      });
    });

    // User holds screen and slightly wobbles (e.g. y = 115, delta = 15dp < 45dp threshold)
    await act(async () => {
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 115 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2000 },
        },
      });
    });

    // Header remains visible (holds state, zero shaking)
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('auto');
  });

  // 2026-10-14: the bar's Search opens Find stores as a tab, under the bar; it
  // used to push a screen that covered the bar. Back returns to Home.
  it('opens Find stores as a tab from the bar, and keeps the bar', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    await fireEvent.press(res.getByTestId('bottom-nav-pabili'));

    expect(res.getByTestId('mock-store-search-tab')).toBeTruthy();
    expect(capturedSearchProps.inTab).toBe(true);
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('StoreSearch', expect.anything());
    expect(res.getByTestId('bottom-nav-capsule').props.pointerEvents).toBe('auto');
    expect(res.getByTestId('bottom-nav-pabili').props.accessibilityState).toEqual({ selected: true });

    await act(async () => {
      capturedSearchProps.onBack();
    });
    expect(res.queryByTestId('mock-store-search-tab')).toBeNull();
    expect(res.getByTestId('mock-home-tab')).toBeTruthy();
  });

  // foodpanda's header (2026-10-14): the address leads on the left, then the
  // bell and the profile photo on the right; the name in capitals is gone.
  it('lays the header out as address, then bell, then profile photo', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );
    const tree = JSON.stringify(res.toJSON());
    const at = (id: string) => tree.indexOf(`"testID":"${id}"`);

    expect(at('header-location-btn')).toBeGreaterThan(-1);
    expect(at('header-location-btn')).toBeLessThan(at('customer-notification-bell'));
    expect(at('customer-notification-bell')).toBeLessThan(at('header-profile-btn'));
    expect(res.queryByText('MARIA CLARA')).toBeNull();

    await fireEvent.press(res.getByTestId('header-profile-btn'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Account', expect.anything());
    expect(res.getByTestId('header-profile-btn').props.accessibilityLabel).toContain('Maria');
  });

  // A slow scroll shook (2026-10-13): hiding the header animated its height,
  // which reflowed Home under the finger mid-drag. It now slides over a page
  // whose frame never changes, and HomeTab moves the search bar with it.
  it('hides the header without changing the layout Home scrolls in', async () => {
    const { StyleSheet } = require('react-native');
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );
    const headerHeight = () =>
      StyleSheet.flatten(res.getByTestId('home-collapsible-header').props.style).height;

    expect(capturedHomeTabProps.headerSpace).toBe(headerHeight());
    expect(capturedHomeTabProps.headerOffset).toBeDefined();
    const shownHeight = headerHeight();

    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({ nativeEvent: { contentOffset: { y: 100 } } });
    });
    await act(async () => {
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 160 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2000 },
        },
      });
    });

    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');
    expect(headerHeight()).toBe(shownHeight);
    expect(StyleSheet.flatten(res.getByTestId('home-collapsible-header').props.style).transform).toBeDefined();
  });

  it('hides header and docks search when swiping up past 45dp threshold during drag', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    // User starts drag at y = 100
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 100 } },
      });
    });

    // User decisively swipes up (scrolls down past y = 160, delta = 60dp > 45dp)
    await act(async () => {
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 160 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2000 },
        },
      });
    });

    // Header collapses
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');
  });

  it('locks visibility at bottom of list so overscroll bounce settling cannot trigger oscillation', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    // Collapse header first via decisive swipe
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 100 } },
      });
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 180 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 1500 },
        },
      });
    });
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');

    // Scrolled near bottom: contentHeight = 1500, viewportHeight = 600, currentY = 920
    // currentY + viewportHeight = 1520 >= 1500 - 70
    await act(async () => {
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 920 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 1500 },
        },
      });
    });

    // Header remains locked in its collapsed state without flickering
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');
  });

  it('restores header and bottom nav when returning to top (currentY <= 20)', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    // Collapse header
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 100 } },
      });
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 200 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2000 },
        },
      });
    });
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');

    // Scroll back to top
    await act(async () => {
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 10 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2000 },
        },
      });
    });

    // Header is restored
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('auto');
  });

  it('keeps search button docked at top when swiping down mid-feed and only backs position at maximum scroll height (top)', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    // 1. Swiping up: header collapses, search button moves to top header
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 100 } },
      });
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 220 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');

    // 2. Swiping down to go up while mid-feed (e.g. from y = 220 to y = 150):
    //    Per user requirement: DON'T back the search button position yet!
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 220 } },
      });
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 150 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    // Header remains collapsed, search button remains docked at top, zero layout shake
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');

    // 3. User releases finger after swiping down:
    await act(async () => {
      capturedHomeTabProps.onScrollEndDrag({
        nativeEvent: {
          contentOffset: { y: 150 },
          velocity: { y: -0.5 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    // Still remains collapsed mid-feed!
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('none');

    // 4. Finally, user scrolls all the way back to the top (maximum scroll height, y <= 20):
    await act(async () => {
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 5 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    // Search button and header position slowly backed into place!
    expect(res.getByTestId('home-collapsible-header').props.pointerEvents).toBe('auto');
  });

  it('keeps bottom navigation visible without sliding down and up oscillation when scrolling towards the top', async () => {
    const res: any = await render(
      <CustomerPortalScreen
        navigation={mockNavigation as any}
        route={{ params: { user: mockUser } } as any}
      />
    );

    const capsule = res.getByTestId('bottom-nav-capsule');
    // Initially at top: bottom nav is visible
    expect(capsule.props.pointerEvents).toBe('auto');

    // 1. Swiping up (scrolling down into feed): bottom nav smoothly hides
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 100 } },
      });
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 220 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
      capturedHomeTabProps.onScrollEndDrag({
        nativeEvent: {
          contentOffset: { y: 220 },
          velocity: { y: 0.5 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    expect(capsule.props.pointerEvents).toBe('none');

    // 2. Swiping down to go up (scrolling toward top of feed): bottom nav appears
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 220 } },
      });
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 160 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    // Bottom nav is now visible
    expect(capsule.props.pointerEvents).toBe('auto');

    // 3. User releases finger after swiping down: bottom nav MUST STAY VISIBLE (no bounce/flicker hiding)
    await act(async () => {
      capturedHomeTabProps.onScrollEndDrag({
        nativeEvent: {
          contentOffset: { y: 160 },
          velocity: { y: -0.4 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    expect(capsule.props.pointerEvents).toBe('auto');

    // 4. Momentum continues scrolling toward top: bottom nav STAYS VISIBLE
    await act(async () => {
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 110 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    expect(capsule.props.pointerEvents).toBe('auto');

    // 5. User performs a second swipe-down stroke to continue moving toward top:
    //    Bottom nav STAYS VISIBLE throughout the second gesture without sliding down and up!
    await act(async () => {
      capturedHomeTabProps.onScrollBeginDrag({
        nativeEvent: { contentOffset: { y: 110 } },
      });
      capturedHomeTabProps.onScroll({
        nativeEvent: {
          contentOffset: { y: 60 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
      capturedHomeTabProps.onScrollEndDrag({
        nativeEvent: {
          contentOffset: { y: 60 },
          velocity: { y: -0.3 },
          layoutMeasurement: { height: 600 },
          contentSize: { height: 2500 },
        },
      });
    });
    expect(capsule.props.pointerEvents).toBe('auto');
  });
});

