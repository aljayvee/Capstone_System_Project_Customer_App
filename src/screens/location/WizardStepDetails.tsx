import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontSizes,
  Spacing,
  BorderRadius,
  FontFamily,
  Shadows,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
import SettingsRow from '../../components/SettingsRow';
import SettingsSection from '../../components/SettingsSection';
import { LOCATION_LABEL_CHIPS } from '../../utils/locationLabelIcons';
import { DELIVERY_NOTES_MAX, LANDMARK_MAX, STREET_NAME_MAX } from './types';

export interface WizardStepDetailsProps {
  label: string;
  onLabelChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
  streetName: string;
  onStreetNameChange: (value: string) => void;
  landmark: string;
  onLandmarkChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  isDefault: boolean;
  onIsDefaultChange: (value: boolean) => void;
  isCurrentDefault: boolean;
  saving: boolean;
  isEditing: boolean;
  onSave: () => void;
}

// Room left between the focused field and the top of the Save bar when the
// keyboard is open, so the field is never tucked right against it.
const FOCUSED_FIELD_GAP = Spacing.md;

export default function WizardStepDetails({
  label,
  onLabelChange,
  address,
  onAddressChange,
  streetName,
  onStreetNameChange,
  landmark,
  onLandmarkChange,
  notes,
  onNotesChange,
  isDefault,
  onIsDefaultChange,
  isCurrentDefault,
  saving,
  isEditing,
  onSave,
}: WizardStepDetailsProps) {
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const labelInputRef = useRef<TextInput>(null);
  const landmarkInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const normalizedLabel = label.trim().toLowerCase();

  // The Save bar rides on top of the keyboard, so the scroll view has to keep
  // the focused field clear of the bar as well as of the keyboard itself.
  const [footerHeight, setFooterHeight] = useState(0);

  const inputSurface = {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.card,
    borderColor: colors.border,
    color: colors.textDark,
  };

  const renderFieldLabel = (text: string, optional = false) => (
    <Text
      style={[styles.inputLabel, { color: colors.textDark }]}
      maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
    >
      {text}
      {optional ? (
        <Text style={[styles.optionalTag, { color: colors.textGray }]}> (optional)</Text>
      ) : null}
    </Text>
  );

  return (
    <View style={styles.flex}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        bottomOffset={footerHeight + FOCUSED_FIELD_GAP}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[styles.title, { color: colors.textDark }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
        >
          Name This Location
        </Text>
        <Text
          style={[styles.subtitle, { color: colors.textGray }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
        >
          Give it a label so you can find it quickly next time.
        </Text>

        <View style={styles.chipRow}>
          {LOCATION_LABEL_CHIPS.map((chip) => {
            const active = chip.label.toLowerCase() === normalizedLabel;
            return (
              <TouchableOpacity
                key={chip.label}
                activeOpacity={0.8}
                hitSlop={PortalTouchTargets.compactHitSlop}
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
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {renderFieldLabel('Label')}
        <TextInput
          ref={labelInputRef}
          style={[styles.textInput, inputSurface]}
          placeholder="e.g. Home, Work, School"
          placeholderTextColor={colors.textLight}
          value={label}
          onChangeText={onLabelChange}
          maxLength={30}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          testID="location-label-input"
        />

        {renderFieldLabel('Address')}
        <TextInput
          style={[styles.textInput, styles.textInputMultiline, inputSurface]}
          placeholder="House no., building, purok or barangay"
          placeholderTextColor={colors.textLight}
          value={address}
          onChangeText={onAddressChange}
          multiline
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          testID="location-address-input"
        />

        {renderFieldLabel('Street Name', true)}
        <TextInput
          style={[styles.textInput, inputSurface]}
          placeholder="e.g. Rizal Street"
          placeholderTextColor={colors.textLight}
          value={streetName}
          onChangeText={onStreetNameChange}
          maxLength={STREET_NAME_MAX}
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => landmarkInputRef.current?.focus()}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          testID="location-street-input"
        />

        {renderFieldLabel('Landmark', true)}
        <TextInput
          ref={landmarkInputRef}
          style={[styles.textInput, inputSurface]}
          placeholder="e.g. Blue gate beside the chapel"
          placeholderTextColor={colors.textLight}
          value={landmark}
          onChangeText={onLandmarkChange}
          maxLength={LANDMARK_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => notesInputRef.current?.focus()}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          testID="location-landmark-input"
        />

        {renderFieldLabel('Notes for the Rider', true)}
        <TextInput
          ref={notesInputRef}
          style={[styles.textInput, styles.textInputMultiline, styles.notesInput, inputSurface]}
          placeholder="e.g. Call when you arrive. Leave it with the guard."
          placeholderTextColor={colors.textLight}
          value={notes}
          onChangeText={onNotesChange}
          maxLength={DELIVERY_NOTES_MAX}
          multiline
          maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          testID="location-notes-input"
        />
        <Text
          style={[styles.fieldHint, { color: colors.textGray }]}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
        >
          Your rider sees the street, landmark and notes when delivering here.
        </Text>

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
      </KeyboardAwareScrollView>

      {/* The keyboard height includes the bottom inset the screen already pads
          for, so the bar is lifted by that much less to land on the keyboard
          rather than float above it. */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.bgApp }]}
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        >
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }, Shadows.soft]}
            onPress={onSave}
            disabled={saving}
            activeOpacity={0.85}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID="location-save-button"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text
                style={styles.saveBtnText}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
              >
                {isEditing ? 'Update Location' : 'Save Location'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.title,
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginBottom: Spacing.lg,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    minHeight: PortalTouchTargets.pillHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
  },
  inputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    marginBottom: Spacing.xs,
  },
  optionalTag: {
    fontFamily: FontFamily.regular,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: PortalFontSizes.body,
    fontFamily: FontFamily.regular,
    marginBottom: Spacing.lg,
    minHeight: 52,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm + 2,
  },
  notesInput: {
    marginBottom: Spacing.xs,
  },
  fieldHint: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginBottom: Spacing.lg,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  saveBtn: {
    minHeight: PortalTouchTargets.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
});
