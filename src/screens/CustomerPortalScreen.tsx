import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
  Platform,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, MessageCircle, User as UserIcon, CheckCircle2 } from 'lucide-react-native';
import { getSocket } from '../services/socketClient';
import { saveCustomerLocation } from '../firebase/location';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/apiClient';
import {
  FontSizes,
  FontFamily,
  Spacing,
  BorderRadius,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalFontSizeMultipliers,
  PortalTouchTargets,
} from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { MapCoordinate, DEFAULT_CENTER, sanitizeCoordinate } from '../utils/coords';
import { openErrandDestination } from '../utils/errandNavigation';
import { useRegisterPushToken, type PushTapPayload } from '../hooks/useRegisterPushToken';
import Animated, {
  FadeIn,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import BottomNav, { PortalTab } from '../components/BottomNav';
import { NotificationBell } from '../components/NotificationBell';
import { useNotifications } from '../context/NotificationContext';
import CustomerHelpModal from '../components/CustomerHelpModal';
import { HeaderLocationButton } from '../components/home/HeaderLocationButton';
import { defaultLocationOf, useSavedLocations } from '../hooks/useSavedLocations';
import { hydrateCache, readCache, useSmartPolling, writeCache } from '../services/swrCache';
import { BlurTargetView } from 'expo-blur';
import HomeTab from './portal/HomeTab';
import ErrandsTab from './portal/ErrandsTab';
import TrackTab from './portal/TrackTab';
import ChatTab from './portal/ChatTab';
import { StoreSearchView } from './StoreSearchScreen';

export default function CustomerPortalScreen({ route, navigation }: any) {
  const { user: authUser, logout } = useAuth();
  const { syncActiveErrands } = useNotifications();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const initialUser = route.params?.user || authUser || null;

  const [currentUser, setCurrentUser] = useState<any>(initialUser);

  useEffect(() => {
    if (authUser) {
      setCurrentUser((prev: any) => {
        if (
          prev?.id === authUser.id &&
          prev?.firstName === authUser.firstName &&
          prev?.lastName === authUser.lastName &&
          prev?.avatar === authUser.avatar &&
          prev?.phone === authUser.phone
        ) {
          return prev;
        }
        return { ...(prev || {}), ...authUser };
      });
    }
  }, [authUser]);

  useEffect(() => {
    if (route.params?.user) {
      setCurrentUser((prev: any) => {
        const pUser = route.params.user;
        if (
          prev?.id === pUser.id &&
          prev?.firstName === pUser.firstName &&
          prev?.lastName === pUser.lastName &&
          prev?.avatar === pUser.avatar &&
          prev?.phone === pUser.phone
        ) {
          return prev;
        }
        return { ...(prev || {}), ...pUser };
      });
    }
  }, [route.params?.user]);

  const user = currentUser || authUser || route.params?.user || null;
  const activeCustomerId = user?.id ? String(user.id) : null;
  const customerDisplayName =
    (user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : (user?.name || user?.username || 'Customer'));
  const avatarUri = user?.avatar || user?.profilePicture || user?.photoUrl;
  const userInitials = (
    (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')
  ).toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U';
  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  const [dbErrands, setDbErrands] = useState<any[]>([]);
  const [loadingErrands, setLoadingErrands] = useState(false);

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const [defaultAddressText, setDefaultAddressText] = useState<string | null>(null);
  const [customerPinCoords, setCustomerPinCoords] = useState<MapCoordinate>(DEFAULT_CENTER);
  const [defaultLocationLabel, setDefaultLocationLabel] = useState<string | null>(null);
  // 'none' only after a successful load came back empty: a failed load must
  // never lock a customer behind the "set your location first" spotlight.
  const [locationStatus, setLocationStatus] = useState<'loading' | 'set' | 'none' | 'error'>('loading');
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [customerSavedLocations, setCustomerSavedLocations] = useState<any[]>([]);

  const [activeErrand, setActiveErrand] = useState<any>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [navLabelsVisible, setNavLabelsVisible] = useState(true);
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerVisibleRef = useRef(true);
  const dragStartY = useRef<number | null>(null);
  const dragInitialY = useRef<number | null>(null);
  const scrollDirection = useRef<'up' | 'down' | null>(null);
  const isDragging = useRef(false);
  const lastScrollY = useRef(0);
  // The tab content, as the bottom bar's glass blurs it.
  const tabContentRef = useRef<View>(null);

  const TOP_BAR_ROW_HEIGHT = 56;
  const headerRowHeight = useSharedValue(TOP_BAR_ROW_HEIGHT);
  const headerOpacity = useSharedValue(1);

  useEffect(() => {
    headerRowHeight.value = withTiming(headerVisible ? TOP_BAR_ROW_HEIGHT : 0, {
      duration: headerVisible ? 380 : 240,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    headerOpacity.value = withTiming(headerVisible ? 1 : 0, {
      duration: headerVisible ? 340 : 180,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [headerVisible]);

  // Slid, not shrunk (2026-10-13). Animating the row's height reflowed Home
  // under the customer's finger: the list jumped 56 dp up mid-drag, which on
  // a slow scroll read as the page shaking while the search bar docked. The
  // header now overlays a list whose frame never changes, and slides away
  // under the status strip; HomeTab moves its search bar by the same value.
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerRowHeight.value - TOP_BAR_ROW_HEIGHT }],
    opacity: headerOpacity.value,
  }));

  const showBars = useCallback(() => {
    if (!headerVisibleRef.current) {
      headerVisibleRef.current = true;
      setHeaderVisible(true);
    }
    setNavVisible(true);
    setNavLabelsVisible(true);
  }, []);

  const showNavOnly = useCallback(() => {
    setNavVisible(true);
    setNavLabelsVisible(true);
  }, []);

  const hideBars = useCallback(() => {
    if (headerVisibleRef.current) {
      headerVisibleRef.current = false;
      setHeaderVisible(false);
    }
    setNavVisible(false);
    setNavLabelsVisible(false);
  }, []);

  const handleScrollBeginDrag = useCallback((event: any) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    dragStartY.current = y;
    dragInitialY.current = y;
    isDragging.current = true;
  }, []);

  const handleScrollEndDrag = useCallback((event: any) => {
    isDragging.current = false;
    const nativeEvent = event?.nativeEvent;
    if (!nativeEvent) {
      dragStartY.current = null;
      dragInitialY.current = null;
      return;
    }

    const currentY = nativeEvent.contentOffset?.y ?? 0;
    const velocityY = nativeEvent.velocity?.y ?? 0;
    const initialY = dragInitialY.current ?? dragStartY.current ?? currentY;
    const totalDelta = currentY - initialY;

    dragStartY.current = null;
    dragInitialY.current = null;
    lastScrollY.current = currentY;

    // 1. Top of page guard (maximum scroll height):
    //    Per user specification: ONLY back the position of the search button when the scroll
    //    reaches its maximum height (currentY <= 20) slowly and smoothly!
    if (currentY <= 20) {
      scrollDirection.current = 'up';
      showBars();
      return;
    }

    // 2. Bottom of content guard: don't toggle on bottom overscroll release
    const viewportHeight = nativeEvent.layoutMeasurement?.height ?? 0;
    const contentHeight = nativeEvent.contentSize?.height ?? 0;
    if (contentHeight > 0 && viewportHeight > 0 && currentY + viewportHeight >= contentHeight - 70) {
      return;
    }

    // 3. User swiped up (scrolling down into content):
    //    Collapse header, dock search at top, and hide bottom nav
    //    Only trigger when user moved decisively down into feed:
    if ((totalDelta > 45 || (totalDelta > 15 && velocityY > 0.35)) && currentY > 50) {
      scrollDirection.current = 'down';
      hideBars();
      return;
    }

    // 4. User swiped down to go up (scrolling upward toward top of feed):
    //    The user was scrolling UP toward the top:
    //    KEEP the bottom nav visible! NEVER call hideBars() when moving upward!
    if (totalDelta < -20 || velocityY < -0.2) {
      scrollDirection.current = 'up';
      showNavOnly();
      return;
    }
  }, [showBars, showNavOnly, hideBars]);

  const handleTabScroll = useCallback((event: any) => {
    const nativeEvent = event?.nativeEvent;
    if (!nativeEvent) return;

    const currentY = nativeEvent.contentOffset?.y ?? 0;
    const viewportHeight = nativeEvent.layoutMeasurement?.height ?? 0;
    const contentHeight = nativeEvent.contentSize?.height ?? 0;

    // 1. Top of page guard (maximum scroll height, currentY <= 20):
    //    This is the ONLY place where the search button slowly backs into its original position!
    if (currentY <= 20) {
      scrollDirection.current = 'up';
      showBars();
      lastScrollY.current = Math.max(0, currentY);
      return;
    }

    // 2. Bottom of list guard: When near the end of scrollable content (e.g. at the last merchants
    //    or Recent Activity), Android and iOS produce rubber-band overscroll bouncing.
    //    Lock visibility when within 70dp of the bottom so bounce settling NEVER
    //    triggers a rapid hide/show oscillation loop!
    if (contentHeight > 0 && viewportHeight > 0 && currentY + viewportHeight >= contentHeight - 70) {
      lastScrollY.current = currentY;
      return;
    }

    // 3. If user is dragging (finger on screen):
    //    Foodpanda behavior: While holding or making micro-movements, HOLD the current state.
    //    When scrolling down past 50dp, dock search at top and hide bottom nav.
    //    When swiping down to go up, DON'T move search button yet (only restore bottom nav on intentional swipe).
    if (isDragging.current && dragStartY.current !== null) {
      const gestureDelta = currentY - dragStartY.current;

      if (gestureDelta > 45 && currentY > 50) {
        // User swiped up decisively -> hide header and dock search at top, hide nav
        scrollDirection.current = 'down';
        hideBars();
        dragStartY.current = currentY;
      } else if (gestureDelta < -40) {
        // User swiped down to go up:
        // DON'T back the search button yet! It stays docked at top. Only show bottom nav!
        scrollDirection.current = 'up';
        showNavOnly();
        dragStartY.current = currentY;
      }
      lastScrollY.current = currentY;
      return;
    }

    // 4. Momentum scroll (finger lifted, scrolling freely):
    //    Compare against lastScrollY with a 30dp delta to ignore micro-drifts and bounce settle
    const dy = currentY - lastScrollY.current;
    if (Math.abs(dy) < 30) {
      return;
    }

    if (dy > 40 && currentY > 50) {
      scrollDirection.current = 'down';
      hideBars();
      lastScrollY.current = currentY;
    } else if (dy < -30) {
      // Swiping down to go up: DON'T back search button yet! Only restore bottom nav.
      scrollDirection.current = 'up';
      showNavOnly();
      lastScrollY.current = currentY;
    }
  }, [showBars, showNavOnly, hideBars]);

  const handleTabChange = useCallback((tab: PortalTab) => {
    setActiveTab(tab);
    showBars();
    lastScrollY.current = 0;
    dragStartY.current = null;
    dragInitialY.current = null;
    isDragging.current = false;
    scrollDirection.current = null;
  }, [showBars]);

  const [isWaitingOnboardingLocation, setIsWaitingOnboardingLocation] = useState(
    Boolean(route.params?.triggerOnboardingLocationSetup)
  );

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkAndTriggerOnboardingLocation = async () => {
      let shouldTrigger = Boolean(route.params?.triggerOnboardingLocationSetup);
      if (!shouldTrigger) {
        try {
          const pendingFlag = await AsyncStorage.getItem('@sugo_pending_onboarding_location_setup');
          if (pendingFlag === 'true') {
            shouldTrigger = true;
            await AsyncStorage.removeItem('@sugo_pending_onboarding_location_setup');
          }
        } catch {}
      } else {
        await AsyncStorage.removeItem('@sugo_pending_onboarding_location_setup').catch(() => {});
      }

      if (!shouldTrigger || !isMounted) return;

      setIsWaitingOnboardingLocation(true);

      let targetLocation = route.params?.detectedLocation;
      if (!targetLocation) {
        try {
          const draftStr = await AsyncStorage.getItem('@sugo_onboarding_location_draft');
          if (draftStr) {
            targetLocation = JSON.parse(draftStr);
          }
        } catch {}
      }

      timer = setTimeout(() => {
        if (!isMounted) return;
        setIsWaitingOnboardingLocation(false);
        navigation.navigate('CustomerLocation', {
          user,
          initialMode: 'wizard',
          initialStep: targetLocation ? 2 : 1,
          detectedLocation: targetLocation ?? undefined,
        });
      }, 2000);
    };

    checkAndTriggerOnboardingLocation();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [route.params?.triggerOnboardingLocationSetup, route.params?.detectedLocation, navigation, user]);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    } else if (route.params?.focusedErrandId) {
      setActiveTab('track');
    }
  }, [route.params?.initialTab, route.params?.focusedErrandId]);

  const ACTIVE_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];

  // The errand list is kept per account (services/swrCache.ts, 2026-10-14), so
  // Home opens on the last list, even after a restart, while a fresh one loads.
  const errandsCacheKey = activeCustomerId ? `transactions:${activeCustomerId}` : null;

  /** Resolves whether the list changed, which is what paces the polling. */
  const fetchCustomerErrands = async (silent = false): Promise<boolean> => {
    if (!activeCustomerId) return false;
    if (!silent) setLoadingErrands(true);
    try {
      const response = await apiClient.get(`/customers/${activeCustomerId}/transactions`);
      const errands = response.data?.orders || [];
      const changed = errandsCacheKey ? writeCache(errandsCacheKey, errands, { persist: true }) : true;
      setDbErrands(errands);
      const active = errands.find((e: any) =>
        ACTIVE_STATUSES.includes(String(e.status).toUpperCase())
      );
      setActiveErrand(active || null);
      return changed;
    } catch (err) {
      console.error('[REST API] Error fetching errands:', err);
      return false;
    } finally {
      if (!silent) setLoadingErrands(false);
    }
  };

  // The phone's copy first, so the first frame is the last list, not a skeleton.
  useEffect(() => {
    if (!errandsCacheKey) return;
    let cancelled = false;
    void hydrateCache(errandsCacheKey).then(() => {
      const kept = readCache<any[]>(errandsCacheKey)?.data;
      if (cancelled || !kept) return;
      setDbErrands((current) => (current.length > 0 ? current : kept));
      setActiveErrand((current: any) =>
        current ?? kept.find((e: any) => ACTIVE_STATUSES.includes(String(e.status).toUpperCase())) ?? null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [errandsCacheKey]);

  // Live socket changes are kept too, so the next visit opens on them.
  useEffect(() => {
    if (errandsCacheKey && dbErrands.length > 0) writeCache(errandsCacheKey, dbErrands, { persist: true });
  }, [errandsCacheKey, dbErrands]);

  useEffect(() => {
    if (activeCustomerId) {
      const kept = errandsCacheKey ? readCache<any[]>(errandsCacheKey)?.data : undefined;
      fetchCustomerErrands(dbErrands.length > 0 || Boolean(kept && kept.length > 0));
    }
  }, [activeCustomerId, activeTab]);

  // Smart polling (2026-10-14), replacing a flat 15 s timer that ran even
  // behind other screens and with the app in the background. It runs only
  // while Home is in front, the app is open and the phone is online; it starts
  // at 15 s and doubles to 2 min while nothing changes. Live changes arrive by
  // socket anyway; this is the safety net for a missed one.
  useSmartPolling(() => fetchCustomerErrands(true), {
    enabled: Boolean(activeCustomerId) && activeTab === 'home' && isScreenFocused,
    minMs: 15 * 1000,
    maxMs: 2 * 60 * 1000,
  });

  useEffect(() => {
    const activeIds = dbErrands
      .filter((e: any) => ACTIVE_STATUSES.includes(String(e.status || '').toUpperCase()))
      .map((e: any) => String(e.id));
    syncActiveErrands?.(activeIds);
  }, [dbErrands, syncActiveErrands]);

  /**
   * The errand a dispatcher just accepted, if the customer has not dealt with
   * it yet. Null the rest of the time.
   */
  const [acceptedErrand, setAcceptedErrand] = useState<{
    errandId: string;
    dispatcherName: string | null;
    storeSummary: string;
  } | null>(null);

  /**
   * Errands already announced, so the dialog cannot reappear.
   *
   * `order:claimed` is a global broadcast and the socket reconnects on every
   * resume — without this, backgrounding and reopening the app would pop the
   * same dialog again, which is how a helpful interruption turns into a
   * nuisance the customer learns to dismiss without reading.
   */
  const announcedErrandsRef = useRef<Set<string>>(new Set());

  const openAcceptedChat = useCallback(() => {
    const target = acceptedErrand;
    setAcceptedErrand(null);
    if (!target) return;
    navigation.navigate('CustomerChat', {
      user,
      errandId: target.errandId,
      initialStatus: 'ACCEPTED',
    });
  }, [acceptedErrand, navigation, user]);

  const dismissAcceptedDialog = useCallback(() => setAcceptedErrand(null), []);

  const lastBackPressRef = useRef<number>(0);

  // Android Three-Key Navigation: Back button tab hierarchy & double-tap to exit
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (acceptedErrand) {
        dismissAcceptedDialog();
        return true;
      }
      if (isHelpModalOpen) {
        setIsHelpModalOpen(false);
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [acceptedErrand, isHelpModalOpen, activeTab, dismissAcceptedDialog]);

  /**
   * Push registration, plus what a tapped notification does.
   *
   * The payload carries the errand id, so tapping "Maria is handling your
   * errand" opens that conversation directly. Without it a customer running
   * several errands would be dropped somewhere generic and left to work out
   * which one the notification meant.
   */
  const handlePushTapped = useCallback(
    (payload: PushTapPayload) => {
      const type = String(payload?.type || '').toUpperCase();
      if (type === 'RIDER_NEARBY' || type.includes('NEARBY') || type.includes('PROXIMITY')) {
        setActiveTab('track');
        if (payload?.errandId) {
          navigation.setParams({ focusedErrandId: String(payload.errandId) });
        }
        return;
      }

      if (payload?.errandId) {
        navigation.navigate('CustomerChat', {
          user,
          errandId: String(payload.errandId),
        });
      }
    },
    [navigation, user]
  );

  useRegisterPushToken(activeCustomerId || undefined, handlePushTapped);

  // Live status sync
  useEffect(() => {
    let detach: (() => void) | undefined;

    // `order:updated` and `order:new` are global broadcasts — every connected
    // client receives every customer's events — so each payload has to be
    // matched against this account before it touches state.
    const belongsToUser = (errand: any) =>
      Boolean(activeCustomerId && String(errand?.customerId ?? '') === String(activeCustomerId));

    const onOrderUpdated = (updatedErrand: any) => {
      const updatedId = String(updatedErrand?.id ?? '');
      if (!updatedId) return;

      setDbErrands((prev) => {
        const exists = prev.some((e) => String(e.id) === updatedId);

        // An update for an errand not yet in state used to be dropped on the
        // floor, because this only ever mapped over what was already loaded.
        // That is why a just-placed errand did not appear until the screen was
        // left and re-entered: the remount re-ran the HTTP fetch. Insert it,
        // but only when it is actually this customer's.
        if (!exists) {
          if (!belongsToUser(updatedErrand)) return prev;
          const next = [updatedErrand, ...prev];
          setActiveErrand(
            next.find((e: any) => ACTIVE_STATUSES.includes(String(e.status).toUpperCase())) || null
          );
          return next;
        }

        const next = prev.map((e) =>
          String(e.id) === updatedId ? { ...e, ...updatedErrand } : e
        );
        const active = next.find((e: any) =>
          ACTIVE_STATUSES.includes(String(e.status).toUpperCase())
        );
        setActiveErrand(active || null);
        return next;
      });
    };

    // The server has always emitted this; nothing in the customer app listened
    // for it. A new errand therefore never arrived live.
    const onOrderNew = (newErrand: any) => {
      if (!newErrand?.id || !belongsToUser(newErrand)) return;
      onOrderUpdated(newErrand);
    };

    // Anything that happened while the socket was down produced events this
    // device never saw, and no further event is coming to announce them. A full
    // re-fetch on reconnect is the only way to close that gap.
    const onReconnect = () => {
      void fetchCustomerErrands();
    };

    // A dispatcher taking the errand on. Merged into state like any other
    // update, and additionally surfaced as a dialog, because this is the one
    // status change the customer has been actively waiting for.
    const onOrderClaimed = (claimedErrand: any) => {
      if (!claimedErrand?.id || !belongsToUser(claimedErrand)) return;

      onOrderUpdated(claimedErrand);

      const errandId = String(claimedErrand.id);
      if (announcedErrandsRef.current.has(errandId)) return;
      announcedErrandsRef.current.add(errandId);

      const latestLog = Array.isArray(claimedErrand.dispatchLogs)
        ? claimedErrand.dispatchLogs[claimedErrand.dispatchLogs.length - 1]
        : null;
      const dispatcherName = latestLog?.dispatcher?.name || null;
      const storeSummary = (claimedErrand.pinpoints || [])
        .map((p: any) => p.storeName)
        .filter(Boolean)
        .join(' & ');

      setAcceptedErrand({ errandId, dispatcherName, storeSummary });
    };

    void getSocket().then((socket) => {
      socket.on('order:updated', onOrderUpdated);
      socket.on('order:new', onOrderNew);
      socket.on('order:claimed', onOrderClaimed);
      socket.on('connect', onReconnect);
      detach = () => {
        socket.off('order:updated', onOrderUpdated);
        socket.off('order:new', onOrderNew);
        socket.off('order:claimed', onOrderClaimed);
        socket.off('connect', onReconnect);
      };
    });

    return () => {
      detach?.();
    };
  }, [activeCustomerId]);

  const isErrandActive = Boolean(
    activeErrand && ACTIVE_STATUSES.includes(String(activeErrand.status).toUpperCase())
  );

  const activeErrandsList = dbErrands.filter((e: any) =>
    ACTIVE_STATUSES.includes(String(e.status).toUpperCase())
  );

  const trackableErrands = dbErrands.filter(
    (e) => e.riderId != null && e.status !== 'COMPLETED' && e.status !== 'CANCELLED' && e.status !== 'DELIVERED'
  );

  useEffect(() => {
    if (!isErrandActive || !activeCustomerId) return;

    const active = trackableErrands[0];
    const latitude = Number(active?.deliveryLatitude ?? active?.latitude);
    const longitude = Number(active?.deliveryLongitude ?? active?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    void saveCustomerLocation(
      activeCustomerId,
      latitude,
      longitude,
      String(active?.deliveryAddress || 'Delivery address')
    );
  }, [activeCustomerId, isErrandActive, trackableErrands]);

  // The header's "Delivering to", from the shared, cached saved-locations list
  // (hooks/useSavedLocations.ts, 2026-10-14). On a slow connection the failed
  // fetch used to wipe the address and show "Set address" though the customer
  // had one; now the last list stays, and only "no list ever loaded" is an
  // error. A default changed in Saved Locations is here at once: same list.
  const {
    data: savedLocationsData,
    error: savedLocationsError,
    revalidate: revalidateSavedLocations,
  } = useSavedLocations(activeCustomerId);
  const refreshDefaultLocation = useCallback(
    (force = false) => {
      void revalidateSavedLocations({ force });
    },
    [revalidateSavedLocations]
  );

  useEffect(() => {
    if (savedLocationsData === undefined) {
      if (savedLocationsError !== null) setLocationStatus('error');
      return;
    }
    setCustomerSavedLocations(savedLocationsData);
    const def = defaultLocationOf(savedLocationsData);
    if (def) {
      setDefaultAddressText(def.address);
      setDefaultLocationLabel(def.label);
      setCustomerPinCoords(sanitizeCoordinate({ latitude: def.latitude, longitude: def.longitude }));
      setLocationStatus('set');
    } else {
      setDefaultAddressText(null);
      setDefaultLocationLabel(null);
      setLocationStatus('none');
    }
  }, [savedLocationsData, savedLocationsError]);

  // Saved Locations is pushed on top of this screen, so coming back from it is
  // a focus, not a mount. The list is shared, so a change made there is
  // already here; the focus only refreshes a list over a minute old.
  useEffect(() => {
    if (!activeCustomerId) return;
    return navigation.addListener('focus', () => refreshDefaultLocation());
  }, [activeCustomerId, navigation, refreshDefaultLocation]);

  // Home's "set your location first" spotlight is a Modal, which would stay on
  // top of Saved Locations once pushed; it shows only while this screen does.
  useEffect(() => {
    const offFocus = navigation.addListener?.('focus', () => setIsScreenFocused(true));
    const offBlur = navigation.addListener?.('blur', () => setIsScreenFocused(false));
    return () => {
      offFocus?.();
      offBlur?.();
    };
  }, [navigation]);

  const handleSaveLocationPin = (coords: MapCoordinate, label: string) => {
    if (!activeCustomerId) return;
    setCustomerPinCoords(coords);
    setDefaultLocationLabel(label);

    apiClient
      .post(`/customer-locations/${activeCustomerId}`, {
        label,
        address: `${label} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        isDefault: true,
      })
      .then(() => refreshDefaultLocation(true))
      .catch((err) => {
        console.error('Failed to persist customer location pin:', err.message);
      });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {/* The status strip, fixed, above everything Home slides under it. */}
      {activeTab === 'home' && (
        <View
          style={[styles.statusStrip, { backgroundColor: colors.bgApp, height: insets.top + Spacing.xs }]}
        />
      )}
      {activeTab === 'home' && (
        <View
          pointerEvents="box-none"
          style={[styles.topBar, { top: insets.top + Spacing.xs }]}
        >
          <Animated.View
            style={[
              styles.animatedHeaderRow,
              { backgroundColor: colors.bgApp, height: TOP_BAR_ROW_HEIGHT },
              animatedHeaderStyle,
            ]}
            pointerEvents={headerVisible ? 'auto' : 'none'}
            testID="home-collapsible-header"
          >
            {/* foodpanda's header (2026-10-14): where errands are delivered
                leads on the left, then the bell and the profile photo on the
                right. It used to open with the photo and the name in capitals,
                with the address squeezed beside the bell. The name is in the
                photo's label for screen readers, and on Account & Profile. */}
            <View style={styles.topBarRow}>
              <View style={styles.topBarLeft}>
                <HeaderLocationButton
                  label={defaultLocationLabel}
                  address={defaultAddressText}
                  onPress={() => navigation.navigate('CustomerLocation', { user })}
                  requireLocation={locationStatus === 'none' && isScreenFocused && !isWaitingOnboardingLocation}
                />
              </View>

              <View style={styles.topBarRightGroup}>
                <NotificationBell user={user} navigation={navigation} />

                {/* Profile photo (Clickable -> Account & Profile) */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Account', { user: currentUser })}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  testID="header-profile-btn"
                  accessibilityLabel={`View Account & Profile for ${customerDisplayName}`}
                  accessibilityRole="button"
                >
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={[
                        styles.headerProfileImage,
                        { borderColor: isDark ? 'rgba(255,255,255,0.15)' : colors.border },
                      ]}
                    />
                  ) : (
                    <View style={[styles.headerProfileAvatar, { backgroundColor: colors.primary }]}>
                      {userInitials ? (
                        <Text style={styles.headerProfileInitials} maxFontSizeMultiplier={1}>
                          {userInitials}
                        </Text>
                      ) : (
                        <UserIcon size={18} color="#FFFFFF" strokeWidth={2.2} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Main Tab Content Area. A blur target, so the bottom bar's liquid glass
          blurs the tab under it on Android too (2026-10-11). */}
      <BlurTargetView ref={tabContentRef} style={styles.mainContent}>
        <Animated.View key={activeTab} entering={FadeIn.duration(160)} style={{ flex: 1 }}>
          {activeTab === 'home' && (
            <HomeTab
              user={user}
              navigation={navigation}
              defaultAddressText={defaultAddressText}
              defaultLocationLabel={defaultLocationLabel}
              activeErrand={activeErrand}
              activeErrands={activeErrandsList}
              recentErrands={dbErrands}
              loading={loadingErrands}
              onRefresh={fetchCustomerErrands}
              onViewTrack={() => setActiveTab('track')}
              onNavigateErrands={() => setActiveTab('errands')}
              onScroll={handleTabScroll}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              headerSpace={TOP_BAR_ROW_HEIGHT}
              headerOffset={headerRowHeight}
            />
          )}
          {activeTab === 'errands' && (
            <ErrandsTab
              user={user}
              navigation={navigation}
              errands={dbErrands}
              loading={loadingErrands}
              onRefresh={fetchCustomerErrands}
              onViewTrack={() => setActiveTab('track')}
              onScroll={handleTabScroll}
            />
          )}
          {activeTab === 'track' && (
            <TrackTab
              user={user}
              navigation={navigation}
              activeErrands={trackableErrands}
              focusedErrandId={route.params?.focusedErrandId}
              onScroll={handleTabScroll}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              user={user}
              navigation={navigation}
              onScroll={handleTabScroll}
            />
          )}
          {/* Find stores as a tab: no scroll hiding, so the bar stays put. */}
          {activeTab === 'search' && (
            <StoreSearchView
              user={user}
              navigation={navigation}
              onBack={() => handleTabChange('home')}
              inTab
            />
          )}
        </Animated.View>

        {/* Customer Help & Support Modal */}
        <CustomerHelpModal
          visible={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
        />
      </BlurTargetView>

      {/* DISPATCHER ACCEPTED — announces itself and offers the chat.
          Acceptance is the moment a real person takes the errand on, and it
          used to pass silently: the socket event updated some state and nothing
          told the customer. Anyone not sitting on the waiting screen found out
          by going and looking.

          It carries the errand's own id, so a customer with several requests in
          flight lands in the RIGHT conversation rather than a list they have to
          disambiguate. Dismissing is a real choice — "Not now" keeps the errand
          exactly where it is and the chat stays reachable from Errands. */}
      <Modal
        visible={!!acceptedErrand}
        transparent
        animationType="fade"
        onRequestClose={dismissAcceptedDialog}
      >
        <Pressable style={styles.acceptedBackdrop} onPress={dismissAcceptedDialog}>
          <Pressable
            style={[
              styles.acceptedCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
            testID="errand-accepted-dialog"
          >
            <View style={[styles.acceptedHalo, { backgroundColor: isDark ? 'rgba(16,185,129,0.14)' : '#ECFDF5' }]}>
              <CheckCircle2 size={26} color="#059669" strokeWidth={2.4} />
            </View>

            <Text
              style={[styles.acceptedTitle, { color: colors.textDark }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
            >
              {acceptedErrand?.dispatcherName
                ? `${acceptedErrand.dispatcherName} is handling your errand`
                : 'A dispatcher is handling your errand'}
            </Text>

            <Text
              style={[styles.acceptedBody, { color: colors.textGray }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            >
              {acceptedErrand?.storeSummary
                ? `They'll confirm what's available at ${acceptedErrand.storeSummary} and the total before anything is bought.`
                : "They'll confirm availability and the total before anything is bought."}
            </Text>

            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.acceptedPrimaryBtn, { backgroundColor: colors.primary }]}
              onPress={openAcceptedChat}
              testID="errand-accepted-open-chat"
            >
              <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text
                style={styles.acceptedPrimaryText}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
              >
                Chat with dispatcher
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.acceptedSecondaryBtn}
              hitSlop={PortalTouchTargets.compactHitSlop}
              onPress={dismissAcceptedDialog}
              testID="errand-accepted-dismiss"
            >
              <Text
                style={[styles.acceptedSecondaryText, { color: colors.textGray }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                Not now
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bottom Navigation. Its Search button opens Find stores as a tab, so the
          bar stays (2026-10-14); Home's search field still opens it full screen. */}
      <BottomNav
        active={activeTab}
        onChange={handleTabChange}
        visible={navVisible}
        onVisibilityChange={setNavVisible}
        labelsVisible={navLabelsVisible}
        onLabelsVisibilityChange={setNavLabelsVisible}
        blurTarget={tabContentRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Over Home, not above it: Home's frame must not change as the bar hides.
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 60,
    elevation: 0,
  },
  statusStrip: {
    zIndex: 61,
  },
  animatedHeaderRow: {
    paddingHorizontal: Spacing.md + 4,
    overflow: 'hidden',
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingBottom: Spacing.sm + 2,
  },
  // The address takes whatever the bell and the photo leave, and truncates.
  topBarLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: Spacing.md,
    alignItems: 'flex-start',
  },
  appNameBranding: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg + 1,
    letterSpacing: -0.2,
  },
  greetingText: {
    fontSize: FontSizes.md + 1,
    fontFamily: FontFamily.bold,
    lineHeight: 22,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    flexShrink: 1,
    maxWidth: '100%',
  },
  locationText: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.medium,
    flexShrink: 1,
  },
  topBarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerProfileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  // Beside the bell now, not leading the row, so sized to sit level with it.
  headerProfileImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
  },
  headerProfileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileInitials: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
  mainContent: { flex: 1 },
  acceptedBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  acceptedCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  acceptedHalo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm + 2,
  },
  acceptedTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
    textAlign: 'center',
    marginBottom: 6,
  },
  acceptedBody: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  acceptedPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    minHeight: PortalTouchTargets.buttonHeight,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  acceptedPrimaryText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'label'),
  },
  acceptedSecondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
  },
  acceptedSecondaryText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
  },
});
