import React, { useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { FontSizes, Spacing, BorderRadius, FontFamily, Shadows, scaledFontSize, moderateScale } from '../../config/theme';
import SettingsRow from '../../components/SettingsRow';
import SettingsSection from '../../components/SettingsSection';
import { LOCATION_LABEL_CHIPS } from '../../utils/locationLabelIcons';

export interface WizardStepDetailsProps {
  label: string;
  onLabelChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
  isDefault: boolean;
  onIsDefaultChange: (value: boolean) => void;
  isCurrentDefault: boolean;
  saving: boolean;
  isEditing: boolean;
  onSave: () => void;
}

export default function WizardStepDetails({
  label,
  onLabelChange,
  address,
  onAddressChange,
  isDefault,
  onIsDefaultChange,
  isCurrentDefault,
  saving,
  isEditing,
  onSave,
}: WizardStepDetailsProps) {
  const { colors, isDark } = useThemeColor();
  const labelInputRef = useRef<TextInput>(null);
  const normalizedLabel = label.trim().toLowerCase();

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
          Name This Location
        </Text>
        <Text style={[styles.subtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
          Give it a label so you can find it quickly next time.
        </Text>

        <View style={styles.chipRow}>
          {LOCATION_LABEL_CHIPS.map((chip) => {
            const active = chip.label.toLowerCase() === normalizedLabel;
            return (
              <TouchableOpacity
                key={chip.label}
                activeOpacity={0.8}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? colors.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : colors.card,
                  },
                  active ? Shadows.soft : null,
                ]}
                onPress={() => {
                  if (chip.label === 'Other') {
                    onLabelChange('');
                    labelInputRef.current?.focus();
                  } else {
                    onLabelChange(chip.label);
                  }
                }}
              >
                <chip.Icon size={16} color={active ? '#FFFFFF' : colors.primary} strokeWidth={2.2} />
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#FFFFFF' : isDark ? colors.textDark : colors.textMedium },
                  ]}
                  maxFontSizeMultiplier={1.15}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.inputLabel, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
          Label
        </Text>
        <TextInput
          ref={labelInputRef}
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
              borderColor: colors.border,
              color: colors.textDark,
            },
          ]}
          placeholder="e.g. Home, Work, School"
          placeholderTextColor={colors.textLight}
          value={label}
          onChangeText={onLabelChange}
          maxLength={30}
        />

        <Text style={[styles.inputLabel, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
          Address / Delivery Landmark
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textInputMultiline,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
              borderColor: colors.border,
              color: colors.textDark,
            },
          ]}
          placeholder="Street name, building, or landmark..."
          placeholderTextColor={colors.textLight}
          value={address}
          onChangeText={onAddressChange}
          multiline
        />

        <SettingsSection>
          {isCurrentDefault ? (
            <SettingsRow icon={Star} label="Default Location" subtitle="This is already your default delivery location" />
          ) : (
            <SettingsRow
              icon={Star}
              label="Set as Default"
              subtitle="Use this as your primary delivery location"
              trailing={
                <Switch
                  value={isDefault}
                  onValueChange={onIsDefaultChange}
                  trackColor={{ true: colors.primary, false: isDark ? 'rgba(255,255,255,0.2)' : colors.border }}
                  thumbColor="#FFFFFF"
                />
              }
            />
          )}
        </SettingsSection>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, Shadows.soft]}
          onPress={onSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText} maxFontSizeMultiplier={1.15}>
              {isEditing ? 'Update Location' : 'Save Location'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xl, 0.2),
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
    marginBottom: Spacing.lg,
    lineHeight: moderateScale(18, 0.2),
  },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7, 0.2),
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs + 0.5, 0.2),
  },
  inputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs + 0.5, 0.2),
    marginBottom: Spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10, 0.2),
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.regular,
    marginBottom: Spacing.lg,
    minHeight: moderateScale(46, 0.2),
  },
  textInputMultiline: {
    minHeight: moderateScale(75, 0.2),
    textAlignVertical: 'top',
    paddingTop: Spacing.sm + 2,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  saveBtn: {
    paddingVertical: moderateScale(12, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: moderateScale(48, 0.2),
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
});
