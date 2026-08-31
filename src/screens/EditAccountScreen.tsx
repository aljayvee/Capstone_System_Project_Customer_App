import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Edit3,
  Camera,
  Image as ImageIcon,
  Trash2,
  X,
  Check,
} from 'lucide-react-native';
import { safePickImage } from '../utils/safeImagePicker';
import { RootStackScreenProps } from '../navigation/types';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows } from '../config/theme';
import CalendarPickerModal from '../components/CalendarPickerModal';
import ConfirmModal from '../components/ConfirmModal';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export default function EditAccountScreen({ route, navigation }: RootStackScreenProps<'EditAccount'>) {
  const { user } = route.params;
  const { updateUser } = useAuth();
  const { colors, isDark } = useThemeColor();

  // Initial values
  const initialFirstName = user.firstName || '';
  const initialMiddleName = user.middleName || '';
  const initialLastName = user.lastName || '';
  const initialBirthdate = user.birthdate ? String(user.birthdate).split('T')[0] : '';
  const initialEmail = user.email || '';
  const initialPhone = user.phone || '';
  const initialAvatar = user.avatar || null;

  // Form State
  const [firstName, setFirstName] = useState(initialFirstName);
  const [middleName, setMiddleName] = useState(initialMiddleName);
  const [lastName, setLastName] = useState(initialLastName);
  const [birthdate, setBirthdate] = useState(initialBirthdate);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);

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
    if (phone.trim() !== initialPhone.trim()) count++;
    return count;
  }, [firstName, middleName, lastName, birthdate, email, phone]);

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
  const isEmailValid = email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !errors.email;
  const isPhoneValid = phone.trim().length >= 10;

  // Handle Photo Picker (Camera or Gallery) with strict MIME & 5MB validation
  const handleSelectImage = async (mode: 'camera' | 'gallery') => {
    setShowPhotoModal(false);
    try {
      const asset = await safePickImage({
        mode,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!asset) {
        return;
      }

      // 1. Validate File Extension / MIME Type (Strictly .jpeg/.jpg/.png only)
      const fileName = asset.fileName || asset.uri.split('/').pop() || 'profile.jpg';
      const fileExt = fileName.split('.').pop()?.toLowerCase();
      let mimeType = asset.mimeType || (fileExt === 'png' ? 'image/png' : 'image/jpeg');

      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      const isValidMime = ALLOWED_MIME_TYPES.includes(mimeType) || ['jpg', 'jpeg', 'png'].includes(fileExt || '');
      if (!isValidMime) {
        Alert.alert(
          'Invalid Format',
          'Only .jpeg, .jpg, and .png image files are allowed. Please select a valid photo.'
        );
        return;
      }

      // 2. Validate File Size (Strictly 5MB limit)
      const fileSize = asset.fileSize || (asset.base64 ? Math.round((asset.base64.length * 3) / 4) : 0);
      if (fileSize > MAX_IMAGE_SIZE_BYTES) {
        Alert.alert(
          'Photo Too Large',
          `The selected photo is ${(fileSize / (1024 * 1024)).toFixed(1)}MB. Maximum allowed photo size is 5MB.`
        );
        return;
      }

      if (!asset.base64) {
        Alert.alert('Upload Error', 'Could not read photo data. Please try again.');
        return;
      }

      const photoData = `data:${mimeType};base64,${asset.base64}`;

      // 3. Upload immediately to API
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
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to upload profile photo.';
      Alert.alert('Upload Failed', msg);
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
      Alert.alert('Success', 'Profile photo removed.');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to remove profile photo.';
      Alert.alert('Error', msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle Direct Secure Save with JWT & Device Telemetry
  const handleSave = async () => {
    if (saving) return;

    const newErrors: Record<string, string | null> = {};
    let hasError = false;

    if (!firstName.trim()) {
      newErrors.firstName = 'First name required!';
      hasError = true;
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name required!';
      hasError = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      newErrors.email = 'Enter a valid email address!';
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
      const response = await apiClient.put(`/customers/${user.id}`, {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        birthdate: birthdate.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      });

      const updatedUser = response.data?.user || {
        ...user,
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        birthdate: birthdate.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        avatar,
      };

      await updateUser(updatedUser);

      setSuccessBanner(true);
      setTimeout(() => {
        navigation.navigate('Account', {
          user: updatedUser,
        });
      }, 900);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to update account information.';
      setGlobalError(msg);
      triggerShake();
    } finally {
      setSaving(false);
    }
  };

  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim() || user.username || 'Customer';
  const userInitials = `${(firstName[0] || user.username?.[0] || 'C').toUpperCase()}${(lastName[0] || '').toUpperCase()}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* iOS-STYLE TOP NAV HEADER */}
        <View style={[styles.navHeaderRow, { borderBottomColor: colors.border, backgroundColor: colors.bgApp }]}>
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
            testID="back-button"
          >
            <ChevronLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.textDark }]}>Edit Account Information</Text>
          <View style={styles.navHeaderRightPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            {/* SUCCESS BANNER */}
            {successBanner ? (
              <View style={[styles.successBanner, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5', borderColor: '#10B981' }]}>
                <CheckCircle2 size={18} color="#10B981" />
                <Text style={styles.successBannerText}>Profile updated successfully!</Text>
              </View>
            ) : null}

            {/* GLOBAL ERROR BANNER */}
            {globalError ? (
              <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: colors.danger }]}>
                <AlertCircle size={16} color={colors.danger} />
                <Text style={[styles.errorBannerText, { color: colors.danger }]}>{globalError}</Text>
              </View>
            ) : null}

            {/* HERO PROFILE AVATAR CARD WITH INTERACTIVE PHOTO PICKER */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.avatarPickerWrapper}
                onPress={() => setShowPhotoModal(true)}
                disabled={uploadingPhoto}
                testID="edit-avatar-picker-btn"
              >
                <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
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
                <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                  <Camera size={13} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>

              <View style={styles.heroInfoCol}>
                <View style={styles.nameRow}>
                  <Text style={[styles.heroDisplayName, { color: colors.textDark }]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <View style={[styles.verifiedBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                    <ShieldCheck size={12} color="#10B981" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>

                <Text style={[styles.heroHandle, { color: colors.textGray }]}>
                  @{user.username || 'customer'}
                </Text>

                <TouchableOpacity
                  onPress={() => setShowPhotoModal(true)}
                  style={styles.changePhotoLink}
                  disabled={uploadingPhoto}
                >
                  <Text style={[styles.changePhotoText, { color: colors.primary }]}>
                    {avatar ? 'Change Profile Photo' : 'Upload Profile Photo (.jpg, .png)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ========================================================================= */}
            {/* SECTION 1: PERSONAL IDENTITY */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
              <View style={styles.sectionHeaderRow}>
                <User size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Personal Identity</Text>
              </View>

              {/* FIRST NAME */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]}>FIRST NAME *</Text>
                {errors.firstName ? (
                  <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                    <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                    <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.firstName}</Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray,
                    borderColor: errors.firstName ? colors.danger : colors.border,
                    borderWidth: errors.firstName ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter first name"
                  placeholderTextColor={colors.textLight}
                  value={firstName}
                  onChangeText={(t) => {
                    setFirstName(t);
                    clearError('firstName');
                  }}
                  autoCapitalize="words"
                />
                {isFirstNameValid && (
                  <View style={styles.inputCheckIcon}>
                    <Check size={14} color="#10B981" strokeWidth={2.6} />
                  </View>
                )}
              </View>

              {/* MIDDLE NAME */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]}>MIDDLE NAME (OPTIONAL)</Text>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter middle name"
                  placeholderTextColor={colors.textLight}
                  value={middleName}
                  onChangeText={setMiddleName}
                  autoCapitalize="words"
                />
              </View>

              {/* LAST NAME */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]}>LAST NAME *</Text>
                {errors.lastName ? (
                  <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                    <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                    <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.lastName}</Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray,
                    borderColor: errors.lastName ? colors.danger : colors.border,
                    borderWidth: errors.lastName ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="Enter last name"
                  placeholderTextColor={colors.textLight}
                  value={lastName}
                  onChangeText={(t) => {
                    setLastName(t);
                    clearError('lastName');
                  }}
                  autoCapitalize="words"
                />
                {isLastNameValid && (
                  <View style={styles.inputCheckIcon}>
                    <Check size={14} color="#10B981" strokeWidth={2.6} />
                  </View>
                )}
              </View>

              {/* BIRTHDATE */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]}>BIRTHDATE</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.inputWrapper,
                  styles.calendarInputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowCalendarModal(true)}
              >
                <Text style={[styles.calendarText, { color: birthdate ? colors.textDark : colors.textLight }]}>
                  {birthdate || 'Select your date of birth'}
                </Text>
                <CalendarIcon size={18} color={colors.textGray} />
              </TouchableOpacity>
            </View>

            {/* ========================================================================= */}
            {/* SECTION 2: CONTACT INFORMATION */}
            {/* ========================================================================= */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]}>
              <View style={styles.sectionHeaderRow}>
                <Mail size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Contact Details</Text>
              </View>

              {/* EMAIL */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]}>EMAIL ADDRESS</Text>
                {errors.email ? (
                  <View style={[styles.shoutBadgeTop, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                    <AlertCircle size={12} color={colors.danger} strokeWidth={2.2} />
                    <Text style={[styles.shoutText, { color: colors.danger }]}>{errors.email}</Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray,
                    borderColor: errors.email ? colors.danger : colors.border,
                    borderWidth: errors.email ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.textLight}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    clearError('email');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {isEmailValid && (
                  <View style={styles.inputCheckIcon}>
                    <Check size={14} color="#10B981" strokeWidth={2.6} />
                  </View>
                )}
              </View>

              {/* PHONE */}
              <View style={styles.labelHeaderRow}>
                <Text style={[styles.inputLabel, { color: colors.textMedium }]}>MOBILE PHONE</Text>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.bgGray,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textDark }]}
                  placeholder="09123456789"
                  placeholderTextColor={colors.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                {isPhoneValid && (
                  <View style={styles.inputCheckIcon}>
                    <Check size={14} color="#10B981" strokeWidth={2.6} />
                  </View>
                )}
              </View>
              <Text style={[styles.fieldHelperText, { color: colors.textLight }]}>
                Used strictly by riders for live arrival calls and delivery coordination in Tacurong.
              </Text>
            </View>

            {/* SAVE BUTTON (SMART DIRTY-STATE CTA) */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                saving && { opacity: 0.7 },
                Shadows.liftedUp,
              ]}
              onPress={handleSave}
              disabled={saving}
              testID="save-profile-button"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Save size={18} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.saveButtonText}>
                    {modifiedCount > 0
                      ? `Save ${modifiedCount} ${modifiedCount === 1 ? 'Change' : 'Changes'}`
                      : 'Save Profile Changes'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PHOTO SELECTION MODAL */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.photoActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.photoModalHeader}>
              <Text style={[styles.photoModalTitle, { color: colors.textDark }]}>Customer Profile Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)} style={styles.closeModalBtn}>
                <X size={18} color={colors.textDark} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.photoModalSubtitle, { color: colors.textGray }]}>
              Accepts .jpeg, .jpg, and .png images up to 5MB.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.photoOptionRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
              onPress={() => handleSelectImage('camera')}
              testID="take-photo-option"
            >
              <Camera size={20} color={colors.primary} />
              <View style={styles.photoOptionTextCol}>
                <Text style={[styles.photoOptionLabel, { color: colors.textDark }]}>Take Photo with Camera</Text>
                <Text style={[styles.photoOptionSub, { color: colors.textGray }]}>Capture a new profile photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.photoOptionRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
              onPress={() => handleSelectImage('gallery')}
              testID="choose-gallery-option"
            >
              <ImageIcon size={20} color={colors.primary} />
              <View style={styles.photoOptionTextCol}>
                <Text style={[styles.photoOptionLabel, { color: colors.textDark }]}>Choose from Gallery</Text>
                <Text style={[styles.photoOptionSub, { color: colors.textGray }]}>Select image from device storage</Text>
              </View>
            </TouchableOpacity>

            {avatar && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.photoOptionRow, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEE2E2' }]}
                onPress={handleRemovePhoto}
                testID="remove-photo-option"
              >
                <Trash2 size={20} color={colors.danger} />
                <View style={styles.photoOptionTextCol}>
                  <Text style={[styles.photoOptionLabel, { color: colors.danger }]}>Remove Current Photo</Text>
                  <Text style={[styles.photoOptionSub, { color: colors.danger }]}>Revert to default initials avatar</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  navHeaderRightPlaceholder: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
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
    fontSize: FontSizes.xs + 1,
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
    fontSize: FontSizes.xs + 1,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  avatarPickerWrapper: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  avatarBadge: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
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
    fontSize: FontSizes.md,
  },
  verifiedBadge: {
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
  heroHandle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    marginBottom: 4,
  },
  changePhotoLink: {
    paddingVertical: 2,
  },
  changePhotoText: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
  },
  dirtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  dirtyBadgeText: {
    fontFamily: FontFamily.semibold,
    fontSize: 10,
  },
  cleanText: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
  },
  sectionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm + 1,
  },
  labelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
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
    fontSize: 10,
  },
  inputWrapper: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 2,
    padding: 0,
  },
  inputCheckIcon: {
    marginLeft: 6,
  },
  fieldHelperText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
    lineHeight: 15,
  },
  calendarInputWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  saveButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  photoActionCard: {
    width: '100%',
    borderRadius: BorderRadius.xl,
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
    fontSize: FontSizes.md,
  },
  closeModalBtn: {
    padding: 4,
  },
  photoModalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    marginBottom: Spacing.md,
  },
  photoOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  photoOptionTextCol: {
    flex: 1,
  },
  photoOptionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
    marginBottom: 2,
  },
  photoOptionSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },
});
