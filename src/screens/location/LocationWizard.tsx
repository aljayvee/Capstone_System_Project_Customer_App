import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { FontSizes, Spacing, BorderRadius, FontFamily, scaledFontSize, moderateScale } from '../../config/theme';
import { MapCoordinate, sanitizeCoordinate } from '../../utils/coords';
import WizardStepPin from './WizardStepPin';
import WizardStepDetails from './WizardStepDetails';
import { LocationDraftPayload, SavedLocation } from './types';

export interface LocationWizardProps {
  initialValues: SavedLocation | null;
  saving: boolean;
  gpsLoading: boolean;
  onUseCurrentLocation: () => Promise<MapCoordinate | null>;
  onSave: (payload: LocationDraftPayload) => void;
  onCancel: () => void;
}

export default function LocationWizard({
  initialValues,
  saving,
  gpsLoading,
  onUseCurrentLocation,
  onSave,
  onCancel,
}: LocationWizardProps) {
  const { colors, isDark } = useThemeColor();
  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState<MapCoordinate | null>(initialValues ? sanitizeCoordinate(initialValues) : null);
  const [label, setLabel] = useState(initialValues?.label ?? '');
  const [address, setAddress] = useState(initialValues?.address ?? '');
  const [isDefault, setIsDefault] = useState(initialValues?.isDefault ?? false);

  const isCurrentDefault = initialValues?.isDefault === true;

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      onCancel();
    }
  };

  // Mirrors the in-UI back-chevron so the Android hardware back button steps
  // back one wizard step instead of dropping the whole in-progress draft.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleStep1Next = (resolvedAddress: string | null) => {
    setStep(2);
    // Never clobber text the user already typed if they step back and forward again.
    setAddress((prev) => (prev.trim() ? prev : resolvedAddress ?? ''));
  };

  const handleSave = () => {
    if (!label.trim()) {
      Alert.alert('Validation Error', 'Please enter a label (e.g. Home, Work).');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Validation Error', 'Please enter an address or delivery landmark.');
      return;
    }
    if (!pin) {
      Alert.alert('Validation Error', 'Please pin a location first.');
      return;
    }
    onSave({
      label: label.trim(),
      address: address.trim(),
      latitude: pin.latitude,
      longitude: pin.longitude,
      isDefault: isCurrentDefault ? true : isDefault,
    });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bgApp }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textDark} />
        </TouchableOpacity>
        <View style={styles.stepIndicatorCol}>
          <Text style={[styles.stepLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
            Step {step} of 2
          </Text>
          <View style={styles.dotsRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: step >= 1 ? colors.primary : isDark ? 'rgba(255,255,255,0.15)' : colors.border },
              ]}
            />
            <View
              style={[
                styles.dot,
                { backgroundColor: step >= 2 ? colors.primary : isDark ? 'rgba(255,255,255,0.15)' : colors.border },
              ]}
            />
          </View>
        </View>
        <View style={styles.backBtnPlaceholder} />
      </View>

      {step === 1 ? (
        <WizardStepPin
          pin={pin}
          onSelectPin={setPin}
          gpsLoading={gpsLoading}
          onUseCurrentLocation={onUseCurrentLocation}
          onNext={handleStep1Next}
        />
      ) : (
        <WizardStepDetails
          label={label}
          onLabelChange={setLabel}
          address={address}
          onAddressChange={setAddress}
          isDefault={isDefault}
          onIsDefaultChange={setIsDefault}
          isCurrentDefault={isCurrentDefault}
          saving={saving}
          isEditing={initialValues !== null}
          onSave={handleSave}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10, 0.2),
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 36,
  },
  stepIndicatorCol: { alignItems: 'center' },
  stepLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginBottom: 4,
  },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
});
