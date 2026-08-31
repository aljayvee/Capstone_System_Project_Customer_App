import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { FontSizes, FontWeights, Spacing, BorderRadius, FontFamily } from '../../config/theme';

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity
            style={[styles.sheet, { backgroundColor: colors.card }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.title, { color: colors.textDark }]}>Edit Profile</Text>

            <Text style={[styles.label, { color: colors.textMedium }]}>First Name</Text>
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
            />

            <Text style={[styles.label, { color: colors.textMedium }]}>Last Name</Text>
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
            />

            <Text style={[styles.label, { color: colors.textMedium }]}>Email Address</Text>
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
            />

            <Text style={[styles.label, { color: colors.textMedium }]}>Mobile Phone Number</Text>
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
            />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textDark }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={() => onSave(fields)}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
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
  title: { fontFamily: FontFamily.bold, fontSize: FontSizes.xl, marginBottom: Spacing.xs },
  label: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, marginTop: Spacing.sm, marginBottom: 4 },
  input: {
    fontFamily: FontFamily.regular,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.sm,
  },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.lg, gap: Spacing.sm },
  cancelBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  cancelBtnText: { fontFamily: FontFamily.bold, fontSize: FontSizes.sm },
  saveBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, minWidth: 120, alignItems: 'center' },
  saveBtnText: { fontFamily: FontFamily.bold, color: '#FFFFFF', fontSize: FontSizes.sm },
});
