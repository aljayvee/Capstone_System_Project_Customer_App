import React, { useEffect, useState, useCallback } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { showAppAlert } from '../services/alertModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Mail,
  Phone,
  Pencil,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Settings,
  ShieldCheck,
  LogOut,
  Package,
  Award,
  HelpCircle,
  Camera,
  Image as ImageIcon,
  Trash2,
  X,
  Moon,
  Sun,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  BorderRadius,
  FontSizes,
  Spacing,
  FontFamily,
  Shadows,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import MapPreviewField, { MapMarkerSpec } from '../components/MapPreviewField';
import ConfirmModal from '../components/ConfirmModal';
import CustomerHelpModal from '../components/CustomerHelpModal';
import AppUpdatesModal from '../components/AppUpdatesModal';
import {
  checkCustomerAppUpdate,
  AppUpdateCheckResult,
} from '../services/appUpdateService';
import { MapCoordinate, DEFAULT_CENTER, sanitizeCoordinate } from '../utils/coords';
import { apiClient } from '../services/apiClient';
import { defaultLocationOf, useSavedLocations } from '../hooks/useSavedLocations';
import { hydrateCache, readCache, writeCache } from '../services/swrCache';
import { toUserMessage } from '../services/errorMessages';
import { safePickImage } from '../utils/safeImagePicker';
import { RootStackScreenProps } from '../navigation/types';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function fieldOrPlaceholder(value: string | undefined) {
  return value && value.trim() !== '' ? value : null;
}

export default function AccountScreen({ route, navigation }: RootStackScreenProps<'Account'>) {
  const { user: authUser, logout, updateUser } = useAuth();
  const { colors, isDark, setThemeMode } = useThemeColor();
  const { width: windowWidth } = useResponsive();
  const contentMaxWidth = Math.min(windowWidth - Spacing.md * 2, MAX_CONTENT_WIDTH);

  const initialUser =
    route.params?.user || authUser || {
      id: 1,
      username: 'customer',
      firstName: 'Customer',
      lastName: 'User',
    };

  const [currentUser, setCurrentUser] = useState<any>(initialUser);
  const [pinPickerVisible, setPinPickerVisible] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [staticMapError, setStaticMapError] = useState(false);
  const [completedErrandsCount, setCompletedErrandsCount] = useState<number>(0);

  const [defaultAddressText, setDefaultAddressText] = useState<string | null>(null);
  const [customerPinCoords, setCustomerPinCoords] = useState<MapCoordinate>(DEFAULT_CENTER);
  const [defaultLocationLabel, setDefaultLocationLabel] = useState<string | null>(null);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);

  // App Update Detection
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateCheckResult | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const fetchAppUpdate = useCallback(async () => {
    setCheckingUpdates(true);
    try {
      const res = await checkCustomerAppUpdate();
      setUpdateStatus(res);
    } finally {
      setCheckingUpdates(false);
    }
  }, []);

  useEffect(() => {
    fetchAppUpdate();
  }, [fetchAppUpdate]);

  useEffect(() => {
    if (!authUser) return;
    setCurrentUser((prev: any) => {
      const merged = { ...prev, ...authUser };
      const unchanged = Object.keys(merged).every((key) => merged[key] === prev?.[key]);
      return unchanged ? prev : merged;
    });
  }, [authUser]);

  // The default pin, from the shared, cached saved-locations list
  // (hooks/useSavedLocations.ts, 2026-10-14), as the Home header reads it. The
  // last list shows at once, a failed refresh keeps it (this screen used to
  // blank the pin on any error), and a default changed in Saved Locations is
  // here on return without asking again: it is the same list.
  const { data: savedLocationsData, revalidate: revalidateSavedLocations } = useSavedLocations(currentUser.id);
  const fetchLocations = useCallback(
    (force = false) => void revalidateSavedLocations({ force }),
    [revalidateSavedLocations]
  );

  useEffect(() => {
    if (savedLocationsData === undefined) return;
    setSavedLocations(savedLocationsData as any);
    const def = defaultLocationOf(savedLocationsData);
    if (def) {
      setDefaultAddressText(def.address);
      setDefaultLocationLabel(def.label);
      setCustomerPinCoords(sanitizeCoordinate({ latitude: def.latitude, longitude: def.longitude }));
    } else {
      setDefaultAddressText(null);
      setDefaultLocationLabel(null);
    }
  }, [savedLocationsData]);

  useEffect(() => {
    const isMountedRef = { current: true };
    const transactionsKey = `transactions:${currentUser.id}`;
    const countCompleted = (orders: any[]) =>
      orders.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length;

    // Home's kept errand list first, so the count is right on the first frame.
    void hydrateCache(transactionsKey).then(() => {
      const kept = readCache<any[]>(transactionsKey)?.data;
      if (isMountedRef.current && kept) setCompletedErrandsCount(countCompleted(kept));
    });

    apiClient
      .get(`/customers/${currentUser.id}/transactions`)
      .then((res) => {
        if (!isMountedRef.current) return;
        const orders: any[] = res.data?.orders || [];
        writeCache(transactionsKey, orders, { persist: true });
        setCompletedErrandsCount(countCompleted(orders));
      })
      .catch(() => {});

    // Saved Locations opens on top of this screen, so returning from it does
    // not remount. The list is shared, so a change made there is already
    // here; the focus only refreshes a list over a minute old.
    const unsubscribeFocus = navigation.addListener('focus', () => fetchLocations());

    return () => {
      isMountedRef.current = false;
      unsubscribeFocus();
    };
  }, [currentUser.id, fetchLocations]);

  const handleSaveLocationPin = (coords: MapCoordinate) => {
    const label = 'Pinned Location';
    setCustomerPinCoords(coords);
    setDefaultLocationLabel(label);

    apiClient
      .post(`/customer-locations/${currentUser.id}`, {
        label,
        address: `${label} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        isDefault: true,
      })
      .then(() => fetchLocations(true))
      .catch((err) => {
        console.error('Failed to persist customer location pin:', err.message);
      });
  };

  // Handle Photo Picker (Camera or Gallery)
  const handleSelectImage = async (mode: 'camera' | 'gallery') => {
    setShowPhotoModal(false);
    try {
      const asset = await safePickImage({
        mode,
        aspect: [1, 1],
        quality: 0.8,
        purpose: 'profile photo',
      });

      if (!asset) return;

      const fileName = asset.fileName || asset.uri.split('/').pop() || 'profile.jpg';
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      let mimeType = asset.mimeType || (fileExt === 'png' ? 'image/png' : 'image/jpeg');
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      const isValidMime =
        ALLOWED_MIME_TYPES.includes(mimeType) || ['jpg', 'jpeg', 'png'].includes(fileExt || '');
      if (!isValidMime) {
        showAppAlert({
          title: 'Invalid Format',
          message: 'Only .jpeg, .jpg, and .png image files are allowed.',
          variant: 'error',
        });
        return;
      }

      const fileSize =
        asset.fileSize || (asset.base64 ? Math.round((asset.base64.length * 3) / 4) : 0);
      if (fileSize > MAX_IMAGE_SIZE_BYTES) {
        showAppAlert({
          title: 'Photo Too Large',
          message: 'Maximum allowed photo size is 5MB.',
          variant: 'warning',
        });
        return;
      }

      if (!asset.base64) {
        showAppAlert({
          title: 'Upload Error',
          message: 'Could not read photo data. Please try again.',
          variant: 'error',
        });
        return;
      }

      const photoData = `data:${mimeType};base64,${asset.base64}`;
      setUploadingPhoto(true);

      const uploadRes = await apiClient.put(`/customers/${currentUser.id}/photo`, {
        photoData,
        mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
        fileSize,
        fileName,
      });

      const updatedAvatar = uploadRes.data?.user?.avatar || photoData;
      setCurrentUser((prev: any) => ({ ...prev, avatar: updatedAvatar }));
      if (updateUser) {
        await updateUser({ avatar: updatedAvatar });
      }
      showAppAlert({
        title: 'Success',
        message: 'Profile photo updated successfully!',
        variant: 'success',
      });
    } catch (err: any) {
      showAppAlert('Photo not saved', toUserMessage(err, 'profile'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle Remove Photo
  const handleRemovePhoto = async () => {
    setShowPhotoModal(false);
    try {
      setUploadingPhoto(true);
      await apiClient.delete(`/customers/${currentUser.id}/photo`);
      setCurrentUser((prev: any) => ({ ...prev, avatar: null }));
      if (updateUser) {
        await updateUser({ avatar: null });
      }
      showAppAlert({
        title: 'Success',
        message: 'Profile photo removed.',
        variant: 'success',
      });
    } catch (err: any) {
      showAppAlert('Photo not removed', toUserMessage(err, 'profile'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const email = fieldOrPlaceholder(currentUser.email);
  const phone = fieldOrPlaceholder(currentUser.phone);

  const locationMarkers: MapMarkerSpec[] = (savedLocations || []).map((loc) => ({
    key: String(loc.id || loc.label),
    coordinate: { latitude: Number(loc.latitude), longitude: Number(loc.longitude) },
    title: `${loc.label}${loc.isDefault ? ' (Default)' : ''}`,
    description: loc.address,
    pinColor: loc.isDefault ? colors.primary : '#3B82F6',
  }));

  const userInitials = `${(
    currentUser.firstName?.[0] ||
    currentUser.username?.[0] ||
    'C'
  ).toUpperCase()}${(currentUser.lastName?.[0] || '').toUpperCase()}`;

  // Google Static Map URL
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const hasCoordinates = customerPinCoords && customerPinCoords.latitude && customerPinCoords.longitude;
  const staticMapUrl =
    googleMapsApiKey && hasCoordinates && !staticMapError
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${customerPinCoords.latitude},${customerPinCoords.longitude}&zoom=16&size=640x260&scale=2&maptype=roadmap&markers=color:0xF62459%7C${customerPinCoords.latitude},${customerPinCoords.longitude}&key=${googleMapsApiKey}`
      : null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgApp }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      {/* 1. TOP NAV BAR WITH BACK BUTTON */}
      <View
        style={[
          styles.navHeaderRow,
          {
            borderBottomColor: colors.border,
            backgroundColor: colors.bgApp,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="back-button"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>

        <Text
          style={[styles.navTitle, { color: colors.textDark }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
        >
          Account & Profile
        </Text>

        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings', { user: currentUser })}
          hitSlop={PortalTouchTargets.compactHitSlop}
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          testID="account-settings-gear-button"
        >
          <Settings size={19} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { alignSelf: 'center', width: '100%', maxWidth: MAX_CONTENT_WIDTH },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. APP UPDATE ALERT BANNER */}
        {updateStatus?.isUpdateAvailable && !bannerDismissed && (
          <View
            style={[
              styles.updateBannerCard,
              {
                backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA',
              },
            ]}
          >
            <TouchableOpacity
              style={styles.updateBannerContent}
              activeOpacity={0.8}
              onPress={() => setShowUpdatesModal(true)}
              accessibilityRole="button"
              accessibilityLabel="View app updates"
            >
              <View style={[styles.updateBannerIconCircle, { backgroundColor: '#DC2626' }]}>
                <Sparkles size={14} color="#FFFFFF" />
              </View>
              <View style={styles.updateBannerTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.updateBannerTitle, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                    Sugo Express v{updateStatus.latestVersion} Available
                  </Text>
                  <View style={styles.updateNewChip}>
                    <Text style={styles.updateNewChipText}>NEW</Text>
                  </View>
                </View>
                <Text style={[styles.updateBannerSubtitle, { color: isDark ? '#F87171' : '#B91C1C' }]}>
                  Tap to view new features, fixes & download APK
                </Text>
              </View>
              <ChevronRight size={16} color={isDark ? '#FCA5A5' : '#991B1B'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.updateBannerDismissBtn}
              onPress={() => setBannerDismissed(true)}
              hitSlop={PortalTouchTargets.compactHitSlop}
              accessibilityRole="button"
              accessibilityLabel="Dismiss update notice"
            >
              <X size={14} color={isDark ? '#FCA5A5' : '#991B1B'} />
            </TouchableOpacity>
          </View>
        )}

        {/* 2. IDENTITY HERO (2026-10-14): the photo and the name are what this
            screen is about, so they lead it, centred and at the largest sizes
            on the page. The name used to be 16 pt, the same as the screen title,
            the stats and every section heading, beside a 52 dp photo, so nothing
            said whose account this was. Edit Profile moved off the name's line
            and quietened, so it no longer competes with it. */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowPhotoModal(true)}
            style={[
              styles.avatarRing,
              { borderColor: isDark ? 'rgba(246, 36, 89, 0.45)' : '#FBCFDA' },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            testID="profile-photo-button"
          >
            {currentUser.avatar ? (
              <Image source={{ uri: currentUser.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText} maxFontSizeMultiplier={1}>
                  {userInitials}
                </Text>
              </View>
            )}
            {uploadingPhoto ? (
              <View style={styles.avatarUploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View
                style={[
                  styles.avatarCameraBadge,
                  {
                    backgroundColor: colors.primary,
                    borderColor: isDark ? colors.bgApp : '#FFFFFF',
                  },
                ]}
              >
                <Camera size={15} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            )}
          </TouchableOpacity>

          <Text
            style={[styles.heroFullName, { color: colors.textDark }]}
            numberOfLines={2}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
            testID="profile-full-name"
          >
            {currentUser.firstName} {currentUser.lastName}
          </Text>
          <Text
            style={[styles.heroHandle, { color: colors.textGray }]}
            numberOfLines={1}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          >
            @{currentUser.username}
            {phone ? `  ·  ${phone}` : ''}
          </Text>

          <View style={styles.heroTagRow}>
            <View
              style={[
                styles.verifiedChip,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
                },
              ]}
            >
              <ShieldCheck size={12} color="#10B981" strokeWidth={2.4} />
              <Text
                style={styles.verifiedChipText}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                Verified Customer
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.editProfileBtn, { borderColor: colors.border }]}
              onPress={() => navigation.navigate('EditAccount', { user: currentUser })}
              hitSlop={PortalTouchTargets.compactHitSlop}
              testID="edit-profile-button"
              accessibilityRole="button"
              accessibilityLabel="Edit Profile"
            >
              <Pencil size={13} color={colors.textDark} strokeWidth={2.2} />
              <Text
                style={[styles.editProfileText, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2.5 QUICK ACTION & STATS ROW (CLEAN & SHADOW-FREE) */}
        <View style={styles.statsBentoRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.statsBentoTile,
              {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
            onPress={() => navigation.navigate('CustomerPortal', { user: currentUser, initialTab: 'errands' })}
            accessibilityRole="button"
            accessibilityLabel="View completed orders"
          >
            <View style={[styles.statsBentoIconBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFEEF3' }]}>
              <Package size={17} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text
              style={[styles.statsBentoNumber, { color: colors.textDark }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
            >
              {completedErrandsCount}
            </Text>
            <Text
              style={[styles.statsBentoLabel, { color: colors.textGray }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
            >
              Completed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.statsBentoTile,
              {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
            onPress={() => setPinPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Delivery pinpoint"
          >
            <View style={[styles.statsBentoIconBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF' }]}>
              <MapPin size={17} color="#3B82F6" strokeWidth={2.2} />
            </View>
            <Text
              style={[styles.statsBentoNumber, { color: colors.textDark }]}
              numberOfLines={1}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
            >
              Tacurong
            </Text>
            <Text
              style={[styles.statsBentoLabel, { color: colors.textGray }]}
              numberOfLines={1}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
            >
              {defaultLocationLabel || 'Default Pin'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. DEFAULT DELIVERY PIN SECTION (CLEAN & SHADOW-FREE) */}
        <View style={styles.pinSection}>
          <View style={styles.bentoCardHeader}>
            <View style={styles.bentoTitleGroup}>
              <View
                style={[
                  styles.bentoIconPill,
                  { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3' },
                ]}
              >
                <MapPin size={14} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text
                style={[styles.bentoCardTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
              >
                Default Delivery Pin
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.bentoActionChip}
              onPress={() => setPinPickerVisible(true)}
              hitSlop={PortalTouchTargets.compactHitSlop}
              accessibilityRole="button"
              accessibilityLabel="View delivery pin"
            >
              <Text
                style={[styles.bentoActionChipText, { color: colors.primary }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                View Pin
              </Text>
              <ChevronRight size={13} color={colors.primary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {defaultAddressText ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setPinPickerVisible(true)}
              style={[
                styles.mapSnapshotContainer,
                { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Interactive delivery pin map"
            >
              {staticMapUrl ? (
                <Image
                  source={{ uri: staticMapUrl }}
                  style={styles.staticMapImage}
                  onError={() => setStaticMapError(true)}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.staticMapFallback,
                    { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' },
                  ]}
                >
                  <View style={styles.radarRingOuter} />
                  <View style={styles.radarRingInner} />
                  <View style={[styles.radarPinBadge, { backgroundColor: colors.primary }]}>
                    <MapPin size={18} color="#FFFFFF" strokeWidth={2.4} />
                  </View>
                  <Text
                    style={[styles.radarLabelText, { color: colors.textDark }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                  >
                    Tacurong City Pinpoint
                  </Text>
                  <Text
                    style={[styles.radarCoordsText, { color: colors.textLight }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    {customerPinCoords.latitude.toFixed(4)}° N,{' '}
                    {customerPinCoords.longitude.toFixed(4)}° E
                  </Text>
                </View>
              )}

              {/* Overlaid Pill Badges */}
              <View style={styles.mapOverlayHeader}>
                <View
                  style={[
                    styles.mapLocationTag,
                    { backgroundColor: isDark ? 'rgba(10, 15, 29, 0.85)' : 'rgba(255, 255, 255, 0.92)' },
                  ]}
                >
                  <View style={styles.activeLocationDot} />
                  <Text
                    style={[
                      styles.mapLocationTagText,
                      { color: isDark ? '#F1F5F9' : '#1E293B' },
                    ]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    {defaultLocationLabel || 'Default Pin'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.mapTapChip,
                    { backgroundColor: isDark ? 'rgba(10, 15, 29, 0.85)' : 'rgba(255, 255, 255, 0.92)' },
                  ]}
                >
                  <Text
                    style={[styles.mapTapChipText, { color: colors.primary }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    Tap to view map
                  </Text>
                </View>
              </View>

              {/* Address Footer inside Map Container */}
              <View
                style={[
                  styles.mapAddressFooter,
                  {
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : '#FFFFFF',
                    borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                  },
                ]}
              >
                <Text
                  style={[styles.mapAddressMainText, { color: colors.textDark }]}
                  numberOfLines={2}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                >
                  {defaultAddressText}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPinPickerVisible(true)}
              style={[
                styles.emptyAddressBox,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="View delivery pin on map"
            >
              <View
                style={[
                  styles.emptyAddressIconBadge,
                  { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3' },
                ]}
              >
                <MapPin size={20} color={colors.primary} strokeWidth={2} />
              </View>
              <Text
                style={[styles.emptyAddressTitle, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
              >
                No Default Delivery Pinpoint Set
              </Text>
              <Text
                style={[styles.emptyAddressDesc, { color: colors.textGray }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
              >
                View your default delivery pin location on the Tacurong map.
              </Text>
              <View style={[styles.emptyAddressCTA, { backgroundColor: colors.primary }]}>
                <Text
                  style={styles.emptyAddressCTAText}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                >
                  View Delivery Pin on Map
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* 4. ACTIVITY & PREFERENCES (CLEAN & SHADOW-FREE) */}
        <View style={styles.groupSection}>
          <Text
            style={[styles.groupSectionHeader, { color: colors.textLight }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
          >
            ACTIVITY & PREFERENCES
          </Text>
          <View
            style={[
              styles.groupedCard,
              {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            {/* Row 1: Errands Completed */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.menuRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
              onPress={() => navigation.navigate('CustomerPortal', { user: currentUser, initialTab: 'errands' })}
              accessibilityRole="button"
              accessibilityLabel="View errand receipts"
            >
              <View
                style={[
                  styles.menuIconBadge,
                  { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFEEF3' },
                ]}
              >
                <Package size={17} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.menuTextCol}>
                <Text
                  style={[styles.menuTitle, { color: colors.textDark }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                >
                  Orders Completed
                </Text>
                <Text
                  style={[styles.menuSubtitle, { color: colors.textGray }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  View past receipts & errand history
                </Text>
              </View>
              <View style={styles.menuRightCol}>
                <Text
                  style={[styles.menuValueText, { color: colors.textDark }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                >
                  {completedErrandsCount}
                </Text>
                <ChevronRight size={16} color={colors.textLight} />
              </View>
            </TouchableOpacity>

            {/* Row 2: Saved Places */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.menuRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
              onPress={() => navigation.navigate('CustomerLocation', { user: currentUser })}
              accessibilityRole="button"
              accessibilityLabel="Manage saved locations"
            >
              <View
                style={[
                  styles.menuIconBadge,
                  { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF' },
                ]}
              >
                <MapPin size={17} color="#3B82F6" strokeWidth={2.2} />
              </View>
              <View style={styles.menuTextCol}>
                <Text
                  style={[styles.menuTitle, { color: colors.textDark }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                >
                  Saved Places
                </Text>
                <Text
                  style={[styles.menuSubtitle, { color: colors.textGray }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  Tacurong address pinpoints
                </Text>
              </View>
              <View style={styles.menuRightCol}>
                <Text
                  style={[styles.menuValueText, { color: colors.textDark }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                >
                  {savedLocations.length}
                </Text>
                <ChevronRight size={16} color={colors.textLight} />
              </View>
            </TouchableOpacity>

            {/* Row 3: Appearance & Theme Toggle */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.menuRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
              onPress={() => setThemeMode(isDark ? 'light' : 'dark')}
              accessibilityRole="button"
              accessibilityLabel="Toggle light and dark mode"
            >
              <View
                style={[
                  styles.menuIconBadge,
                  { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7' },
                ]}
              >
                {isDark ? (
                  <Moon size={17} color="#F59E0B" strokeWidth={2.2} />
                ) : (
                  <Sun size={17} color="#F59E0B" strokeWidth={2.2} />
                )}
              </View>
              <View style={styles.menuTextCol}>
                <Text
                  style={[styles.menuTitle, { color: colors.textDark }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                >
                  App Theme
                </Text>
                <Text
                  style={[styles.menuSubtitle, { color: colors.textGray }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  Tap to switch appearance
                </Text>
              </View>
              <View style={styles.menuRightCol}>
                <Text
                  style={[styles.menuValueText, { color: colors.textDark }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                >
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
                <ChevronRight size={16} color={colors.textLight} />
              </View>
            </TouchableOpacity>

            {/* Row 4: App Feedback & Reviews */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.menuRow, { borderBottomWidth: 0 }]}
              onPress={() => navigation.navigate('Feedback', { user: currentUser })}
              accessibilityRole="button"
              accessibilityLabel="App feedback and reviews"
            >
              <View
                style={[
                  styles.menuIconBadge,
                  { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFEEF3' },
                ]}
              >
                <MessageSquare size={17} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.menuTextCol}>
                <Text
                  style={[styles.menuTitle, { color: colors.textDark }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                >
                  App Feedback & Reviews
                </Text>
                <Text
                  style={[styles.menuSubtitle, { color: colors.textGray }]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  Send bugs, ratings & suggestions directly to developers
                </Text>
              </View>
              <View style={styles.menuRightCol}>
                <ChevronRight size={16} color={colors.textLight} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. SIGN OUT BUTTON (CLEAN & SHADOW-FREE) */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.logoutBtn,
              {
                backgroundColor: 'transparent',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
              },
            ]}
            onPress={() => setShowSignOutModal(true)}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID="account-logout-button"
            accessibilityRole="button"
            accessibilityLabel="Sign out of account"
          >
            <LogOut size={15} color={colors.danger} strokeWidth={2.2} />
            <Text
              style={[styles.logoutBtnText, { color: colors.danger }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            >
              Sign Out of Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* PHOTO SELECTION MODAL */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowPhotoModal(false)}
        >
          <Pressable
            style={[
              styles.photoModalCard,
              { backgroundColor: isDark ? colors.card : '#FFFFFF', borderColor: colors.border },
              Shadows.liftedUp,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.photoModalHeader}>
              <Text style={[styles.photoModalTitle, { color: colors.textDark }]}>
                Profile Photo
              </Text>
              <TouchableOpacity
                onPress={() => setShowPhotoModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.photoModalSub, { color: colors.textGray }]}>
              {currentUser.avatar
                ? 'Update or remove your current profile photo.'
                : 'Select an image from your device gallery to personalize your account.'}
            </Text>

            <View style={styles.photoModalOptions}>
              <TouchableOpacity
                style={[
                  styles.photoOptionBtn,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border },
                ]}
                onPress={() => handleSelectImage('gallery')}
                accessibilityRole="button"
                accessibilityLabel="Choose from Gallery"
              >
                <ImageIcon size={18} color={colors.primary} />
                <Text style={[styles.photoOptionText, { color: colors.textDark }]}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.photoOptionBtn,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: colors.border },
                ]}
                onPress={() => handleSelectImage('camera')}
                accessibilityRole="button"
                accessibilityLabel="Take a Photo"
              >
                <Camera size={18} color={colors.primary} />
                <Text style={[styles.photoOptionText, { color: colors.textDark }]}>
                  Take a Photo
                </Text>
              </TouchableOpacity>

              {currentUser.avatar && (
                <TouchableOpacity
                  style={[
                    styles.photoOptionBtn,
                    { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2', borderColor: 'rgba(239, 68, 68, 0.2)' },
                  ]}
                  onPress={handleRemovePhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Remove Current Photo"
                >
                  <Trash2 size={18} color={colors.danger} />
                  <Text style={[styles.photoOptionText, { color: colors.danger }]}>
                    Remove Current Photo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* DELIVERY PIN MAP MODAL (READ ONLY - NO PINNING, NO SAVE PINPOINT) */}
      <MapPreviewField
        editable={false}
        center={customerPinCoords}
        markers={locationMarkers}
        label="Delivery Pin Location"
        modalTitle="Delivery Pin Location"
        locationLabel={defaultLocationLabel}
        addressText={defaultAddressText}
        controlled={{
          visible: pinPickerVisible,
          onClose: () => setPinPickerVisible(false),
        }}
      />

      {/* CUSTOMER HELP & GUIDE MODAL */}
      <CustomerHelpModal
        visible={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {/* SIGN OUT ANTI-CHURN CONFIRM MODAL (INVERTED HIERARCHY: STAY SIGNED IN STANDS OUT) */}
      <ConfirmModal
        visible={showSignOutModal}
        title="Sign Out of Your Account?"
        message={`You have ${savedLocations.length} saved ${
          savedLocations.length === 1 ? 'place' : 'places'
        } and ${completedErrandsCount} completed ${
          completedErrandsCount === 1 ? 'errand' : 'errands'
        } recorded in Tacurong.\n\nAre you sure you want to sign out?`}
        confirmLabel="Yes, Sign Out"
        cancelLabel="Stay Signed In"
        primaryButton="cancel"
        buttonLayout="vertical"
        destructive={false}
        onConfirm={() => {
          setShowSignOutModal(false);
          logout();
        }}
        onCancel={() => setShowSignOutModal(false)}
      />

      {/* APP UPDATES & CHANGELOG MODAL */}
      <AppUpdatesModal
        visible={showUpdatesModal}
        updateStatus={updateStatus}
        checking={checkingUpdates}
        onRefresh={fetchAppUpdate}
        onClose={() => setShowUpdatesModal(false)}
      />
    </SafeAreaView>
  );
}

/** The profile photo, in dp: the largest element on the screen. */
const AVATAR_SIZE = 96;
const AVATAR_RING = 2.5;
const AVATAR_GAP = 3;

const styles = StyleSheet.create({
  updateBannerCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updateBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  updateBannerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBannerTextCol: {
    flex: 1,
  },
  updateBannerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
  },
  updateBannerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    marginTop: 1,
  },
  updateNewChip: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  updateNewChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  updateBannerDismissBtn: {
    padding: 6,
    marginLeft: 4,
  },
  container: {
    flex: 1,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: PortalTouchTargets.compact / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  settingsBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: PortalTouchTargets.compact / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },

  // 1. Identity Hero Section (Unboxed & Breathable)
  heroSection: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  pinSection: {
    marginBottom: Spacing.md,
  },

  // 2. Hero Identity: photo, then name, the two largest things on the screen.
  // A soft ring with a gap sets the photo apart from the page.
  avatarRing: {
    position: 'relative',
    width: AVATAR_SIZE + (AVATAR_RING + AVATAR_GAP) * 2,
    height: AVATAR_SIZE + (AVATAR_RING + AVATAR_GAP) * 2,
    borderRadius: (AVATAR_SIZE + (AVATAR_RING + AVATAR_GAP) * 2) / 2,
    borderWidth: AVATAR_RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarBadge: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 34,
    letterSpacing: 0.5,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFullName: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.hero),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.hero), 'display'),
    letterSpacing: -0.3,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  heroHandle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    textAlign: 'center',
    marginTop: 2,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm + 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  editProfileText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    minHeight: 28,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  verifiedChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    color: '#10B981',
  },

  // Stats Bento Row (Clean & Shadow-Free)
  statsBentoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statsBentoTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBentoIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statsBentoNumber: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    marginBottom: 1,
    textAlign: 'center',
  },
  statsBentoLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    textAlign: 'center',
  },

  // 3. Static Map Snapshot Bento
  bentoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  bentoTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bentoIconPill: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  bentoActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 36,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  bentoActionChipText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },
  mapSnapshotContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  staticMapImage: {
    width: '100%',
    height: 140,
  },
  staticMapFallback: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  radarRingOuter: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(246, 36, 89, 0.15)',
  },
  radarRingInner: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(246, 36, 89, 0.25)',
  },
  radarPinBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  radarLabelText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    marginTop: 2,
  },
  radarCoordsText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  mapOverlayHeader: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapLocationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    maxWidth: '65%',
  },
  activeLocationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  mapLocationTagText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  mapTapChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  mapTapChipText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  mapAddressFooter: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  mapAddressMainText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'heading'),
    marginBottom: 2,
  },
  mapAddressSubText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
  },

  // Empty Address Card
  emptyAddressBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAddressIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyAddressTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    marginBottom: 3,
  },
  emptyAddressDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    textAlign: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  emptyAddressCTA: {
    minHeight: PortalTouchTargets.buttonHeight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAddressCTAText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
    color: '#FFFFFF',
  },

  // Grouped Inset Sections (Apple / Uber Pattern)
  groupSection: {
    marginBottom: Spacing.md,
  },
  groupSectionHeader: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  groupedCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  menuIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.xs,
  },
  menuTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'heading'),
    marginBottom: 2,
  },
  menuSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
  },
  menuRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuValueText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
  },

  // 6. Sign Out Section
  logoutSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  logoutBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: PortalTouchTargets.buttonHeight,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: Spacing.sm,
  },
  logoutBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
  },
  versionFootnote: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
    textAlign: 'center',
  },

  // Photo Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  photoModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  photoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  photoModalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  photoModalSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  photoModalOptions: {
    gap: 8,
  },
  photoOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: PortalTouchTargets.compact,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
  },
  photoOptionText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
  },
});
