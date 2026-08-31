import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Mail,
  Phone,
  Pencil,
  Crosshair,
  MapPin,
  ChevronRight,
  Settings,
  ShieldCheck,
  LogOut,
  Smartphone,
  Package,
  Award,
  HelpCircle,
} from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BorderRadius, FontSizes, Spacing, FontFamily, Shadows } from '../../config/theme';
import MapPreviewField, { MapMarkerSpec } from '../../components/MapPreviewField';
import SettingsRow from '../../components/SettingsRow';
import SettingsSection from '../../components/SettingsSection';
import ConfirmModal from '../../components/ConfirmModal';
import CustomerHelpModal from '../../components/CustomerHelpModal';
import { apiClient } from '../../services/apiClient';
import { MapCoordinate } from '../../utils/coords';

export interface AccountTabProps {
  navigation: any;
  currentUser: any;
  defaultAddressText: string;
  defaultLocationLabel: string | null;
  customerPinCoords: MapCoordinate;
  savedLocations?: any[];
  onEditProfile: () => void;
  onSaveLocationPin: (coordinate: MapCoordinate) => void;
  onLogout: () => void;
}

function fieldOrPlaceholder(value: string | undefined) {
  return value && value.trim() !== '' ? value : null;
}

export default function AccountTab({
  navigation,
  currentUser,
  defaultAddressText,
  defaultLocationLabel,
  customerPinCoords,
  savedLocations = [],
  onEditProfile,
  onSaveLocationPin,
  onLogout,
}: AccountTabProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const [pinPickerVisible, setPinPickerVisible] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [completedErrandsCount, setCompletedErrandsCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get(`/customers/${currentUser.id}/transactions`)
      .then((res) => {
        if (!isMounted) return;
        const orders: any[] = res.data?.orders || [];
        const completed = orders.filter(
          (o) => o.status === 'COMPLETED' || o.status === 'DELIVERED'
        ).length;
        setCompletedErrandsCount(completed);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [currentUser.id]);

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
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: Spacing.md,
        paddingTop: insets.top + Spacing.sm,
        paddingBottom: Spacing.xl * 2,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. HEADER ROW */}
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.textDark }]}>Account & Profile</Text>
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
            defaultLocationLabel !== null
              ? `${defaultLocationLabel} · ${defaultAddressText}`
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

      {/* DELIVERY PIN MAP MODAL */}
      <MapPreviewField
        editable
        center={customerPinCoords}
        markers={locationMarkers}
        label="Update Delivery Pin"
        locationLabel={defaultLocationLabel}
        addressText={defaultAddressText}
        controlled={{ visible: pinPickerVisible, onClose: () => setPinPickerVisible(false) }}
        onConfirm={onSaveLocationPin}
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
          onLogout();
        }}
        onCancel={() => setShowSignOutModal(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm + 4,
  },
  screenTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.lg,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 2,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.sm + 2,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
  },
  profileTextCol: {
    flex: 1,
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
    marginBottom: 1,
  },
  usernameText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    marginBottom: 3,
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
    fontSize: 10,
    color: '#10B981',
  },
  statsBentoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm + 2,
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
    fontSize: FontSizes.sm + 1,
    letterSpacing: -0.2,
  },
  statBentoLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
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
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  editProfileBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
  },
  logoutSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  logoutBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
  },
});
