import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Mail,
  Phone,
  Pencil,
  Crosshair,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Settings,
  ShieldCheck,
  LogOut,
  Smartphone,
  Package,
  Award,
  HelpCircle,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import MapPreviewField, { MapMarkerSpec } from '../components/MapPreviewField';
import SettingsRow from '../components/SettingsRow';
import SettingsSection from '../components/SettingsSection';
import ConfirmModal from '../components/ConfirmModal';
import CustomerHelpModal from '../components/CustomerHelpModal';
import { MapCoordinate, DEFAULT_CENTER, sanitizeCoordinate } from '../utils/coords';
import { apiClient } from '../services/apiClient';
import { RootStackScreenProps } from '../navigation/types';

function fieldOrPlaceholder(value: string | undefined) {
  return value && value.trim() !== '' ? value : null;
}

export default function AccountScreen({ route, navigation }: RootStackScreenProps<'Account'>) {
  const { user: authUser, logout } = useAuth();
  const { colors, isDark } = useThemeColor();
  const initialUser = route.params?.user || authUser || { id: '1', username: 'customer', firstName: 'Customer', lastName: 'User' };

  const [currentUser, setCurrentUser] = useState<any>(initialUser);
  const [pinPickerVisible, setPinPickerVisible] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [completedErrandsCount, setCompletedErrandsCount] = useState<number>(0);

  const [defaultAddressText, setDefaultAddressText] = useState<string | null>(null);
  const [customerPinCoords, setCustomerPinCoords] = useState<MapCoordinate>(DEFAULT_CENTER);
  const [defaultLocationLabel, setDefaultLocationLabel] = useState<string | null>(null);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);

  useEffect(() => {
    if (!authUser) return;
    setCurrentUser((prev: any) => {
      const merged = { ...prev, ...authUser };
      const unchanged = Object.keys(merged).every((key) => merged[key] === prev?.[key]);
      return unchanged ? prev : merged;
    });
  }, [authUser]);

  const fetchLocations = (isMountedRef = { current: true }) => {
    apiClient
      .get(`/customer-locations/${currentUser.id}`)
      .then((res) => {
        if (!isMountedRef.current) return;
        const locations: Array<{ id: string; label: string; address: string; latitude: number; longitude: number; isDefault: boolean }> = res.data || [];
        setSavedLocations(locations);
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
      .catch(() => {
        if (isMountedRef.current) {
          setDefaultAddressText(null);
          setDefaultLocationLabel(null);
        }
      });
  };

  useEffect(() => {
    const isMountedRef = { current: true };
    fetchLocations(isMountedRef);

    apiClient
      .get(`/customers/${currentUser.id}/transactions`)
      .then((res) => {
        if (!isMountedRef.current) return;
        const orders: any[] = res.data?.orders || [];
        const completed = orders.filter(
          (o) => o.status === 'COMPLETED' || o.status === 'DELIVERED'
        ).length;
        setCompletedErrandsCount(completed);
      })
      .catch(() => {});

    return () => {
      isMountedRef.current = false;
    };
  }, [currentUser.id]);

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
      .then(() => fetchLocations())
      .catch((err) => {
        console.error('Failed to persist customer location pin:', err.message);
      });
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

  const userInitials = `${(currentUser.firstName?.[0] || currentUser.username?.[0] || 'C').toUpperCase()}${(currentUser.lastName?.[0] || '').toUpperCase()}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* 1. TOP NAV BAR WITH BACK BUTTON */}
      <View style={[styles.navHeaderRow, { borderBottomColor: colors.border, backgroundColor: colors.bgApp }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>

        <Text style={[styles.navTitle, { color: colors.textDark }]}>Account & Profile</Text>

        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
          onPress={() => navigation.navigate('Settings', { user: currentUser })}
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          testID="account-settings-gear-button"
        >
          <Settings size={19} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. ELEVATED BENTO PROFILE HERO CARD */}
        <View
          style={[
            styles.profileHeroCard,
            {
              backgroundColor: isDark ? colors.card : '#FFFFFF',
              borderColor: colors.border,
            },
            Shadows.soft,
          ]}
        >
          <View style={styles.profileHeroTop}>
            {currentUser.avatar ? (
              <Image source={{ uri: currentUser.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
            )}
            <View style={styles.profileTextCol}>
              <View style={styles.nameVerifiedRow}>
                <Text style={[styles.profileName, { color: colors.textDark }]} numberOfLines={1}>
                  {currentUser.firstName} {currentUser.lastName}
                </Text>
              </View>
              <Text style={[styles.usernameText, { color: colors.textGray }]}>@{currentUser.username}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.verifiedPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                  <ShieldCheck size={11} color="#10B981" />
                  <Text style={styles.verifiedText}>Verified Customer</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 3-COLUMN BENTO QUICK-STATS COUNTER (RETENTION / ENDOWMENT LOOP) */}
          <View
            style={[
              styles.statsBentoContainer,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
                borderColor: isDark ? colors.border : '#F0F2F5',
              },
            ]}
          >
            <View style={styles.statBentoItem}>
              <View style={[styles.statIconBadge, { backgroundColor: isDark ? 'rgba(246,36,89,0.15)' : '#FFF0F5' }]}>
                <Package size={13} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={[styles.statBentoNumber, { color: colors.textDark }]}>{completedErrandsCount}</Text>
              <Text style={[styles.statBentoLabel, { color: colors.textLight }]}>Errands</Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: isDark ? colors.border : '#E5E7EB' }]} />

            <View style={styles.statBentoItem}>
              <View style={[styles.statIconBadge, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}>
                <MapPin size={13} color="#3B82F6" strokeWidth={2.2} />
              </View>
              <Text style={[styles.statBentoNumber, { color: colors.textDark }]}>{savedLocations.length}</Text>
              <Text style={[styles.statBentoLabel, { color: colors.textLight }]}>Saved Places</Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: isDark ? colors.border : '#E5E7EB' }]} />

            <View style={styles.statBentoItem}>
              <View style={[styles.statIconBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5' }]}>
                <Award size={13} color="#10B981" strokeWidth={2.2} />
              </View>
              <Text style={[styles.statBentoNumber, { color: colors.textDark }]}>
                {completedErrandsCount >= 10 ? 'VIP' : completedErrandsCount >= 3 ? 'Regular' : 'Active'}
              </Text>
              <Text style={[styles.statBentoLabel, { color: colors.textLight }]}>Loyalty Tier</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.editProfileBtn, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFEEF3' }]}
            onPress={() => navigation.navigate('EditAccount', { user: currentUser })}
            testID="edit-profile-button"
          >
            <Pencil size={13} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.editProfileBtnText, { color: colors.primary }]}>Edit Profile Details</Text>
          </TouchableOpacity>
        </View>

        {/* 3. CONTACT INFORMATION */}
        <SettingsSection title="Account & Contact">
          <SettingsRow
            icon={Mail}
            label="Email Address"
            subtitle={email || 'Not set — tap to add email'}
            trailing={<ChevronRight size={16} color={colors.textLight} />}
            onPress={() => navigation.navigate('EditAccount', { user: currentUser })}
          />
          <SettingsRow
            icon={Phone}
            label="Mobile Number"
            subtitle={phone || 'Not set — tap to add phone'}
            trailing={<ChevronRight size={16} color={colors.textLight} />}
            onPress={() => navigation.navigate('EditAccount', { user: currentUser })}
          />
        </SettingsSection>

        {/* 4. DELIVERY LOCATION & MAP PINS */}
        <SettingsSection title="Delivery Addresses">
          <SettingsRow
            icon={Crosshair}
            label="Default Delivery Pin"
            subtitle={
              defaultAddressText
                ? (defaultLocationLabel ? `${defaultLocationLabel} · ${defaultAddressText}` : defaultAddressText)
                : 'No default pinpoint — tap to set on map'
            }
            trailing={<ChevronRight size={16} color={colors.textLight} />}
            onPress={() => setPinPickerVisible(true)}
            accessibilityLabel="Update delivery pin on map"
          />
          <SettingsRow
            icon={MapPin}
            label="Saved Delivery Locations"
            subtitle={savedLocations.length > 0 ? `${savedLocations.length} saved points across Tacurong` : 'Manage delivery points in Tacurong'}
            trailing={<ChevronRight size={16} color={colors.textLight} />}
            onPress={() => navigation.navigate('CustomerLocation', { user: currentUser })}
          />
        </SettingsSection>

        {/* 5. APP SETTINGS & SECURITY */}
        <SettingsSection title="Preferences & Security">
          <SettingsRow
            icon={Settings}
            label="Display & App Settings"
            subtitle="Theme mode (Light / Dark), notifications & cache"
            trailing={<ChevronRight size={16} color={colors.textLight} />}
            onPress={() => navigation.navigate('Settings', { user: currentUser })}
          />
          <SettingsRow
            icon={Smartphone}
            label="Hardware Device Security"
            subtitle="Protected via Device UUID & Tiered Rate Limiting"
            trailing={<ShieldCheck size={16} color="#10B981" />}
          />
        </SettingsSection>

        {/* 6. HELP & CUSTOMER GUIDE (CONVERSION & ZERO DEAD-END SUPPORT) */}
        <SettingsSection title="Help & Support">
          <SettingsRow
            icon={HelpCircle}
            label="Customer Guide & FAQs"
            subtitle="3-step errand workflow, pricing & COD help"
            trailing={<ChevronRight size={16} color={colors.textLight} />}
            onPress={() => setShowHelpModal(true)}
          />
        </SettingsSection>

        {/* 7. SIGN OUT BUTTON (ETHICAL ANTI-CHURN RETENTION) */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.logoutBtn, { borderColor: colors.danger }]}
            onPress={() => setShowSignOutModal(true)}
            testID="account-logout-button"
          >
            <LogOut size={16} color={colors.danger} />
            <Text style={[styles.logoutBtnText, { color: colors.danger }]}>Sign Out of Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* DELIVERY PIN MAP MODAL */}
      <MapPreviewField
        editable
        center={customerPinCoords}
        markers={locationMarkers}
        label="Update Delivery Pin"
        locationLabel={defaultLocationLabel}
        addressText={defaultAddressText}
        controlled={{ visible: pinPickerVisible, onClose: () => setPinPickerVisible(false) }}
        onConfirm={handleSaveLocationPin}
        confirmLabel="Save Pinpoint Location"
      />

      {/* CUSTOMER HELP & GUIDE MODAL */}
      <CustomerHelpModal
        visible={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {/* SIGN OUT ANTI-CHURN CONFIRM MODAL */}
      <ConfirmModal
        visible={showSignOutModal}
        title="Sign Out of Your Account?"
        message={`You have ${savedLocations.length} saved ${savedLocations.length === 1 ? 'place' : 'places'} and ${completedErrandsCount} completed ${completedErrandsCount === 1 ? 'errand' : 'errands'} recorded in Tacurong.\n\nAre you sure you want to sign out?`}
        confirmLabel="Yes, Sign Out"
        cancelLabel="Stay Signed In"
        destructive
        onConfirm={() => {
          setShowSignOutModal(false);
          logout();
        }}
        onCancel={() => setShowSignOutModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },
  profileHeroCard: {
    borderWidth: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm + 4,
  },
  profileHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 2,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.sm + 2,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: scaledFontSize(FontSizes.md + 1, 0.2),
  },
  profileTextCol: {
    flex: 1,
  },
  profileName: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
    marginBottom: 1,
  },
  usernameText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  verifiedText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(9.5, 0.2),
    color: '#10B981',
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsBentoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statBentoItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  statBentoNumber: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    letterSpacing: -0.2,
  },
  statBentoLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(9.5, 0.2),
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  editProfileBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  logoutSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  logoutBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
});
