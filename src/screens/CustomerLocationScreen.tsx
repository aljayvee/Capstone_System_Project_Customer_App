import React, { useState, useEffect, useCallback } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import { apiClient } from '../services/apiClient';
import { saveCustomerLocation } from '../firebase/location';
import { RootStackScreenProps } from '../navigation/types';
import { MapCoordinate } from '../utils/coords';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, BorderRadius, Spacing, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import LocationList from './location/LocationList';
import LocationWizard from './location/LocationWizard';
import { LocationDraftPayload, SavedLocation } from './location/types';

const MAX_LOCATIONS = 5;

export default function CustomerLocationScreen({ route, navigation }: RootStackScreenProps<'CustomerLocation'> | any) {
  const user = route.params?.user || { id: 0, firstName: 'Customer' };
  const { colors, isDark } = useThemeColor();
  const { isTablet } = useResponsive();

  const [mode, setMode] = useState<'list' | 'wizard'>('list');
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const loadLocations = useCallback(async () => {
    try {
      const res = await apiClient.get(`/customer-locations/${user.id}`);
      setSavedLocations(res.data as SavedLocation[]);
    } catch {
      Alert.alert('Error', 'Could not load saved locations.');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const enterWizard = (location: SavedLocation | null) => {
    setEditingLocation(location);
    setMode('wizard');
  };

  const exitWizard = () => {
    setMode('list');
    setEditingLocation(null);
  };

  const handleUseCurrentLocation = async (): Promise<MapCoordinate | null> => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed to auto-fill your delivery pin.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      Alert.alert('GPS Error', 'Could not get your current location. Try again.');
      return null;
    } finally {
      setGpsLoading(false);
    }
  };

  const handleWizardSave = async (payload: LocationDraftPayload) => {
    setSaving(true);
    try {
      if (editingLocation) {
        await apiClient.put(`/customer-locations/${editingLocation.id}`, payload);
        Alert.alert('Updated', 'Delivery location updated.');
      } else {
        const { isDefault, ...createFields } = payload;
        const res = await apiClient.post('/customer-locations', { userId: user.id, ...createFields });
        const newId = res.data?.id;
        if (isDefault && newId) {
          await apiClient.put(`/customer-locations/${newId}`, { ...payload, isDefault: true }).catch(() => {});
        }
        Alert.alert('Saved', 'New delivery location added.');
        saveCustomerLocation(user.id, payload.latitude, payload.longitude, payload.address).catch(() => {});
      }
      await loadLocations();
      exitWizard();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save location.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (loc: SavedLocation) => {
    try {
      await apiClient.put(`/customer-locations/${loc.id}`, {
        label: loc.label,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isDefault: true,
      });
      await loadLocations();
    } catch {
      Alert.alert('Error', 'Could not set default location.');
    }
  };

  const handleDelete = (loc: SavedLocation) => {
    Alert.alert('Delete Location', `Remove "${loc.label}" from saved locations?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/customer-locations/${loc.id}`);
            await loadLocations();
          } catch {
            Alert.alert('Error', 'Could not delete location.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.responsiveWrapper}>
        {mode === 'list' && (
          <View style={styles.navHeaderRow}>
            <TouchableOpacity
              onPress={() => navigation?.goBack?.()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.backBtn}
              testID="back-button"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={24} color={colors.textDark} />
            </TouchableOpacity>
            <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>Saved Locations</Text>
            <View style={styles.navHeaderRightPlaceholder} />
          </View>
        )}

        {mode === 'list' ? (
          <LocationList
            locations={savedLocations}
            loading={loading}
            canAddMore={savedLocations.length < MAX_LOCATIONS}
            maxLocations={MAX_LOCATIONS}
            onAddNew={() => enterWizard(null)}
            onSetDefault={handleSetDefault}
            onEdit={enterWizard}
            onDelete={handleDelete}
          />
        ) : (
          <LocationWizard
            key={editingLocation?.id ?? 'new'}
            initialValues={editingLocation}
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
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
  },
  navHeaderRightPlaceholder: {
    width: 36,
  },
});
