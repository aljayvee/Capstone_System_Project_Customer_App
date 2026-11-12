import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { showAppAlert } from '../../services/alertModal';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  FontSizes,
  Spacing,
  BorderRadius,
  FontFamily,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';
import { MapCoordinate, sanitizeCoordinate } from '../../utils/coords';
import WizardStepPin from './WizardStepPin';
import WizardStepDetails from './WizardStepDetails';
import { LocationDraftPayload, SavedLocation } from './types';

export interface LocationWizardProps {
  initialValues: SavedLocation | Partial<LocationDraftPayload> | null;
  initialStep?: 1 | 2;
  saving: boolean;
  gpsLoading: boolean;
  onUseCurrentLocation: () => Promise<MapCoordinate | null>;
  onSave: (payload: LocationDraftPayload) => void;
  onCancel: () => void;
}

export default function LocationWizard({
  initialValues,
  initialStep = 1,
  saving,
  gpsLoading,
  onUseCurrentLocation,
  onSave,
  onCancel,
}: LocationWizardProps) {
  const { colors, isDark } = useThemeColor();
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [pin, setPin] = useState<MapCoordinate | null>(
    initialValues && typeof initialValues.latitude === 'number' && typeof initialValues.longitude === 'number'
      ? sanitizeCoordinate({ latitude: initialValues.latitude, longitude: initialValues.longitude })
      : null
  );
  const [label, setLabel] = useState(initialValues?.label ?? (initialStep === 2 ? 'Home' : ''));
  const [address, setAddress] = useState(initialValues?.address ?? '');
  const [streetName, setStreetName] = useState(initialValues?.streetName ?? '');
  const [landmark, setLandmark] = useState(initialValues?.landmark ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [isDefault, setIsDefault] = useState(initialValues?.isDefault ?? (initialStep === 2 ? true : false));

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
      showAppAlert({
        title: 'Validation Error',
        message: 'Please enter a label (e.g. Home, Work).',
        variant: 'warning',
      });
      return;
    }
    if (!address.trim()) {
      showAppAlert({
        title: 'Validation Error',
        message: 'Please enter an address.',
        variant: 'warning',
      });
      return;
    }
    if (!pin) {
      showAppAlert({
        title: 'Validation Error',
        message: 'Please pin a location first.',
        variant: 'warning',
      });
      return;
    }
    onSave({
      label: label.trim(),
      address: address.trim(),
      // Optional. Blank goes as null so editing a place can clear one again.
      streetName: streetName.trim() || null,
      landmark: landmark.trim() || null,
      notes: notes.trim() || null,
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
          hitSlop={PortalTouchTargets.compactHitSlop}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textDark} />
        </TouchableOpacity>
        <View style={styles.stepIndicatorCol}>
          <Text
            style={[styles.stepLabel, { color: colors.textGray }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          >
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
          streetName={streetName}
          onStreetNameChange={setStreetName}
          landmark={landmark}
          onLandmarkChange={setLandmark}
          notes={notes}
          onNotesChange={setNotes}
          isDefault={isDefault}
          onIsDefaultChange={setIsDefault}
          isCurrentDefault={isCurrentDefault}
          saving={saving}
          isEditing={Boolean(initialValues && 'id' in initialValues && (initialValues as SavedLocation).id)}
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
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: PortalTouchTargets.compact,
  },
  stepIndicatorCol: { alignItems: 'center' },
  stepLabel: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    marginBottom: 4,
  },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
});
