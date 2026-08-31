import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, MessageCircle, HelpCircle, User as UserIcon, CheckCircle2 } from 'lucide-react-native';
import { getSocket } from '../services/socketClient';
import { saveCustomerLocation } from '../firebase/location';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { FontSizes, FontFamily, Spacing, BorderRadius } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { MapCoordinate, DEFAULT_CENTER, sanitizeCoordinate } from '../utils/coords';
import { openErrandDestination } from '../utils/errandNavigation';
import { useRegisterPushToken, type PushTapPayload } from '../hooks/useRegisterPushToken';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';
import BottomNav, { PortalTab } from '../components/BottomNav';
import { NotificationBell } from '../components/NotificationBell';
import CustomerHelpModal from '../components/CustomerHelpModal';
import HomeTab from './portal/HomeTab';
import ErrandsTab from './portal/ErrandsTab';
import TrackTab from './portal/TrackTab';
import ChatTab from './portal/ChatTab';

export default function CustomerPortalScreen({ route, navigation }: any) {
  const { user: authUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const initialUser = route.params?.user || authUser || { id: '1', username: 'customer', firstName: 'Customer', lastName: 'User' };

  const [currentUser, setCurrentUser] = useState<any>(initialUser);

  useEffect(() => {
    if (authUser) {
      setCurrentUser((prev: any) => ({ ...prev, ...authUser }));
    }
  }, [authUser]);

  const user = currentUser;
  const avatarUri = currentUser?.avatar || currentUser?.profilePicture || currentUser?.photoUrl;
  const userInitials = (
    (currentUser?.firstName?.[0] || '') + (currentUser?.lastName?.[0] || '')
  ).toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || 'U';
  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  const [dbErrands, setDbErrands] = useState<any[]>([]);
  const [loadingErrands, setLoadingErrands] = useState(false);

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const [defaultAddressText, setDefaultAddressText] = useState<string | null>(null);
  const [customerPinCoords, setCustomerPinCoords] = useState<MapCoordinate>(DEFAULT_CENTER);
  const [defaultLocationLabel, setDefaultLocationLabel] = useState<string | null>(null);
  const [customerSavedLocations, setCustomerSavedLocations] = useState<any[]>([]);

  const [activeErrand, setActiveErrand] = useState<any>(null);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const ACTIVE_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];

  const fetchCustomerErrands = async () => {
    setLoadingErrands(true);
    try {
      const response = await apiClient.get(`/customers/${user.id}/transactions`);
      const errands = response.data?.orders || [];
      setDbErrands(errands);
      const active = errands.find((e: any) =>
        ACTIVE_STATUSES.includes(String(e.status).toUpperCase())
      );
      setActiveErrand(active || null);
    } catch (err) {
      console.error('[REST API] Error fetching errands:', err);
    } finally {
      setLoadingErrands(false);
    }
  };

  useEffect(() => {
    fetchCustomerErrands();
  }, [user.id]);

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
      if (payload?.errandId) {
        navigation.navigate('CustomerChat', {
          user,
          errandId: String(payload.errandId),
        });
      }
    },
    [navigation, user]
  );

  useRegisterPushToken(user?.id, handlePushTapped);

  // Live status sync
  useEffect(() => {
    let detach: (() => void) | undefined;

    // `order:updated` and `order:new` are global broadcasts — every connected
    // client receives every customer's events — so each payload has to be
    // matched against this account before it touches state.
    const belongsToUser = (errand: any) =>
      String(errand?.customerId ?? '') === String(user.id);

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
  }, [user.id]);

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
    if (!isErrandActive) return;

    const active = trackableErrands[0];
    const latitude = Number(active?.deliveryLatitude ?? active?.latitude);
    const longitude = Number(active?.deliveryLongitude ?? active?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    void saveCustomerLocation(
      user.id,
      latitude,
      longitude,
      String(active?.deliveryAddress || 'Delivery address')
    );
  }, [user.id, isErrandActive, trackableErrands]);

  const refreshDefaultLocation = () => {
    apiClient
      .get(`/customer-locations/${user.id}`)
      .then((res) => {
        const locations: Array<{ id: string; label: string; address: string; latitude: number; longitude: number; isDefault: boolean }> = res.data || [];
        setCustomerSavedLocations(locations);
        const def = locations.find((l) => l.isDefault) ?? locations[0];
        if (def) {
          setDefaultAddressText(def.address);
          setDefaultLocationLabel(def.label);
          setCustomerPinCoords(sanitizeCoordinate({ latitude: def.latitude, longitude: def.longitude }));
        } else {
          setDefaultAddressText(null);
          setDefaultLocationLabel(null);
        }
      })
      .catch((err) => {
        console.log('Customer default location load fallback:', err.message);
        setDefaultAddressText(null);
        setDefaultLocationLabel(null);
      });
  };

  useEffect(() => {
    refreshDefaultLocation();
  }, [user.id]);

  const handleSaveLocationPin = (coords: MapCoordinate, label: string) => {
    setCustomerPinCoords(coords);
    setDefaultLocationLabel(label);

    apiClient
      .post(`/customer-locations/${user.id}`, {
        label,
        address: `${label} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        isDefault: true,
      })
      .then(() => refreshDefaultLocation())
      .catch((err) => {
        console.error('Failed to persist customer location pin:', err.message);
      });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {activeTab === 'home' && (
        <View style={[styles.topBar, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + Spacing.xs }]}>
          <View style={styles.topBarRow}>
            {/* App Branding (Pure App Name matching sketch) */}
            <View style={styles.topBarLeft}>
              <Text style={[styles.appNameBranding, { color: colors.primary }]}>Sugo Express</Text>
            </View>

            {/* Right Action Icons: Help (?), Notification (🔔), Account / Profile (👤 / 🖼️) */}
            <View style={styles.topBarRightGroup}>
              {/* Get Help Button with clean grey icon */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerIconButton}
                onPress={() => setIsHelpModalOpen(true)}
                testID="header-get-help-btn"
                accessibilityLabel="Get Help & Guide"
              >
                <HelpCircle size={21} color={colors.textGray} strokeWidth={2} />
              </TouchableOpacity>

              {/* Notification Bell with standard amber color */}
              <NotificationBell user={user} navigation={navigation} />

              {/* Account / Profile Button with Customer Profile Picture */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.headerProfileBtn}
                onPress={() => navigation.navigate('Account', { user: currentUser })}
                testID="header-account-profile-btn"
                accessibilityLabel="View Account & Profile"
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
                    <Text style={styles.headerProfileInitials}>{userInitials}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Main Tab Content Area */}
      <View style={styles.mainContent}>
        <Animated.View key={activeTab} entering={FadeIn.duration(160).easing(Easing.out(Easing.quad))} style={{ flex: 1 }}>
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
            />
          )}
          {activeTab === 'track' && (
            <TrackTab
              user={user}
              navigation={navigation}
              activeErrands={trackableErrands}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              user={user}
              navigation={navigation}
            />
          )}
        </Animated.View>

        {/* Customer Help & Support Modal */}
        <CustomerHelpModal
          visible={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
        />
      </View>

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

            <Text style={[styles.acceptedTitle, { color: colors.textDark }]}>
              {acceptedErrand?.dispatcherName
                ? `${acceptedErrand.dispatcherName} is handling your errand`
                : 'A dispatcher is handling your errand'}
            </Text>

            <Text style={[styles.acceptedBody, { color: colors.textGray }]}>
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
              <Text style={styles.acceptedPrimaryText}>Chat with dispatcher</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.acceptedSecondaryBtn}
              onPress={dismissAcceptedDialog}
              testID="errand-accepted-dismiss"
            >
              <Text style={[styles.acceptedSecondaryText, { color: colors.textGray }]}>
                Not now
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bottom Navigation with (+) Pabili Action navigating to Store Categories (ErrandForm) */}
      <BottomNav
        active={activeTab}
        onChange={setActiveTab}
        onPabiliPress={() => navigation.navigate('ErrandForm', { user, selectedServices: ['Pabili'] })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: Spacing.md + 4,
    paddingBottom: Spacing.sm + 2,
    borderBottomWidth: 1,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarLeft: {
    flex: 1,
    marginRight: Spacing.sm,
    overflow: 'hidden',
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
    gap: 6,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  headerProfileImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  headerProfileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileInitials: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 11.5,
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
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginBottom: 6,
  },
  acceptedBody: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  acceptedPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
  },
  acceptedPrimaryText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
  acceptedSecondaryBtn: {
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
  },
  acceptedSecondaryText: {
    fontFamily: FontFamily.medium,
    fontSize: 12.5,
  },
});
