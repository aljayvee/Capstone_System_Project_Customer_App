import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { saveCustomerLocation } from '../firebase/location';
import { RootStackScreenProps } from '../navigation/types';

interface SavedLocation {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

export default function CustomerLocationScreen({ route, navigation }: RootStackScreenProps<'CustomerPortal'> | any) {
  const user = route.params?.user || { id: 'test-user', firstName: 'Customer' };

  const [region, setRegion] = useState({
    latitude: 6.671,
    longitude: 124.6644,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  });

  const [pinLocation, setPinLocation] = useState({
    latitude: 6.671,
    longitude: 124.6644,
  });

  const [locationTitle, setLocationTitle] = useState('My Home Address');
  const [addressDetail, setAddressDetail] = useState('Tacurong City Center, Sultan Kudarat');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([
    {
      id: 'loc-1',
      title: 'Home',
      address: 'Poblacion, Tacurong City',
      latitude: 6.671,
      longitude: 124.6644,
    },
    {
      id: 'loc-2',
      title: 'Office',
      address: 'National Highway, Tacurong City',
      latitude: 6.6735,
      longitude: 124.666,
    },
  ]);

  useEffect(() => {
    (async () => {
      try {
        let LocationModule: any = null;
        try {
          LocationModule = require('expo-location');
        } catch (e) {}

        if (LocationModule && LocationModule.requestForegroundPermissionsAsync) {
          const { status } = await LocationModule.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await LocationModule.getCurrentPositionAsync({});
            if (loc && loc.coords) {
              const newCoords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              };
              setPinLocation(newCoords);
              setRegion({
                ...newCoords,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              });
            }
          }
        }
      } catch (e) {
        console.warn('Location permission request note:', e);
      }
    })();
  }, []);

  const handleSaveLocation = async () => {
    if (!locationTitle.trim()) {
      Alert.alert('Validation Error', 'Please enter a title for this location.');
      return;
    }

    if (editingId) {
      setSavedLocations((prev) =>
        prev.map((loc) =>
          loc.id === editingId
            ? { ...loc, title: locationTitle, address: addressDetail, ...pinLocation }
            : loc
        )
      );
      setEditingId(null);
      Alert.alert('Updated', 'Location updated successfully.');
    } else {
      const newLoc: SavedLocation = {
        id: `loc-${Date.now()}`,
        title: locationTitle,
        address: addressDetail,
        ...pinLocation,
      };
      setSavedLocations((prev) => [...prev, newLoc]);
      Alert.alert('Saved', 'New Food Panda style delivery location added!');
    }

    // Save to Firebase Realtime Database
    try {
      await saveCustomerLocation(user.id, pinLocation.latitude, pinLocation.longitude, addressDetail);
    } catch (e) {}

    setLocationTitle('');
    setAddressDetail('');
  };

  const handleEdit = (loc: SavedLocation) => {
    setEditingId(loc.id);
    setLocationTitle(loc.title);
    setAddressDetail(loc.address);
    setPinLocation({ latitude: loc.latitude, longitude: loc.longitude });
    setRegion({ latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Location', 'Are you sure you want to remove this delivery location?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSavedLocations((prev) => prev.filter((loc) => loc.id !== id));
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>📍 My Delivery Locations</Text>
      <Text style={styles.subTitle}>
        Pinpoint your exact delivery location on the map (Food Panda Style)
      </Text>

      {/* MAP PINPOINTING CONTAINER */}
      <View style={styles.mapCard}>
        <View style={styles.mapWrapper}>
          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={(r) => {
              setPinLocation({ latitude: r.latitude, longitude: r.longitude });
            }}
          >
            <Marker
              coordinate={pinLocation}
              title="Pinpointed Delivery Spot"
              description={addressDetail}
              draggable
              onDragEnd={(e) => setPinLocation(e.nativeEvent.coordinate)}
              pinColor="#F62459"
            />
          </MapView>
          <View style={styles.centerPinBadge}>
            <Text style={styles.centerPinText}>🎯 Drag map to pinpoint</Text>
          </View>
        </View>

        <Text style={styles.coordText}>
          Coordinates: {pinLocation.latitude.toFixed(5)}, {pinLocation.longitude.toFixed(5)}
        </Text>
      </View>

      {/* INPUT FORM FOR ADD / EDIT LOCATION */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{editingId ? '✏️ Edit Location' : '➕ Add Saved Location'}</Text>
        
        <Text style={styles.inputLabel}>Location Label (e.g. Home, Office, Condo):</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Location Title..."
          value={locationTitle}
          onChangeText={setLocationTitle}
        />

        <Text style={styles.inputLabel}>Address / Delivery Landmark:</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Detailed street name or landmark..."
          value={addressDetail}
          onChangeText={setAddressDetail}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveLocation}>
          <Text style={styles.saveBtnText}>{editingId ? 'Update Location' : 'Save Location Pinpoint'}</Text>
        </TouchableOpacity>
      </View>

      {/* SAVED LOCATIONS LIST */}
      <Text style={styles.sectionTitle}>📋 Saved Delivery Locations ({savedLocations.length})</Text>
      {savedLocations.map((loc) => (
        <View key={loc.id} style={styles.locCard}>
          <View style={styles.locInfo}>
            <Text style={styles.locTitle}>📍 {loc.title}</Text>
            <Text style={styles.locAddress}>{loc.address}</Text>
            <Text style={styles.locCoords}>
              {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(loc)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(loc.id)}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  subTitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  mapCard: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  mapWrapper: { height: 220, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  map: { width: '100%', height: '100%' },
  centerPinBadge: { position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: '#1F2937', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  centerPinText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  coordText: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 8, fontFamily: 'monospace' },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4B5563', marginBottom: 4 },
  textInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 14 },
  saveBtn: { backgroundColor: '#F62459', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  locCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locInfo: { flex: 1 },
  locTitle: { fontSize: 15, fontWeight: 'bold', color: '#1F2937' },
  locAddress: { fontSize: 12, color: '#4B5563', marginTop: 2 },
  locCoords: { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' },
  actionRow: { flexDirection: 'row', gap: 6 },
  editBtn: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { color: '#1E40AF', fontWeight: 'bold', fontSize: 12 },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  deleteBtnText: { color: '#DC2626', fontWeight: 'bold', fontSize: 12 },
});
