import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  Image,
  Modal,
  BackHandler,
  Pressable,
} from 'react-native';
import { showAppAlert } from '../services/alertModal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Not React Native's: under Expo's edge-to-edge Android build the window never
// resizes for the keyboard, so RN's version has nothing to react to. This one
// reads the IME frame from KeyboardProvider (mounted in AppNavigator).
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import {
  ChevronLeft,
  User,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Camera,
  Image as ImageIcon,
  Trash2,
  X,
  Check,
} from 'lucide-react-native';
import { safePickImage } from '../utils/safeImagePicker';
import { RootStackScreenProps } from '../navigation/types';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import { verifyPhoneBySms } from '../services/phoneVerification';
import { useAuth } from '../context/AuthContext';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  FontFamily,
  FontSizes,
  Spacing,
  BorderRadius,
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
import CalendarPickerModal from '../components/CalendarPickerModal';
import ConfirmModal from '../components/ConfirmModal';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export default function EditAccountScreen({ route, navigation }: RootStackScreenProps<'EditAccount'>) {
  const { user, focusField } = route.params;
  const { updateUser } = useAuth();
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useResponsive();

  // Initial values
  const initialFirstName = user.firstName || '';
  const initialMiddleName = user.middleName || '';
  const initialLastName = user.lastName || '';
  const initialBirthdate = user.birthdate ? String(user.birthdate).split('T')[0] : '';
  const initialEmail = user.email || '';
  const initialPhone = user.phone || '';
  const initialAvatar = user.avatar || null;

  // Phone normalization: extract strictly 10 digits (9XXXXXXXXX)
  const normalizeTo10Digits = (val: string) => {
    const digits = (val || '').replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length >= 12) return digits.slice(2, 12);
    if (digits.startsWith('0') && digits.length >= 11) return digits.slice(1, 11);
    return digits.slice(0, 10);
  };
  const initialPhone10 = useMemo(() => normalizeTo10Digits(initialPhone), [initialPhone]);

  // Form State
  const [firstName, setFirstName] = useState(initialFirstName);
  const [middleName, setMiddleName] = useState(initialMiddleName);
  const [lastName, setLastName] = useState(initialLastName);
  const [birthdate, setBirthdate] = useState(initialBirthdate);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone10);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);

  // Phone Verification State
  const initialPhoneVerified = Boolean((user as any).phoneVerified);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  const isPhoneChanged = useMemo(() => {
    const cleanCurrent = phone.trim().replace(/\D/g, '');
    return cleanCurrent !== initialPhone10;
  }, [phone, initialPhone10]);

  const isPhoneVerifiedCurrent = useMemo(() => {
    if (firebaseIdToken) return true;
    if (!isPhoneChanged) return initialPhoneVerified;
    return false;
  }, [firebaseIdToken, isPhoneChanged, initialPhoneVerified]);

  // UI / Async State
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);

  // Errors & Shake Animation
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  // Home's reminders open this screen pointed at one field (2026-10-09):
  // "Provide your mobile number" focuses the number, so the keyboard opens and
  // the scroll view brings it into view; "provide your birthdate" opens the
  // date picker and marks the field until a date is chosen.
  const phoneInputRef = useRef<TextInput>(null);
  const pointBirthdate = focusField === 'birthdate';
  // The Save dock's height, so a focused field is kept clear of it as well as
  // of the keyboard.
  const [dockHeight, setDockHeight] = useState(88);
  useEffect(() => {
    if (!focusField) return undefined;
    // After the push animation, so focus lands on a laid-out screen.
    const timer = setTimeout(() => {
      if (focusField === 'phone') phoneInputRef.current?.focus();
      if (focusField === 'birthdate') setShowCalendarModal(true);
    }, 450);
    return () => clearTimeout(timer);
  }, [focusField]);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (globalError) setGlobalError(null);
  };

  // Compute number of modified fields for UX dirty-state
  const modifiedCount = useMemo(() => {
    let count = 0;
    if (firstName.trim() !== initialFirstName.trim()) count++;
    if (middleName.trim() !== initialMiddleName.trim()) count++;
    if (lastName.trim() !== initialLastName.trim()) count++;
    if (birthdate.trim() !== initialBirthdate.trim()) count++;
    if (email.trim() !== initialEmail.trim()) count++;
    if (phone.trim() !== initialPhone10.trim()) count++;
    return count;
  }, [firstName, middleName, lastName, birthdate, email, phone, initialPhone10]);

  // Clamped phone input handler: enforces 10 digits starting with 9
  const handlePhoneChange = (t: string) => {
    let digits = t.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length > 10) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length > 10) {
      digits = digits.slice(1);
    }
    if (digits.length > 10) {
      digits = digits.slice(0, 10);
    }
    setPhone(digits);
    clearError('phone');
  };

  // Loss Aversion Guard: Intercept back button when unsaved changes exist
  const handleBack = () => {
    if (modifiedCount > 0) {
      setShowUnsavedModal(true);
    } else {
      navigation.goBack();
    }
  };

  // Hardware Android back button listener
  useEffect(() => {
    const onBackPress = () => {
      if (modifiedCount > 0) {
        setShowUnsavedModal(true);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [modifiedCount]);

  // Real-time inline field validation indicators
  const isFirstNameValid = firstName.trim().length > 0 && !errors.firstName;
  const isLastNameValid = lastName.trim().length > 0 && !errors.lastName;
  const isEmailValid =
    email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !errors.email;
  const isPhoneValid = phone.trim().length === 10 && phone.trim().startsWith('9');

  // Handle Photo Picker (Camera or Gallery) with strict MIME & 5MB validation
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
          message: 'Only .jpeg, .jpg, and .png image files are allowed. Please select a valid photo.',
          variant: 'error',
        });
        return;
      }

      const fileSize = asset.fileSize || (asset.base64 ? Math.round((asset.base64.length * 3) / 4) : 0);
      if (fileSize > MAX_IMAGE_SIZE_BYTES) {
        showAppAlert({
          title: 'Photo Too Large',
          message: `The selected photo is ${(fileSize / (1024 * 1024)).toFixed(1)}MB. Maximum allowed photo size is 5MB.`,
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
      const uploadRes = await apiClient.put(`/customers/${user.id}/photo`, {
        photoData,
        mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
        fileSize,
        fileName,
      });

      const updatedAvatar = uploadRes.data?.user?.avatar || photoData;
      setAvatar(updatedAvatar);
      await updateUser({ avatar: updatedAvatar });
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
      await apiClient.delete(`/customers/${user.id}/photo`);
      setAvatar(null);
      await updateUser({ avatar: null });
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

  const handleVerifyPhone = async () => {
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith('9')) {
      setErrors((prev) => ({ ...prev, phone: 'Enter 10-digit number starting with 9' }));
      triggerShake();
      return;
    }
    setVerifyingPhone(true);
    setGlobalError(null);
    // The same SMS flow as the Home tab's reminder (services/phoneVerification.ts).
    const result = await verifyPhoneBySms(cleanPhone);
    if (result.status === 'verified') {
      // Kept even when the server's confirmation failed: the save sends it again.
      setFirebaseIdToken(result.idToken);
      setErrors((prev) => ({ ...prev, phone: null }));
      setGlobalError(null);
    } else if (result.status === 'cancelled') {
      setGlobalError('Phone verification was cancelled.');
    } else {
      setGlobalError(toUserMessage(result.error, 'profile'));
      triggerShake();
    }
    setVerifyingPhone(false);
  };

  // Handle Direct Secure Save
  const handleSave = async () => {
    if (saving) return;

    const newErrors: Record<string, string | null> = {};
    let hasError = false;

    if (!firstName.trim()) {
      newErrors.firstName = 'Required';
      hasError = true;
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Required';
      hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      newErrors.email = 'Check this address';
      hasError = true;
    }

    if (!isPhoneVerifiedCurrent) {
      newErrors.phone = 'Verification required';
      setGlobalError('Please verify your mobile number via SMS before saving.');
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      triggerShake();
      return;
    }

    setErrors({});
    setGlobalError(null);
    setSaving(true);

    try {
      const fullPhone = `+63${phone.trim()}`;
      const response = await apiClient.put(`/customers/${user.id}`, {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        birthdate: birthdate.trim() || null,
        email: email.trim().toLowerCase(),
        phone: fullPhone,
        firebaseIdToken: firebaseIdToken || undefined,
      });

      const updatedUser = response.data?.user || {
        ...user,
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        birthdate: birthdate.trim() || null,
        email: email.trim().toLowerCase(),
        phone: fullPhone,
        phoneVerified: true,
        avatar,
      };

      await updateUser(updatedUser);

      setSuccessBanner(true);
      setTimeout(() => {
        navigation.navigate('Account', {
          user: updatedUser,
        });
      }, 700);
    } catch (err: any) {
      setGlobalError(toUserMessage(err, 'profile'));
      triggerShake();
    } finally {
      setSaving(false);
    }
  };

  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim() || user.username || 'Customer';
  const userInitials = `${(firstName[0] || user.username?.[0] || 'C').toUpperCase()}${(
    lastName[0] || ''
  ).toUpperCase()}`;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bgApp }]}
      edges={['top', 'left', 'right']}
    >
      {/* Keyboard-safe (2026-10-09). The padding KeyboardAvoidingView here
          shrank the screen but never scrolled, so a field low on the form (the
          mobile number) stayed hidden under the keyboard and the Save dock.
          KeyboardAwareScrollView scrolls the focused field into view, kept
          clear of the dock by bottomOffset; KeyboardStickyView lifts the dock
          onto the keyboard. Both read the IME frame from KeyboardProvider. */}
      <View style={{ flex: 1 }}>
        {/* 1. TOP NAV HEADER */}
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
            onPress={handleBack}
            hitSlop={PortalTouchTargets.compactHitSlop}
            style={styles.backBtn}
            testID="back-button"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
            Edit Account Information
          </Text>
          <View style={styles.navHeaderRightPlaceholder} />
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // The dock rides on the keyboard with its own bottom inset hidden
          // behind it, so only the rest of it covers the form.
          bottomOffset={Math.max(0, dockHeight - insets.bottom) + Spacing.md}
          testID="edit-account-scroll"
        >
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            {/* SUCCESS BANNER */}
            {successBanner ? (
              <View
                style={[
                  styles.successBanner,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5',
                    borderColor: '#10B981',
                  },
                ]}
              >
                <CheckCircle2 size={18} color="#10B981" />
                <Text style={styles.successBannerText} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>Profile updated successfully!</Text>
              </View>
            ) : null}

            {/* GLOBAL ERROR BANNER */}
            {globalError ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                    borderColor: colors.danger,
                  },
                ]}
              >
                <AlertCircle size={16} color={colors.danger} />
                <Text style={[styles.errorBannerText, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                  {globalError}
                </Text>
              </View>
            ) : null}

            {/* 2. AVATAR HERO CARD WITH SMART PHOTO PICKER */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: isDark ? colors.card : '#FFFFFF',
                  borderColor: colors.border,
                },
                Shadows.soft,
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.avatarPickerWrapper}
                onPress={() => setShowPhotoModal(true)}
                disabled={uploadingPhoto}
                testID="edit-avatar-picker-btn"
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <View
                  style={[
                    styles.avatarRing,
                    { borderColor: isDark ? 'rgba(246, 36, 89, 0.35)' : colors.primary },
                  ]}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarText}>{userInitials}</Text>
                    </View>
                  )}
                  {uploadingPhoto && (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View
                  style={[
                    styles.cameraBadge,
                    {
                      backgroundColor: colors.primary,
                      borderColor: isDark ? colors.card : '#FFFFFF',
                    },
                  ]}
                >
                  <Camera size={12} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              </TouchableOpacity>

              <View style={styles.heroInfoCol}>
                <View style={styles.nameRow}>
                  <Text style={[styles.heroDisplayName, { color: colors.textDark }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                    {displayName}
                  </Text>
                  <View
                    style={[
                      styles.verifiedBadge,
                      {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                        borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
                      },
                    ]}
                  >
                    <ShieldCheck size={11} color="#10B981" />
                    <Text style={styles.verifiedText} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Verified</Text>
                  </View>
                </View>

                <Text style={[styles.heroHandle, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                  @{user.username || 'customer'}
                </Text>

                <TouchableOpacity
                  onPress={() => setShowPhotoModal(true)}
                  style={styles.changePhotoLink}
                  disabled={uploadingPhoto}
                >
                  <Text style={[styles.changePhotoText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                    {avatar ? 'Change Profile Photo' : 'Upload Profile Photo (.jpg, .png)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. BENTO CARD 1: PERSONAL IDENTITY */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: isDark ? colors.card : '#FFFFFF',
                  borderColor: colors.border,
                },
                Shadows.soft,
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionIconPill,
                    { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3' },
                  ]}
                >
                  <User size={15} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                  Personal Identity
                </Text>
              </View>

              {/* FIRST NAME */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>FIRST NAME *</Text>
                {errors.firstName ? (
                  <View
                    style={[
                      styles.shoutBadgeTop,
                      { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' },
                    ]}
                  >
                    <AlertCircle size={11} color={colors.danger} strokeWidth={2.2} />
                    <Text style={[styles.shoutText, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                      {errors.firstName}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    borderTopColor: errors.firstName
                      ? colors.danger
                      : focusedField === 'firstName'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.28)'
                      : '#FFFFFF',
                    borderColor: errors.firstName
                      ? colors.danger
                      : focusedField === 'firstName'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : '#E2E8F0',
                    borderWidth: errors.firstName || focusedField === 'firstName' ? 1.5 : 1.2,
                    shadowOpacity: isDark ? 0.22 : 0.06,
                  },
                ]}
                testID="edit-first-name-wrapper"
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter first name"
                  placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                  value={firstName}
                  onFocus={() => setFocusedField('firstName')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(t) => {
                    setFirstName(t);
                    clearError('firstName');
                  }}
                  autoCapitalize="words"
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
                />
                {isFirstNameValid && (
                  <View style={styles.inputCheckIcon}>
                    <Check size={14} color="#10B981" strokeWidth={2.6} />
                  </View>
                )}
              </View>

              {/* MIDDLE NAME */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                  MIDDLE NAME (OPTIONAL)
                </Text>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    borderTopColor: focusedField === 'middleName'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.28)'
                      : '#FFFFFF',
                    borderColor: focusedField === 'middleName'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : '#E2E8F0',
                    borderWidth: focusedField === 'middleName' ? 1.5 : 1.2,
                    shadowOpacity: isDark ? 0.22 : 0.06,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter middle name"
                  placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                  value={middleName}
                  onFocus={() => setFocusedField('middleName')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={setMiddleName}
                  autoCapitalize="words"
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
                />
              </View>

              {/* LAST NAME */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>LAST NAME *</Text>
                {errors.lastName ? (
                  <View
                    style={[
                      styles.shoutBadgeTop,
                      { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' },
                    ]}
                  >
                    <AlertCircle size={11} color={colors.danger} strokeWidth={2.2} />
                    <Text style={[styles.shoutText, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                      {errors.lastName}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    borderTopColor: errors.lastName
                      ? colors.danger
                      : focusedField === 'lastName'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.28)'
                      : '#FFFFFF',
                    borderColor: errors.lastName
                      ? colors.danger
                      : focusedField === 'lastName'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : '#E2E8F0',
                    borderWidth: errors.lastName || focusedField === 'lastName' ? 1.5 : 1.2,
                    shadowOpacity: isDark ? 0.22 : 0.06,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter last name"
                  placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                  value={lastName}
                  onFocus={() => setFocusedField('lastName')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(t) => {
                    setLastName(t);
                    clearError('lastName');
                  }}
                  autoCapitalize="words"
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
                />
                {isLastNameValid && (
                  <View style={styles.inputCheckIcon}>
                    <Check size={14} color="#10B981" strokeWidth={2.6} />
                  </View>
                )}
              </View>

              {/* BIRTHDATE */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>BIRTHDATE</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.inputWrapper,
                  styles.calendarInputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    borderTopColor: pointBirthdate && !birthdate
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.28)'
                      : '#FFFFFF',
                    borderColor: pointBirthdate && !birthdate
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : '#E2E8F0',
                    borderWidth: pointBirthdate && !birthdate ? 1.5 : 1.2,
                    shadowOpacity: isDark ? 0.22 : 0.06,
                  },
                ]}
                onPress={() => setShowCalendarModal(true)}
                testID="edit-birthdate-field"
                accessibilityRole="button"
                accessibilityLabel="Select birthdate"
              >
                <Text
                  style={[
                    styles.calendarText,
                    { color: birthdate ? colors.textDark : colors.textLight },
                  ]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                >
                  {birthdate || 'Select your date of birth'}
                </Text>
                <CalendarIcon size={17} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            {/* 4. BENTO CARD 2: CONTACT DETAILS */}
            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: isDark ? colors.card : '#FFFFFF',
                  borderColor: colors.border,
                },
                Shadows.soft,
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.sectionIconPill,
                    { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3' },
                  ]}
                >
                  <Mail size={15} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                  Contact Details
                </Text>
              </View>

              {/* EMAIL */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>EMAIL ADDRESS</Text>
                {errors.email ? (
                  <View
                    style={[
                      styles.shoutBadgeTop,
                      { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' },
                    ]}
                  >
                    <AlertCircle size={11} color={colors.danger} strokeWidth={2.2} />
                    <Text style={[styles.shoutText, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>{errors.email}</Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                    borderTopColor: errors.email
                      ? colors.danger
                      : focusedField === 'email'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.28)'
                      : '#FFFFFF',
                    borderColor: errors.email
                      ? colors.danger
                      : focusedField === 'email'
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : '#E2E8F0',
                    borderWidth: errors.email || focusedField === 'email' ? 1.5 : 1.2,
                    shadowOpacity: isDark ? 0.22 : 0.06,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="name@example.com"
                  placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                  value={email}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(t) => {
                    setEmail(t);
                    clearError('email');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
                />
                {isEmailValid && (
                  <View style={styles.inputCheckIcon}>
                    <Check size={14} color="#10B981" strokeWidth={2.6} />
                  </View>
                )}
              </View>

              {/* PHONE */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>MOBILE PHONE</Text>
                {isPhoneVerifiedCurrent ? (
                  <View style={[styles.phoneBadge, styles.phoneBadgeVerified]}>
                    <ShieldCheck size={11} color="#10B981" />
                    <Text style={styles.phoneBadgeVerifiedText} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>VERIFIED</Text>
                  </View>
                ) : (
                  <View style={[styles.phoneBadge, styles.phoneBadgeUnverified]}>
                    <Text style={styles.phoneBadgeUnverifiedText} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>UNVERIFIED</Text>
                  </View>
                )}
              </View>
              <View style={styles.phoneInputRow}>
                {/* FIXED +63 PREFIX CONTAINER */}
                <View
                  style={[
                    styles.phonePrefixBox,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                      shadowOpacity: isDark ? 0.22 : 0.06,
                    },
                  ]}
                  testID="phone-prefix-box"
                >
                  <Text style={[styles.phonePrefixText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                    +63
                  </Text>
                </View>

                {/* 10-DIGIT NUMBER INPUT */}
                <View
                  style={[
                    styles.phoneFieldWrapper,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                      borderTopColor: errors.phone
                        ? colors.danger
                        : focusedField === 'phone'
                        ? colors.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.28)'
                        : '#FFFFFF',
                      borderColor: errors.phone
                        ? colors.danger
                        : focusedField === 'phone'
                        ? colors.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : '#E2E8F0',
                      borderWidth: errors.phone || focusedField === 'phone' ? 1.5 : 1.2,
                      shadowOpacity: isDark ? 0.22 : 0.06,
                    },
                  ]}
                  testID="phone-field-wrapper"
                >
                  <TextInput
                    ref={phoneInputRef}
                    testID="edit-phone-input"
                    style={[styles.input, { color: colors.textDark }]}
                    placeholder="9123456789"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    value={phone}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    maxLength={10}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
                  />
                  {isPhoneValid && isPhoneVerifiedCurrent && (
                    <View style={styles.inputCheckIcon}>
                      <Check size={14} color="#10B981" strokeWidth={2.6} />
                    </View>
                  )}
                </View>
              </View>

              {errors.phone ? (
                <Text style={styles.inlineFieldError} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                  {errors.phone}
                </Text>
              ) : null}

              {!isPhoneVerifiedCurrent ? (
                <TouchableOpacity
                  style={[
                    styles.verifyPhoneBtn,
                    { backgroundColor: isPhoneValid ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0') },
                  ]}
                  onPress={handleVerifyPhone}
                  disabled={verifyingPhone || !isPhoneValid}
                  activeOpacity={0.8}
                >
                  {verifyingPhone ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <ShieldCheck size={14} color={isPhoneValid ? '#FFFFFF' : colors.textLight} />
                      <Text
                        style={[
                          styles.verifyPhoneBtnText,
                          { color: isPhoneValid ? '#FFFFFF' : colors.textLight },
                        ]}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                      >
                        {isPhoneChanged ? 'Verify New Mobile Number' : 'Verify Mobile Number'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              <Text style={[styles.fieldHelperText, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                Used strictly by riders for live arrival coordination and dispatch in Tacurong.
              </Text>
            </View>
          </Animated.View>
        </KeyboardAwareScrollView>

        {/* 5. STICKY BOTTOM THUMB-ZONE ACTION DOCK. The keyboard's height already
            includes the navigation bar the dock pads for, so it rides up by
            that much less (the opened offset). */}
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
          style={[
            styles.stickyBottomDock,
            {
              backgroundColor: colors.bgAppTranslucent,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.stickySaveButton,
              { backgroundColor: colors.primary },
              saving && { opacity: 0.7 },
              Shadows.liftedUp,
            ]}
            onPress={handleSave}
            disabled={saving}
            testID="save-profile-button"
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Save size={17} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.stickySaveButtonText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                  {modifiedCount > 0
                    ? `Save ${modifiedCount} ${modifiedCount === 1 ? 'Change' : 'Changes'}`
                    : 'Save Profile Changes'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        </KeyboardStickyView>
      </View>

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
              styles.photoActionCard,
              { backgroundColor: isDark ? colors.card : '#FFFFFF', borderColor: colors.border },
              Shadows.liftedUp,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.photoModalHeader}>
              <Text style={[styles.photoModalTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
                Profile Photo
              </Text>
              <TouchableOpacity
                onPress={() => setShowPhotoModal(false)}
                style={styles.closeModalBtn}
                hitSlop={PortalTouchTargets.compactHitSlop}
              >
                <X size={18} color={colors.textDark} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.photoModalSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              {avatar
                ? 'Update or remove your current profile photo.'
                : 'Choose a photo from your gallery or capture a new one.'}
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.photoOptionRow,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleSelectImage('gallery')}
              testID="choose-gallery-option"
              accessibilityRole="button"
              accessibilityLabel="Choose from Gallery"
            >
              <View
                style={[
                  styles.photoOptionIconBadge,
                  { backgroundColor: isDark ? 'rgba(246,36,89,0.15)' : '#FFEEF3' },
                ]}
              >
                <ImageIcon size={18} color={colors.primary} />
              </View>
              <View style={styles.photoOptionTextCol}>
                <Text style={[styles.photoOptionLabel, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                  Choose from Gallery
                </Text>
                <Text style={[styles.photoOptionSub, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                  Select an image from device photos
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.photoOptionRow,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleSelectImage('camera')}
              testID="take-photo-option"
              accessibilityRole="button"
              accessibilityLabel="Take a Photo"
            >
              <View
                style={[
                  styles.photoOptionIconBadge,
                  { backgroundColor: isDark ? 'rgba(246,36,89,0.15)' : '#FFEEF3' },
                ]}
              >
                <Camera size={18} color={colors.primary} />
              </View>
              <View style={styles.photoOptionTextCol}>
                <Text style={[styles.photoOptionLabel, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                  Take Photo with Camera
                </Text>
                <Text style={[styles.photoOptionSub, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                  Capture a new profile photo
                </Text>
              </View>
            </TouchableOpacity>

            {avatar && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.photoOptionRow,
                  {
                    backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2',
                    borderColor: 'rgba(239,68,68,0.2)',
                  },
                ]}
                onPress={handleRemovePhoto}
                testID="remove-photo-option"
                accessibilityRole="button"
                accessibilityLabel="Remove current photo"
              >
                <View style={[styles.photoOptionIconBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Trash2 size={18} color={colors.danger} />
                </View>
                <View style={styles.photoOptionTextCol}>
                  <Text style={[styles.photoOptionLabel, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                    Remove Current Photo
                  </Text>
                  <Text style={[styles.photoOptionSub, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                    Revert to clean initials badge
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* CALENDAR PICKER MODAL */}
      <CalendarPickerModal
        visible={showCalendarModal}
        initialDate={birthdate}
        onSelectDate={(d: string) => {
          setBirthdate(d);
          setShowCalendarModal(false);
        }}
        onClose={() => setShowCalendarModal(false)}
      />

      {/* UNSAVED CHANGES LOSS AVERSION MODAL */}
      <ConfirmModal
        visible={showUnsavedModal}
        title="Discard Unsaved Changes?"
        message="You have modified profile information. Leaving now will discard your unsaved edits."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        destructive
        onConfirm={() => {
          setShowUnsavedModal(false);
          navigation.goBack();
        }}
        onCancel={() => setShowUnsavedModal(false)}
      />
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
    paddingVertical: Spacing.xs,
    borderBottomWidth: 0,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
  navHeaderRightPlaceholder: {
    width: PortalTouchTargets.compact,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 110,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  successBannerText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    color: '#10B981',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
  },

  // Avatar Hero Card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  avatarPickerWrapper: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  avatarBadge: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: PortalFontSizes.title,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoCol: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  heroDisplayName: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  verifiedText: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.micro,
    color: '#10B981',
  },
  heroHandle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    marginBottom: 4,
  },
  changePhotoLink: {
    paddingVertical: 2,
  },
  changePhotoText: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.caption,
  },

  // Bento Section Cards
  sectionCard: {
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionIconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
  labelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    letterSpacing: 0.3,
  },
  shoutBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  shoutText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
  },
  inputWrapper: {
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.body,
    padding: 0,
  },
  inputCheckIcon: {
    marginLeft: 6,
  },
  fieldHelperText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
    lineHeight: 17,
  },
  calendarInputWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.body,
  },

  // Sticky Bottom Action Dock
  stickyBottomDock: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  stickySaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: PortalTouchTargets.buttonHeight,
    paddingVertical: 14,
    borderRadius: 12,
  },
  stickySaveButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
    color: '#FFFFFF',
  },

  // Photo Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  photoActionCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoModalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.title,
  },
  closeModalBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoModalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    marginBottom: Spacing.md,
  },
  photoOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    minHeight: PortalTouchTargets.min,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  photoOptionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptionTextCol: {
    flex: 1,
  },
  photoOptionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.body,
    marginBottom: 2,
  },
  photoOptionSub: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  phoneBadgeVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  phoneBadgeVerifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
    color: '#10B981',
    letterSpacing: 0.4,
  },
  phoneBadgeUnverified: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  phoneBadgeUnverifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
    color: '#F59E0B',
    letterSpacing: 0.4,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  phonePrefixBox: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  phonePrefixText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.body,
    letterSpacing: 0.5,
  },
  phoneFieldWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    paddingHorizontal: Spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  verifyPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    marginTop: -Spacing.xs,
  },
  verifyPhoneBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    color: '#FFFFFF',
  },
  inlineFieldError: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
    color: '#EF4444',
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
});
