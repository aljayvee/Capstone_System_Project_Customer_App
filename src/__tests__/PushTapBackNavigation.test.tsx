import React from 'react';
import { BackHandler, DeviceEventEmitter, Platform } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

/**
 * A chat push, tapped, then Back (2026-11-06).
 *
 * Reported: tapping a dispatcher-message banner opened the chat, but Back
 * "goes back, then returns to the chat instantly". Reproduced here with the
 * real portal, the real chat and the real push hook in a real native stack.
 * Only expo-notifications is simulated, and it is simulated the way the native
 * module behaves: it remembers the last tapped notification until
 * clearLastNotificationResponse() is called.
 */

jest.setTimeout(60000);

// The real useNavigation/useRoute (jest.setup stubs them app-wide): the
// location wizard reads its host screen's focus through useNavigation().
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  usePreventRemove: jest.fn(),
}));

// The real Android BackHandler (jest otherwise loads the iOS no-op).
jest.mock('react-native/Libraries/Utilities/BackHandler', () =>
  jest.requireActual('react-native/Libraries/Utilities/BackHandler.android')
);
jest.mock('react-native/Libraries/Components/ToastAndroid/ToastAndroid', () => ({ show: jest.fn(), SHORT: 0, LONG: 1 }));

// ---- expo-notifications, with the native module's memory of the last tap ----
let mockLastResponse: any = null;
const mockResponseListeners: Array<(response: any) => void> = [];

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[mock]' })),
  getDevicePushTokenAsync: jest.fn(() => Promise.resolve({ type: 'android', data: 'fcm' })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn((listener: (r: any) => void) => {
    mockResponseListeners.push(listener);
    return {
      remove: () => {
        const i = mockResponseListeners.indexOf(listener);
        if (i !== -1) mockResponseListeners.splice(i, 1);
      },
    };
  }),
  getLastNotificationResponse: jest.fn(() => mockLastResponse),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(mockLastResponse)),
  clearLastNotificationResponse: jest.fn(() => {
    mockLastResponse = null;
  }),
  clearLastNotificationResponseAsync: jest.fn(() => {
    mockLastResponse = null;
    return Promise.resolve();
  }),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-notif-id')),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}));

const chatTap = (identifier = 'push-1', errandId = 'ERRAND-77') => ({
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  notification: {
    date: Date.now(),
    request: {
      identifier,
      content: { title: 'Dispatcher Dan', body: 'Your items are ready', data: { type: 'CHAT_MESSAGE', errandId } },
    },
  },
});

/** The phone delivering a tap to a running app: stored natively, then announced. */
const tapBanner = async (response: any) => {
  mockLastResponse = response;
  await act(async () => {
    [...mockResponseListeners].forEach((listener) => listener(response));
  });
};

// ---- What both screens need, as in their own suites ----
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('expo-navigation-bar', () => ({ NavigationBar: () => null }));
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style }: any) => <View style={style}>{children}</View>,
    BlurTargetView: ({ children, style }: any) => <View style={style}>{children}</View>,
  };
});
jest.mock('../firebase/config', () => ({ database: {}, auth: {}, app: {} }));
jest.mock('../firebase/location', () => ({ saveCustomerLocation: jest.fn(() => Promise.resolve()) }));
jest.mock('../services/socketClient', () => ({
  getSocket: jest.fn(() => Promise.resolve({ on: jest.fn(), off: jest.fn(), emit: jest.fn() })),
  subscribeToErrand: jest.fn(() => Promise.resolve()),
  unsubscribeFromErrand: jest.fn(() => Promise.resolve()),
}));
jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn((url: string) =>
      String(url).includes('/transactions')
        ? Promise.resolve({ data: { orders: [] } })
        : String(url).startsWith('/errands/')
        ? Promise.resolve({ data: { id: 'ERRAND-77', status: 'ASSIGNED', categories: 'Bakery' } })
        : Promise.resolve({ data: [] })
    ),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));
jest.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ unreadCount: 0, syncActiveErrands: jest.fn() }),
}));
const mockUser = { id: 42, firstName: 'Maria', lastName: 'Clara', username: 'mariaclara' };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, token: 'fake-token', logout: jest.fn() }),
}));
// The portal's tabs: their own suites cover them.
jest.mock('../screens/StoreSearchScreen', () => ({ __esModule: true, default: () => null, StoreSearchView: () => null }));
jest.mock('../screens/portal/HomeTab', () => () => null);
jest.mock('../screens/portal/ErrandsTab', () => () => null);
jest.mock('../screens/portal/TrackTab', () => () => null);
jest.mock('../screens/portal/ChatTab', () => () => null);
jest.mock('../components/CalendarPickerModal', () => () => null);
// Edit Account's "Discard Unsaved Changes?" dialog, drawn inline while open so a
// test can see whether it came up (jest does not render Modal contents here).
jest.mock('../components/ConfirmModal', () => {
  const { Text: Label } = require('react-native');
  return ({ visible, title }: { visible: boolean; title: string }) => (visible ? <Label>{title}</Label> : null);
});
// The wizard's map step: its own suite covers it.
jest.mock('../screens/location/WizardStepPin', () => {
  const { TouchableOpacity: Touchable, Text: Label } = require('react-native');
  return ({ onNext }: { onNext: (address: string | null) => void }) => (
    <Touchable testID="mock-step1-next" onPress={() => onNext(null)}>
      <Label>Next</Label>
    </Touchable>
  );
});

import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import CustomerChatScreen from '../screens/CustomerChatScreen';
import { resetHandledPushTaps } from '../hooks/useRegisterPushToken';
import PabiliStoreEditorScreen from '../screens/pabili/PabiliStoreEditorScreen';
import { emptyDraft, pabiliDraftStore } from '../services/pabiliDraft';
import EditAccountScreen from '../screens/EditAccountScreen';
import LocationWizard from '../screens/location/LocationWizard';

const Stack = createNativeStackNavigator<any>();

// Saved Locations with its add-a-place wizard open, as CustomerLocationScreen
// shows it; the wizard is the real one.
function SavedLocationsWithWizard() {
  return (
    <LocationWizard
      initialValues={null}
      saving={false}
      gpsLoading={false}
      onUseCurrentLocation={async () => ({ latitude: 6.69, longitude: 124.68 })}
      onSave={jest.fn()}
      onCancel={jest.fn()}
    />
  );
}

const renderApp = async () => {
  const navRef = createNavigationContainerRef<any>();
  const res: any = await render(
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerPortal" component={CustomerPortalScreen} initialParams={{ user: mockUser }} />
        <Stack.Screen name="CustomerChat" component={CustomerChatScreen as any} />
        <Stack.Screen name="PabiliStoreEditor" component={PabiliStoreEditorScreen as any} />
        <Stack.Screen name="EditAccount" component={EditAccountScreen as any} />
        <Stack.Screen name="CustomerLocation" component={SavedLocationsWithWizard} />
      </Stack.Navigator>
    </NavigationContainer>
  );
  const stack = () => navRef.getRootState()?.routes.map((r: any) => r.name) ?? [];
  const focused = () => navRef.getCurrentRoute()?.name;
  return { res, navRef, stack, focused };
};

/** Long enough for any replayed tap to have landed. */
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
};

beforeEach(() => {
  mockLastResponse = null;
  mockResponseListeners.length = 0;
  resetHandledPushTaps();
});

describe('a tapped chat push, then Back', () => {
  it('opens the chat, and the back arrow returns to the portal and stays there', async () => {
    const { res, stack, focused } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    expect(stack()).toEqual(['CustomerPortal']);

    await tapBanner(chatTap());
    await waitFor(() => expect(focused()).toBe('CustomerChat'));
    expect(stack()).toEqual(['CustomerPortal', 'CustomerChat']);

    await fireEvent.press(await res.findByTestId('back-button'));
    await settle();

    expect(stack()).toEqual(['CustomerPortal']);
    expect(focused()).toBe('CustomerPortal');
  });

  it('a push that started the app opens the chat once, and Back stays back', async () => {
    mockLastResponse = chatTap('cold-1');
    const { res, stack, focused } = await renderApp();
    await waitFor(() => expect(focused()).toBe('CustomerChat'));

    await fireEvent.press(await res.findByTestId('back-button'));
    await settle();

    expect(stack()).toEqual(['CustomerPortal']);
    expect(focused()).toBe('CustomerPortal');
  });

  it('the cold-start tap, also announced to the listener, opens one chat, not two', async () => {
    const cold = chatTap('cold-2');
    mockLastResponse = cold;
    const { stack, focused } = await renderApp();
    await waitFor(() => expect(focused()).toBe('CustomerChat'));
    // Some Android builds hand the launching tap to the listener as well.
    await act(async () => {
      [...mockResponseListeners].forEach((listener) => listener(cold));
    });
    await settle();

    expect(stack()).toEqual(['CustomerPortal', 'CustomerChat']);
  });

  it('a new tap still opens its chat after an earlier one was handled', async () => {
    const { res, stack, focused } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));

    await tapBanner(chatTap('push-1'));
    await waitFor(() => expect(focused()).toBe('CustomerChat'));
    await fireEvent.press(await res.findByTestId('back-button'));
    await settle();
    expect(stack()).toEqual(['CustomerPortal']);

    await tapBanner(chatTap('push-2'));
    await waitFor(() => expect(focused()).toBe('CustomerChat'));
  });

  it('tapping the same notification again, on purpose, still opens it', async () => {
    const { res, stack, focused } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    const tap = chatTap('push-same');

    await tapBanner(tap);
    await waitFor(() => expect(focused()).toBe('CustomerChat'));
    await fireEvent.press(await res.findByTestId('back-button'));
    await settle();
    expect(stack()).toEqual(['CustomerPortal']);

    await tapBanner(tap);
    await waitFor(() => expect(focused()).toBe('CustomerChat'));
  });

  it('a portal mounted again later does not reopen a chat already followed', async () => {
    // Any fresh mount of the portal (a sign-in check redrawing the stack, an
    // app reload) asks the native module for the last tap on the way in.
    const first = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    await tapBanner(chatTap('push-old'));
    await waitFor(() => expect(first.focused()).toBe('CustomerChat'));
    expect(mockLastResponse).toBeNull(); // acted on, so forgotten natively
    await first.res.unmount();

    // Even where the stored tap cannot be cleared, the hook remembers it.
    mockLastResponse = chatTap('push-old');
    const second = await renderApp();
    await settle();
    expect(second.stack()).toEqual(['CustomerPortal']);
    expect(mockLastResponse).toBeNull();
  });
});

describe('Android hardware Back on a chat opened from a push', () => {
  // Jest runs this app as iOS, where BackHandler does nothing. These run the
  // real Android BackHandler: listeners are asked newest first, and the first
  // to return true swallows the press.
  const pressHardwareBack = async () => {
    await act(async () => {
      DeviceEventEmitter.emit('hardwareBackPress', {});
    });
  };

  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns to the portal, even after the customer switched tabs first', async () => {
    const { navRef, stack, focused } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    // A tab switch: the portal's own Back listener is set up again, and so
    // becomes the newest one.
    await act(async () => {
      navRef.navigate('CustomerPortal', { user: mockUser, initialTab: 'errands' });
    });
    await settle();

    await tapBanner(chatTap());
    await waitFor(() => expect(focused()).toBe('CustomerChat'));

    await pressHardwareBack();
    await settle();

    expect(stack()).toEqual(['CustomerPortal']);
    expect(focused()).toBe('CustomerPortal');
  });

  it('still steps the portal back to Home once the portal is in front', async () => {
    const { navRef, stack } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    await act(async () => {
      navRef.navigate('CustomerPortal', { user: mockUser, initialTab: 'errands' });
    });
    await settle();

    const exitApp = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
    await pressHardwareBack(); // errands -> home, handled by the portal
    await settle();
    expect(stack()).toEqual(['CustomerPortal']);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('Back on a chat opened from a push over a store editor returns to that editor', async () => {
    // The customer is typing a shopping list when the dispatcher writes. The
    // editor's own back listener sits under the chat and is asked first. Its
    // goBack() carries no target, so the router pops the top screen, the chat,
    // which is the right result. This guards that outcome.
    const grocery = 'Supermarket & Grocery';
    await act(async () => {
      pabiliDraftStore.begin(String(mockUser.id), emptyDraft([grocery]));
    });
    const { res, navRef, stack, focused } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    await act(async () => {
      navRef.navigate('PabiliStoreEditor', { user: mockUser, category: grocery });
    });
    await res.findByTestId('compose-input');

    await tapBanner(chatTap('push-editor'));
    await waitFor(() => expect(focused()).toBe('CustomerChat'));
    expect(stack()).toEqual(['CustomerPortal', 'PabiliStoreEditor', 'CustomerChat']);

    await pressHardwareBack();
    await settle();

    expect(stack()).toEqual(['CustomerPortal', 'PabiliStoreEditor']);
    expect(focused()).toBe('PabiliStoreEditor');
    await act(async () => {
      await pabiliDraftStore.clear();
    });
  });
  it('Back on a chat opened from a push over Edit Account, with an edit pending, returns to Edit Account', async () => {
    const { res, navRef, stack, focused } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    await act(async () => {
      navRef.navigate('EditAccount', { user: { ...mockUser, phone: '09123456789' } });
    });
    await fireEvent.changeText(await res.findByTestId('edit-phone-input'), '9998887777');
    expect(res.getByText('Save 1 Change')).toBeTruthy();

    await tapBanner(chatTap('push-edit'));
    await waitFor(() => expect(focused()).toBe('CustomerChat'));

    await pressHardwareBack();
    await settle();

    // The real dialog is a Modal, a window above every screen, so on a phone it
    // shows over the chat even from the hidden screen; hence includeHiddenElements.
    expect(res.queryByText('Discard Unsaved Changes?', { includeHiddenElements: true })).toBeNull();
    expect(stack()).toEqual(['CustomerPortal', 'EditAccount']);
    expect(focused()).toBe('EditAccount');
    // Its own guard still holds once it is in front again.
    await pressHardwareBack();
    await settle();
    expect(res.getByText('Discard Unsaved Changes?')).toBeTruthy();
  });

  it('Back on a chat opened from a push over the location wizard returns to the wizard, where it was', async () => {
    const { res, navRef, stack, focused } = await renderApp();
    await waitFor(() => expect(mockResponseListeners.length).toBeGreaterThan(0));
    await act(async () => {
      navRef.navigate('CustomerLocation', { user: mockUser });
    });
    await fireEvent.press(await res.findByTestId('mock-step1-next'));
    expect(res.getByTestId('location-street-input')).toBeTruthy(); // step 2, details

    await tapBanner(chatTap('push-wizard'));
    await waitFor(() => expect(focused()).toBe('CustomerChat'));

    await pressHardwareBack();
    await settle();

    expect(stack()).toEqual(['CustomerPortal', 'CustomerLocation']);
    expect(focused()).toBe('CustomerLocation');
    expect(res.getByTestId('location-street-input')).toBeTruthy(); // still on step 2
  });
});
