import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import { saveCustomerLocation } from '../firebase/location';
import { showAppAlert, showAppConfirm } from '../services/alertModal';
import { RootStackScreenProps } from '../navigation/types';
import { MapCoordinate } from '../utils/coords';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  FontFamily,
  FontSizes,
  BorderRadius,
  Spacing,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import {
  deleteLocationOptimistic,
  setDefaultLocationOptimistic,
  useSavedLocations,
} from '../hooks/useSavedLocations';
import LocationList from './location/LocationList';
import LocationWizard from './location/LocationWizard';
import { LocationDraftPayload, SavedLocation } from './location/types';

const MAX_LOCATIONS = 5;

export default function CustomerLocationScreen({ route, navigation }: RootStackScreenProps<'CustomerLocation'> | any) {
  const user = route.params?.user || { id: 0, firstName: 'Customer' };
  const initialMode = route.params?.initialMode ?? 'list';
  const initialStep = (route.params?.initialStep as (1 | 2)) ?? 1;
  const detectedLocation = route.params?.detectedLocation;

  const { colors, isDark } = useThemeColor();
  const { isTablet } = useResponsive();

  const [mode, setMode] = useState<'list' | 'wizard'>(initialMode);
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | Partial<LocationDraftPayload> | null>(() => {
    if (detectedLocation) {
      return {
        latitude: detectedLocation.latitude,
        longitude: detectedLocation.longitude,
        address: detectedLocation.address || '',
        label: 'Home',
        streetName: '',
        landmark: '',
        notes: '',
        isDefault: true,
      };
    }
    return null;
  });

  // The shared, cached list (2026-10-14): the last one shows at once and is
  // refreshed quietly. A slow connection used to end in "Could not load saved
  // locations" over an empty list; now that only shows, inline with Try
  // again, when there is no list at all to fall back on.
  const {
    locations: savedLocations,
    isLoading: loading,
    error: loadError,
    data: cachedList,
    revalidate,
  } = useSavedLocations(user.id);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadLocations = useCallback(() => revalidate({ force: true }), [revalidate]);

  const enterWizard = (location: SavedLocation | null) => {
    setEditingLocation(location);
    setStep(location ? 2 : 1);
    setMode('wizard');
  };

  const exitWizard = () => {
    setMode('list');
    setEditingLocation(null);
    setStep(1);
  };

  const handleUseCurrentLocation = async (): Promise<MapCoordinate | null> => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAppAlert('Permission Denied', 'Location access is needed to auto-fill your delivery pin.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      showAppAlert('GPS Error', 'Could not get your current location. Try again.');
      return null;
    } finally {
      setGpsLoading(false);
    }
  };

  const handleWizardSave = async (payload: LocationDraftPayload) => {
    setSaving(true);
    try {
      if (editingLocation && 'id' in editingLocation && editingLocation.id) {
        await apiClient.put(`/customer-locations/${editingLocation.id}`, payload);
        showAppAlert({ title: 'Updated', message: 'Delivery location updated.', variant: 'success' });
      } else {
        const { isDefault, ...createFields } = payload;
        const res = await apiClient.post('/customer-locations', { userId: user.id, ...createFields });
        const newId = res.data?.id;
        if (isDefault && newId) {
          await apiClient.put(`/customer-locations/${newId}`, { ...payload, isDefault: true }).catch(() => {});
        }
        showAppAlert({ title: 'Saved', message: 'New delivery location added.', variant: 'success' });
        saveCustomerLocation(user.id, payload.latitude, payload.longitude, payload.address).catch(() => {});
      }
      AsyncStorage.removeItem('@sugo_onboarding_location_draft').catch(() => {});
      await loadLocations();
      exitWizard();
    } catch (err: unknown) {
      showAppAlert('Place not saved', toUserMessage(err, 'location'));
    } finally {
      setSaving(false);
    }
  };

  // Optimistic (2026-10-14): the card is the default the moment it is tapped,
  // here and in the Home header, and the server is told after. It used to wait
  // for the save and a full reload, which on a slow connection took seconds.
  // If the server refuses, the old default comes back.
  const handleSetDefault = async (loc: SavedLocation) => {
    if (loc.isDefault) return;
    try {
      await setDefaultLocationOptimistic(user.id, loc);
      saveCustomerLocation(user.id, loc.latitude, loc.longitude, loc.address).catch(() => {});
    } catch (err: unknown) {
      showAppAlert('Default not changed', toUserMessage(err, 'location'));
    }
  };

  const handleDelete = (loc: SavedLocation) => {
    showAppConfirm({
      title: 'Delete Location',
      message: `Remove "${loc.label}" from saved locations?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
      icon: 'trash',
      // Optimistic too: gone at once, back if the server refuses.
      onConfirm: async () => {
        try {
          await deleteLocationOptimistic(user.id, loc);
        } catch (err: unknown) {
          showAppAlert('Location not deleted', toUserMessage(err, 'location'));
        }
      },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.responsiveWrapper}>
        {mode === 'list' && (
          <View style={styles.navHeaderRow}>
            <TouchableOpacity
              onPress={() => navigation?.goBack?.()}
              hitSlop={PortalTouchTargets.compactHitSlop}
              style={styles.backBtn}
              testID="back-button"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={24} color={colors.textDark} />
            </TouchableOpacity>
            <Text
              style={[styles.navTitle, { color: colors.textDark }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
            >
              Saved Locations
            </Text>
            <View style={styles.navHeaderRightPlaceholder} />
          </View>
        )}

        {mode === 'list' ? (
          <LocationList
            locations={savedLocations}
            loading={loading}
            loadFailed={cachedList === undefined && loadError !== null}
            onRetry={() => void loadLocations()}
            canAddMore={savedLocations.length < MAX_LOCATIONS}
            maxLocations={MAX_LOCATIONS}
            onAddNew={() => enterWizard(null)}
            onSetDefault={handleSetDefault}
            onEdit={enterWizard}
            onDelete={handleDelete}
          />
        ) : (
          <LocationWizard
            key={((editingLocation as any)?.id) ?? (detectedLocation ? 'onboarding' : 'new')}
            initialValues={editingLocation}
            initialStep={step}
            saving={saving}
            gpsLoading={gpsLoading}
            onUseCurrentLocation={handleUseCurrentLocation}
            onSave={handleWizardSave}
            onCancel={exitWizard}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  responsiveWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
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
});
