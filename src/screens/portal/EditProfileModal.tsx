import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import TrueBottomSheet from '../../components/transitions/TrueBottomSheet';
// Not React Native's: under Expo's edge-to-edge Android build the window never
// resizes for the keyboard, so RN's version has nothing to react to. This one
// reads the IME frame from KeyboardProvider (mounted in AppNavigator) — React
// context reaches Modal children even though the Modal is its own native window.
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontSizes,
  FontWeights,
  Spacing,
  BorderRadius,
  FontFamily,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';

export interface ProfileFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface EditProfileModalProps {
  visible: boolean;
  initialValues: ProfileFields;
  saving: boolean;
  onSave: (fields: ProfileFields) => void;
  onClose: () => void;
}

export default function EditProfileModal({ visible, initialValues, saving, onSave, onClose }: EditProfileModalProps) {
  const [fields, setFields] = useState<ProfileFields>(initialValues);
  const { colors, isDark } = useThemeColor();

  useEffect(() => {
    if (visible) setFields(initialValues);
  }, [visible]);

  return (
    <TrueBottomSheet
      visible={visible}
      onClose={onClose}
      showDragHandle={true}
      contentStyle={[styles.sheet, { backgroundColor: colors.card }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <Text
          style={[styles.title, { color: colors.textDark }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
        >
          Edit Profile
        </Text>

        <Text
          style={[styles.label, { color: colors.textMedium }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
        >
          First Name
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
              borderColor: colors.border,
              color: colors.textDark,
            },
          ]}
          value={fields.firstName}
          onChangeText={(v) => setFields((f) => ({ ...f, firstName: v }))}
          placeholder="Enter First Name"
          placeholderTextColor={colors.textLight}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
        />

        <Text
          style={[styles.label, { color: colors.textMedium }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
        >
          Last Name
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
              borderColor: colors.border,
              color: colors.textDark,
            },
          ]}
          value={fields.lastName}
          onChangeText={(v) => setFields((f) => ({ ...f, lastName: v }))}
          placeholder="Enter Last Name"
          placeholderTextColor={colors.textLight}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
        />

        <Text
          style={[styles.label, { color: colors.textMedium }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
        >
          Email Address
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
              borderColor: colors.border,
              color: colors.textDark,
            },
          ]}
          value={fields.email}
          onChangeText={(v) => setFields((f) => ({ ...f, email: v }))}
          placeholder="Enter Email Address"
          placeholderTextColor={colors.textLight}
          keyboardType="email-address"
          autoCapitalize="none"
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
        />

        <Text
          style={[styles.label, { color: colors.textMedium }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
        >
          Mobile Phone Number
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
              borderColor: colors.border,
              color: colors.textDark,
            },
          ]}
          value={fields.phone}
          onChangeText={(v) => setFields((f) => ({ ...f, phone: v }))}
          placeholder="Enter Phone Number"
          placeholderTextColor={colors.textLight}
          keyboardType="phone-pad"
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
        />

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }]}
            onPress={onClose}
            hitSlop={PortalTouchTargets.compactHitSlop}
          >
            <Text
              style={[styles.cancelBtnText, { color: colors.textDark }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={() => onSave(fields)}
            disabled={saving}
            hitSlop={PortalTouchTargets.compactHitSlop}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={styles.saveBtnText}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
              >
                Save Profile
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TrueBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.title,
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: Spacing.xs,
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
    marginTop: Spacing.sm,
    marginBottom: 6,
  },
  input: {
    fontFamily: FontFamily.regular,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    minHeight: 50,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: PortalFontSizes.body,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.lg,
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
  saveBtn: {
    paddingHorizontal: Spacing.lg,
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.md,
    minWidth: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: PortalFontSizes.subheading,
  },
});
