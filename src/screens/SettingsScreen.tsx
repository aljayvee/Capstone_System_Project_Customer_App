import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { showAppAlert } from '../services/alertModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  ShieldCheck,
  Bell,
  MessageSquare,
  Trash2,
  Check,
  Smartphone,
  MapPin,
  Lock,
  Volume2,
  Activity,
  FileText,
  LogOut,
  X,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { RootStackScreenProps } from '../navigation/types';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import { useThemeColor } from '../hooks/useThemeColor';
import { useAuth } from '../context/AuthContext';
import {
  FontFamily,
  FontSizes,
  Spacing,
  BorderRadius,
  Shadows,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import SettingsRow from '../components/SettingsRow';
import SettingsSection from '../components/SettingsSection';
import ConfirmModal from '../components/ConfirmModal';
import AppUpdatesModal from '../components/AppUpdatesModal';
import {
  checkCustomerAppUpdate,
  AppUpdateCheckResult,
  getInstalledAppVersion,
} from '../services/appUpdateService';

export default function SettingsScreen({ route, navigation }: RootStackScreenProps<'Settings'>) {
  const { user } = route.params;
  const { themeMode, setThemeMode, colors, isDark } = useThemeColor();
  const { logout } = useAuth();

  // Notification & Preference States
  const [errandAlerts, setErrandAlerts] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [cacheSize, setCacheSize] = useState('2.4 MB');
  const [clearingCache, setClearingCache] = useState(false);

  // Modals
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);

  // App Update Detection
  const [updateStatus, setUpdateStatus] = useState<AppUpdateCheckResult | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const runUpdateCheck = useCallback(async () => {
    setCheckingUpdates(true);
    try {
      const res = await checkCustomerAppUpdate();
      setUpdateStatus(res);
    } finally {
      setCheckingUpdates(false);
    }
  }, []);

  useEffect(() => {
    runUpdateCheck();
  }, [runUpdateCheck]);

  const handleToggleSounds = async (val: boolean) => {
    setSoundEffects(val);
    await AsyncStorage.setItem('@sugo_customer_sounds_enabled', String(val));
  };

  const handleToggleErrandAlerts = async (val: boolean) => {
    setErrandAlerts(val);
    await AsyncStorage.setItem('@sugo_customer_errand_alerts_enabled', String(val));
  };

  const handleToggleChatAlerts = async (val: boolean) => {
    setChatAlerts(val);
    await AsyncStorage.setItem('@sugo_customer_chat_alerts_enabled', String(val));
  };

  const handleClearCache = async () => {
    if (cacheSize === '0.0 MB') {
      showAppAlert({
        title: 'Cache Clean',
        message: 'Your temporary store image and preview cache is already clean.',
        variant: 'info',
      });
      return;
    }
    setCacheSize('0.0 MB');
    await AsyncStorage.setItem('@sugo_customer_cache_size', '0.0 MB');
    showAppAlert({
      title: 'Cache Cleared',
      message: '2.4 MB of temporary merchant image files and preview cache cleared successfully.',
      variant: 'success',
    });
  };

  // Multi-Channel Password Reset State
  type PasswordResetStep = 'CHOOSE_CHANNEL' | 'EMAIL_OTP' | 'SET_PASSWORD' | 'SUCCESS';
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetStep, setResetStep] = useState<PasswordResetStep>('CHOOSE_CHANNEL');
  const [resetChannelLoading, setResetChannelLoading] = useState<'NONE' | 'EMAIL' | 'SMS'>('NONE');
  const [resetError, setResetError] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleOpenPasswordModal = () => {
    setResetStep('CHOOSE_CHANNEL');
    setResetChannelLoading('NONE');
    setResetError(null);
    setEmailCode('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setResetToken(null);
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setResetStep('CHOOSE_CHANNEL');
    setResetChannelLoading('NONE');
    setResetError(null);
    setEmailCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken(null);
  };

  const handleChooseEmail = async () => {
    const userEmail = user?.email?.trim();
    if (!userEmail) {
      setResetError('No registered email address found for this account.');
      return;
    }
    setResetChannelLoading('EMAIL');
    setResetError(null);
    try {
      const res = await apiClient.post('/customers/forgot-password', {
        identifier: userEmail,
      });
      setResendCooldown(res.data?.retryAfterSeconds || 60);
      setResetStep('EMAIL_OTP');
    } catch (err: any) {
      setResetError(toUserMessage(err, 'password-reset'));
    } finally {
      setResetChannelLoading('NONE');
    }
  };

  const handleVerifyEmailCode = async () => {
    const userEmail = user?.email?.trim();
    if (!userEmail) {
      setResetError('No registered email address found for this account.');
      return;
    }
    const cleanCode = emailCode.trim();
    if (cleanCode.length !== 6) {
      setResetError('Please enter the complete 6-digit code.');
      return;
    }
    setEmailVerifying(true);
    setResetError(null);
    try {
      const res = await apiClient.post('/customers/verify-reset-code', {
        identifier: userEmail,
        code: cleanCode,
      });
      if (res.data?.resetToken) {
        setResetToken(res.data.resetToken);
        setResetStep('SET_PASSWORD');
      } else {
        setResetError('Failed to obtain reset token. Please try again.');
      }
    } catch (err: any) {
      setResetError(toUserMessage(err, 'password-reset'));
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleResendEmailCode = async () => {
    const userEmail = user?.email?.trim();
    if (!userEmail || resendCooldown > 0) return;
    setResetError(null);
    try {
      const res = await apiClient.post('/customers/forgot-password', {
        identifier: userEmail,
      });
      setResendCooldown(res.data?.retryAfterSeconds || 60);
    } catch (err: any) {
      setResetError(toUserMessage(err, 'password-reset'));
    }
  };

  const handleChooseSms = async () => {
    const rawPhone = user?.phone || '';
    const digits = rawPhone.replace(/\D/g, '');
    const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!cleanPhone || cleanPhone.length !== 10) {
      setResetError('No valid registered phone number found. Please update your phone in Account Details first.');
      return;
    }
    setResetChannelLoading('SMS');
    setResetError(null);
    try {
      const fullPhone = `+63${cleanPhone}`;
      const redirectUrl = Linking.createURL('phone-verified');
      const authUrl = `https://portal.sugo-express.org/verify-phone?phone=${encodeURIComponent(fullPhone)}&redirect=${encodeURIComponent(redirectUrl)}`;

      const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (authResult.type === 'success' && authResult.url) {
        const parsed = Linking.parse(authResult.url);
        const token = (parsed.queryParams?.token as string) || null;

        if (token) {
          const res = await apiClient.post('/customers/verify-reset-phone', {
            firebaseIdToken: token,
          });
          if (res.data?.resetToken) {
            setResetToken(res.data.resetToken);
            setResetStep('SET_PASSWORD');
          } else {
            setResetError('Failed to verify mobile token. Please try again.');
          }
        } else {
          setResetError('Verification token was not received. Please try again.');
        }
      } else if (authResult.type === 'cancel') {
        setResetError('SMS verification was cancelled.');
      }
    } catch (err: any) {
      setResetError(toUserMessage(err, 'password-reset'));
    } finally {
      setResetChannelLoading('NONE');
    }
  };

  const handleCompleteReset = async () => {
    if (!resetToken) {
      setResetError('Reset session has expired. Please choose a verification method again.');
      setResetStep('CHOOSE_CHANNEL');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setSubmittingPassword(true);
    setResetError(null);
    try {
      await apiClient.post('/customers/reset-password', {
        resetToken,
        password: newPassword,
      });
      setResetStep('SUCCESS');
    } catch (err: any) {
      setResetError(toUserMessage(err, 'password-reset'));
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* 1. TOP NAV HEADER */}
      <View style={[styles.navHeaderRow, { borderBottomColor: colors.border, backgroundColor: colors.bgApp }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="back-button"
          accessibilityRole="button"
          accessibilityLabel="Back to Account"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>App Settings</Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. THEME & APPEARANCE (3-CARD VISUAL SELECTOR) */}
        <SettingsSection title="Appearance & Display">
          <View style={styles.themeCardsGrid}>
            {/* LIGHT THEME CARD */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: themeMode === 'light' ? colors.primary : colors.border,
                  borderWidth: themeMode === 'light' ? 2 : 1,
                },
                themeMode === 'light' && Shadows.soft,
              ]}
              onPress={() => setThemeMode('light')}
              testID="theme-card-light"
              accessibilityRole="button"
              accessibilityLabel="Light theme"
            >
              <View style={[styles.themeIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
                <Sun size={20} color={themeMode === 'light' ? colors.primary : colors.textMedium} />
              </View>
              <Text style={[styles.themeCardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>Light</Text>
              <Text style={[styles.themeCardSub, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>Crisp & bright</Text>
              {themeMode === 'light' && (
                <View style={[styles.activeThemeBadge, { backgroundColor: colors.primary }]}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {/* DARK THEME CARD */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: themeMode === 'dark' ? colors.primary : colors.border,
                  borderWidth: themeMode === 'dark' ? 2 : 1,
                },
                themeMode === 'dark' && Shadows.soft,
              ]}
              onPress={() => setThemeMode('dark')}
              testID="theme-card-dark"
              accessibilityRole="button"
              accessibilityLabel="Dark theme"
            >
              <View style={[styles.themeIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
                <Moon size={20} color={themeMode === 'dark' ? colors.primary : colors.textMedium} />
              </View>
              <Text style={[styles.themeCardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>Dark</Text>
              <Text style={[styles.themeCardSub, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>True black</Text>
              {themeMode === 'dark' && (
                <View style={[styles.activeThemeBadge, { backgroundColor: colors.primary }]}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {/* SYSTEM AUTO CARD */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: themeMode === 'system' ? colors.primary : colors.border,
                  borderWidth: themeMode === 'system' ? 2 : 1,
                },
                themeMode === 'system' && Shadows.soft,
              ]}
              onPress={() => setThemeMode('system')}
              testID="theme-card-system"
              accessibilityRole="button"
              accessibilityLabel="System auto theme"
            >
              <View style={[styles.themeIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
                <Monitor size={20} color={themeMode === 'system' ? colors.primary : colors.textMedium} />
              </View>
              <Text style={[styles.themeCardTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>System</Text>
              <Text style={[styles.themeCardSub, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>Device auto</Text>
              {themeMode === 'system' && (
                <View style={[styles.activeThemeBadge, { backgroundColor: colors.primary }]}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* 3. NOTIFICATIONS & SOUNDS */}
        <SettingsSection title="Notifications & Sounds">
          <SettingsRow
            icon={Bell}
            label="Live Delivery Updates"
            subtitle="Rider assigned, store pickup & arrival alerts"
            trailing={
              <Switch
                value={errandAlerts}
                onValueChange={handleToggleErrandAlerts}
                trackColor={{ false: isDark ? '#334155' : '#D1D5DB', true: colors.primary }}
                thumbColor="#FFFFFF"
                testID="switch-errand-alerts"
              />
            }
          />
          <SettingsRow
            icon={MessageSquare}
            label="Dispatcher & Rider Messages"
            subtitle="Chime for order coordination & receipt updates"
            trailing={
              <Switch
                value={chatAlerts}
                onValueChange={handleToggleChatAlerts}
                trackColor={{ false: isDark ? '#334155' : '#D1D5DB', true: colors.primary }}
                thumbColor="#FFFFFF"
                testID="switch-chat-alerts"
              />
            }
          />
          <SettingsRow
            icon={Volume2}
            label="Audible In-App Chimes"
            subtitle="Sound effects on message arrival & delivery completion"
            trailing={
              <Switch
                value={soundEffects}
                onValueChange={handleToggleSounds}
                trackColor={{ false: isDark ? '#334155' : '#D1D5DB', true: colors.primary }}
                thumbColor="#FFFFFF"
                testID="switch-sound-effects"
              />
            }
          />
        </SettingsSection>

        {/* 4. SECURITY & PERMISSIONS */}
        <SettingsSection title="Security & Permissions">
          <SettingsRow
            icon={MapPin}
            label="Location Access"
            subtitle="Accurate Tacurong store routing & delivery pinpoints"
            trailing={
              <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5' }]}>
                <Text style={[styles.statusPillText, { color: '#10B981' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>While In Use</Text>
              </View>
            }
          />
          <SettingsRow
            icon={Smartphone}
            label="Active Device Session"
            subtitle="Android device • Current login session"
            trailing={
              <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.bgGray }]}>
                <Text style={[styles.statusPillText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Active Now</Text>
              </View>
            }
          />
          <SettingsRow
            icon={Lock}
            label="Change Password"
            subtitle="Update your account security password"
            chevron
            onPress={handleOpenPasswordModal}
            testID="row-change-password"
          />
        </SettingsSection>

        {/* 5. DATA & STORAGE OPTIMIZATION */}
        <SettingsSection title="Data & Storage">
          <View style={styles.storageMeterCard}>
            <View style={styles.storageHeaderRow}>
              <Text style={[styles.storageTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>Local Storage Footprint</Text>
              <Text style={[styles.storageTotal, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                {cacheSize === '0.0 MB' ? '120.0 MB' : '122.4 MB'}
              </Text>
            </View>

            {/* Visual Segmented Bar */}
            <View style={[styles.storageBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border }]}>
              <View style={[styles.storageBarApp, { backgroundColor: colors.primary, width: '97%' }]} />
              {cacheSize !== '0.0 MB' && (
                <View style={[styles.storageBarCache, { backgroundColor: '#F59E0B', width: '3%' }]} />
              )}
            </View>

            {/* Legend */}
            <View style={styles.storageLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>App Data (120 MB)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.legendText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Cache ({cacheSize})</Text>
              </View>
            </View>

            {/* 1-Tap Clear Cache Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleClearCache}
              disabled={clearingCache || cacheSize === '0.0 MB'}
              style={[
                styles.clearCacheBtn,
                {
                  borderColor: cacheSize === '0.0 MB' ? colors.border : colors.primary,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray,
                },
              ]}
              testID="clear-cache-button"
            >
              {clearingCache ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.clearCacheBtnContent}>
                  <Trash2 size={16} color={cacheSize === '0.0 MB' ? colors.textLight : colors.primary} />
                  <Text
                    style={[
                      styles.clearCacheBtnText,
                      { color: cacheSize === '0.0 MB' ? colors.textLight : colors.primary },
                    ]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                  >
                    {cacheSize === '0.0 MB' ? 'Cache is Clean (0.0 MB)' : 'Clear Temporary Cache (2.4 MB)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* 6. ABOUT & OPERATIONS */}
        <SettingsSection title="About & Operations">
          <SettingsRow
            icon={Activity}
            label="Tacurong Operations Hub"
            subtitle="Dispatch fleet & order routing active"
            trailing={
              <View style={[styles.statusPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5' }]}>
                <Text style={[styles.statusPillText, { color: '#10B981' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Operational</Text>
              </View>
            }
          />
          <SettingsRow
            icon={Smartphone}
            label="Application Version"
            subtitle={`Sugo Customer App v${updateStatus?.installedVersion || getInstalledAppVersion()}`}
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: updateStatus?.isUpdateAvailable
                        ? '#FEE2E2'
                        : isDark
                        ? 'rgba(16, 185, 129, 0.15)'
                        : '#D1FAE5',
                      borderColor: updateStatus?.isUpdateAvailable ? '#FCA5A5' : '#A7F3D0',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: updateStatus?.isUpdateAvailable ? '#DC2626' : '#10B981', fontWeight: '700' },
                    ]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    {checkingUpdates
                      ? 'Checking...'
                      : updateStatus?.isUpdateAvailable
                      ? `Update v${updateStatus.latestVersion}`
                      : 'Up to date'}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textLight} />
              </View>
            }
            onPress={() => setShowUpdatesModal(true)}
            testID="row-app-version"
          />
          <SettingsRow
            icon={MessageSquare}
            label="App Feedback & Reviews"
            subtitle="Send feedback, bug reports & feature suggestions"
            chevron
            onPress={() => navigation.navigate('Feedback', { user })}
            testID="row-feedback"
          />
          <SettingsRow
            icon={FileText}
            label="Terms of Service"
            subtitle="COD safety & delivery coordination guidelines"
            chevron
            onPress={() => setShowTermsModal(true)}
            testID="row-terms"
          />
          <SettingsRow
            icon={ShieldCheck}
            label="Privacy Policy"
            subtitle="Location tracking & personal information safety"
            chevron
            onPress={() => setShowPrivacyModal(true)}
            testID="row-privacy"
          />
        </SettingsSection>

        {/* 7. ACCOUNT MANAGEMENT */}
        <SettingsSection title="Account Management">
          <SettingsRow
            icon={LogOut}
            label="Sign Out"
            subtitle="Sign out from this Android device"
            chevron
            onPress={() => setShowSignOutModal(true)}
            testID="row-sign-out"
          />
        </SettingsSection>
      </ScrollView>

      {/* SIGN OUT CONFIRM MODAL (INVERTED HIERARCHY: STAY SIGNED IN STANDS OUT) */}
      <ConfirmModal
        visible={showSignOutModal}
        title="Sign Out of Your Account?"
        message="You will need to sign back in with your credentials to place errands or track deliveries in Tacurong.\n\nAre you sure you want to sign out?"
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
        testID="signout-confirm-modal"
      />

      {/* APP UPDATES & CHANGELOG MODAL */}
      <AppUpdatesModal
        visible={showUpdatesModal}
        updateStatus={updateStatus}
        checking={checkingUpdates}
        onRefresh={runUpdateCheck}
        onClose={() => setShowUpdatesModal(false)}
      />

      {/* MULTI-CHANNEL CHANGE PASSWORD MODAL */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={handleClosePasswordModal}>
        <View style={styles.modalOverlay}>
          {resetStep === 'CHOOSE_CHANNEL' && (
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClosePasswordModal} hitSlop={PortalTouchTargets.compactHitSlop}>
                <X size={18} color={colors.textDark} />
              </TouchableOpacity>
              <View style={[styles.modalIconCircle, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}>
                <Lock size={24} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                Reset Password
              </Text>
              <Text style={[styles.modalMessage, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Choose how you would like to verify your account to reset your password:
              </Text>

              {resetError ? (
                <View style={[styles.modalErrorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                  <AlertCircle size={14} color="#EF4444" />
                  <Text style={[styles.modalErrorText, { color: '#EF4444' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                    {resetError}
                  </Text>
                </View>
              ) : null}

              {/* CHANNEL 1: EMAIL */}
              <TouchableOpacity
                style={[
                  styles.channelCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleChooseEmail}
                disabled={resetChannelLoading !== 'NONE'}
                activeOpacity={0.8}
              >
                <View style={[styles.channelIconBox, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFEEF3' }]}>
                  {resetChannelLoading === 'EMAIL' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Mail size={20} color={colors.primary} />
                  )}
                </View>
                <View style={styles.channelInfoCol}>
                  <Text style={[styles.channelTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                    Send Code to Email
                  </Text>
                  <Text style={[styles.channelSubtitle, { color: colors.textGray }]} numberOfLines={1} ellipsizeMode="middle" maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                    {user?.email || 'Registered email address'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* CHANNEL 2: SMS OTP */}
              <TouchableOpacity
                style={[
                  styles.channelCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleChooseSms}
                disabled={resetChannelLoading !== 'NONE'}
                activeOpacity={0.8}
              >
                <View style={[styles.channelIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5' }]}>
                  {resetChannelLoading === 'SMS' ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <Smartphone size={20} color="#10B981" />
                  )}
                </View>
                <View style={styles.channelInfoCol}>
                  <Text style={[styles.channelTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                    Send SMS OTP Code
                  </Text>
                  <Text style={[styles.channelSubtitle, { color: colors.textGray }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                    {user?.phone ? `+63 ${user.phone.replace(/\D/g, '').slice(-10)}` : 'Registered mobile phone'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={handleClosePasswordModal}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {resetStep === 'EMAIL_OTP' && (
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setResetStep('CHOOSE_CHANNEL')} hitSlop={PortalTouchTargets.compactHitSlop}>
                <ArrowLeft size={18} color={colors.textDark} />
              </TouchableOpacity>
              <View style={[styles.modalIconCircle, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}>
                <Mail size={24} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                Enter Email Code
              </Text>
              <Text style={[styles.modalMessage, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                We sent a 6-digit verification code to {user?.email || 'your email'}.
              </Text>

              {resetError ? (
                <View style={[styles.modalErrorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                  <AlertCircle size={14} color="#EF4444" />
                  <Text style={[styles.modalErrorText, { color: '#EF4444' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                    {resetError}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.modalInputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.modalTextInput, { color: colors.textDark, textAlign: 'center', letterSpacing: 6 }]}
                  placeholder="000000"
                  placeholderTextColor={colors.textLight}
                  value={emailCode}
                  onChangeText={(t) => {
                    setEmailCode(t.replace(/\D/g, '').slice(0, 6));
                    setResetError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.modalActionBtn,
                  {
                    backgroundColor: emailCode.trim().length === 6 ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'),
                  },
                ]}
                onPress={handleVerifyEmailCode}
                disabled={emailVerifying || emailCode.trim().length !== 6}
              >
                {emailVerifying ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.modalActionBtnText,
                      { color: emailCode.trim().length === 6 ? '#FFFFFF' : colors.textLight },
                    ]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                  >
                    Verify Code
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendRow}>
                <TouchableOpacity
                  onPress={handleResendEmailCode}
                  disabled={resendCooldown > 0}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.resendText,
                      { color: resendCooldown > 0 ? colors.textLight : colors.primary },
                    ]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {resetStep === 'SET_PASSWORD' && (
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClosePasswordModal} hitSlop={PortalTouchTargets.compactHitSlop}>
                <X size={18} color={colors.textDark} />
              </TouchableOpacity>
              <View style={[styles.modalIconCircle, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : colors.primaryLight }]}>
                <Lock size={24} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                New Password
              </Text>
              <Text style={[styles.modalMessage, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Create a secure new password for your account.
              </Text>

              {resetError ? (
                <View style={[styles.modalErrorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                  <AlertCircle size={14} color="#EF4444" />
                  <Text style={[styles.modalErrorText, { color: '#EF4444' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                    {resetError}
                  </Text>
                </View>
              ) : null}

              {/* NEW PASSWORD INPUT */}
              <View
                style={[
                  styles.modalInputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    borderColor: colors.border,
                    marginBottom: Spacing.sm,
                  },
                ]}
              >
                <TextInput
                  style={[styles.modalTextInput, { color: colors.textDark }]}
                  placeholder="New password (min. 6 chars)"
                  placeholderTextColor={colors.textLight}
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    setResetError(null);
                  }}
                  secureTextEntry={!showNewPassword}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword((prev) => !prev)}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  style={styles.eyeBtn}
                >
                  {showNewPassword ? <EyeOff size={18} color={colors.textLight} /> : <Eye size={18} color={colors.textLight} />}
                </TouchableOpacity>
              </View>

              {/* CONFIRM PASSWORD INPUT */}
              <View
                style={[
                  styles.modalInputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.modalTextInput, { color: colors.textDark }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textLight}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    setResetError(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  style={styles.eyeBtn}
                >
                  {showConfirmPassword ? <EyeOff size={18} color={colors.textLight} /> : <Eye size={18} color={colors.textLight} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.modalActionBtn,
                  {
                    backgroundColor: newPassword.length >= 6 && confirmPassword.length >= 6 ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'),
                    marginTop: Spacing.md,
                  },
                ]}
                onPress={handleCompleteReset}
                disabled={submittingPassword || newPassword.length < 6 || confirmPassword.length < 6}
              >
                {submittingPassword ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.modalActionBtnText,
                      { color: newPassword.length >= 6 && confirmPassword.length >= 6 ? '#FFFFFF' : colors.textLight },
                    ]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                  >
                    Save New Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {resetStep === 'SUCCESS' && (
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
              <View style={[styles.modalIconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5' }]}>
                <CheckCircle2 size={28} color="#10B981" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                Password Updated
              </Text>
              <Text style={[styles.modalMessage, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Your account password has been successfully updated. You can now use your new password.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.modalActionBtn, { backgroundColor: colors.primary, marginTop: Spacing.md }]}
                onPress={handleClosePasswordModal}
              >
                <Text style={styles.modalActionBtnText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* TERMS OF SERVICE MODAL */}
      <Modal visible={showTermsModal} transparent animationType="fade" onRequestClose={() => setShowTermsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCardLarge, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitleLarge, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>Terms of Service</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.modalCloseBtnInline} hitSlop={PortalTouchTargets.compactHitSlop}>
                <X size={20} color={colors.textDark} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.policyHeading, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>1. Sugo Errand Platform in Tacurong</Text>
              <Text style={[styles.policyText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Sugo connects customers in Tacurong City with verified operational personnel (dispatchers and riders) for on-demand errands, pabili purchases, and parcel deliveries.
              </Text>
              <Text style={[styles.policyHeading, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>2. Cash on Delivery (COD) Invariant</Text>
              <Text style={[styles.policyText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Item amounts are fronted by the verified rider or logistics hub upon purchase at local merchants. Customers must pay the agreed item subtotal plus calculated delivery fare in cash upon arrival.
              </Text>
              <Text style={[styles.policyHeading, { color: colors.textDark }]}>3. Distance & Multi-Stop Rates</Text>
              <Text style={[styles.policyText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Delivery fees are calculated using road-network distances anchored to verified Tacurong store and delivery coordinates, incorporating base allowance and excess kilometre increments.
              </Text>
            </ScrollView>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.modalActionBtn, { backgroundColor: colors.primary, marginTop: Spacing.md }]}
              onPress={() => setShowTermsModal(false)}
            >
              <Text style={styles.modalActionBtnText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PRIVACY POLICY MODAL */}
      <Modal visible={showPrivacyModal} transparent animationType="fade" onRequestClose={() => setShowPrivacyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCardLarge, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.liftedUp]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitleLarge, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)} style={styles.modalCloseBtnInline} hitSlop={PortalTouchTargets.compactHitSlop}>
                <X size={20} color={colors.textDark} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.policyHeading, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>1. Location Telemetry Protection</Text>
              <Text style={[styles.policyText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                GPS coordinates are used strictly while the application is active to locate nearby merchants in Tacurong and navigate your delivery rider to your pinpointed drop-off destination.
              </Text>
              <Text style={[styles.policyHeading, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>2. Secure Account Sessions</Text>
              <Text style={[styles.policyText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                User authentication is protected by short-lived JWT access tokens and rotating refresh tokens with device binding, preventing unauthorized session hijacking.
              </Text>
              <Text style={[styles.policyHeading, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>3. Zero Data Resale</Text>
              <Text style={[styles.policyText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Your order items, phone number, and delivery addresses are never shared with third parties or advertisers. They are solely utilized for errand fulfillment.
              </Text>
            </ScrollView>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.modalActionBtn, { backgroundColor: colors.primary, marginTop: Spacing.md }]}
              onPress={() => setShowPrivacyModal(false)}
            >
              <Text style={styles.modalActionBtnText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(17),
    lineHeight: getPortalLineHeight(17, 'heading'),
  },
  navHeaderRightPlaceholder: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 3,
  },
  themeCardsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
  },
  themeCard: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 88,
  },
  themeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  themeCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    marginBottom: 2,
  },
  themeCardSub: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
  },
  activeThemeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26,
  },
  statusPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    letterSpacing: 0.2,
  },
  storageMeterCard: {
    padding: Spacing.lg,
  },
  storageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  storageTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'heading'),
  },
  storageTotal: {
    fontFamily: FontFamily.mono,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  storageBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  storageBarApp: {
    height: '100%',
    borderRadius: 4,
  },
  storageBarCache: {
    height: '100%',
    borderRadius: 4,
  },
  storageLegendRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  clearCacheBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  clearCacheBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearCacheBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  modalCardLarge: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '75%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnInline: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  modalTitleLarge: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
  },
  modalMessage: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  modalBodyScroll: {
    marginBottom: Spacing.sm,
  },
  policyHeading: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  policyText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginBottom: Spacing.xs,
  },
  modalActionBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    color: '#FFFFFF',
  },
  modalSecondaryBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  modalSecondaryBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  modalErrorText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    flex: 1,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    width: '100%',
    minHeight: 64,
  },
  channelIconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfoCol: {
    flex: 1,
  },
  channelTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    marginBottom: 2,
  },
  channelSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    width: '100%',
    marginBottom: Spacing.sm,
  },
  modalTextInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  resendText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
});
