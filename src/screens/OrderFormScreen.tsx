import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { RootStackScreenProps } from '../navigation/types';
import { saveCustomerLocation } from '../firebase/location';
import { API_BASE_URL } from '../config/api';
export const PABILI_CATEGORIES = [
  'Retail Store',
  'Restaurant',
  'Pharmacy',
  'Department Store',
  'Convenience Store',
  'Cafés',
  'Bakery',
  'Remittance',
  'Banks',
  'Food Stalls',
  'Frozen Goods',
  'Other',
];

export default function OrderFormScreen({ route, navigation }: RootStackScreenProps<'OrderForm'>) {
  const { user, selectedServices = ['Pabili'] } = route.params || {};

  // Pabili State (Categories Only)
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [pabiliError, setPabiliError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleCategory = (catName: string) => {
    setPabiliError(null);
    if (selectedCats.includes(catName)) {
      setSelectedCats(selectedCats.filter((c) => c !== catName));
    } else {
      if (selectedCats.length >= 3) {
        const msg = 'You can select up to 3 store categories only.';
        setPabiliError(msg);
        Alert.alert('Category Limit', msg);
        return;
      }
      setSelectedCats([...selectedCats, catName]);
    }
  };

  const validateAndSubmit = async () => {
    setValidationError(null);

    if (selectedCats.length === 0) {
      setValidationError('Please select at least one Pabili store category.');
      return;
    }

    const orderId = `PABILI-${Date.now().toString().slice(-6)}`;
    const latitude = 6.671;
    const longitude = 124.6644;
    
    // We omit checkout details as they will be handled by the rider.
    // Provide default zeroed/placeholder values for the backend schema.
    const baseFee = 0;
    const distanceKm = 0;
    const distanceFee = 0;
    const commission = 0;
    const totalPurchaseAmount = 0;
    const grandTotal = 0;
    const paymentMethod = 'COD';

    // Save GPS Location to Firebase Realtime Database
    try {
      await saveCustomerLocation(user.id, latitude, longitude, 'Tacurong City Delivery Location');
    } catch (e) {
      console.error('[Firebase RTDB] Location write warning:', e);
    }

    // Save Order details exclusively into MariaDB database (`errand_system_db`)
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/pabili`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerId: user.id,
          customerName: `${user.firstName} ${user.lastName}`.trim(),
          pabiliCats: selectedCats,
          catItems: {}, // Handled by chat
          totalPurchaseAmount,
          baseFee,
          distanceKm,
          distanceFee,
          commission,
          grandTotal,
          paymentMethod,
          deliveryAddress: 'Tacurong City Center',
          latitude,
          longitude,
        }),
      });
      if (response && response.ok) {
        console.log('[MariaDB Backend] Pabili order saved to errand_system_db');
      }
    } catch (err) {
      console.error('[MariaDB Backend] Error saving Pabili order to errand_system_db:', err);
    }

    navigation.navigate('WaitingForDispatcher', { user, orderId });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Pabili Order Form</Text>
      <Text style={styles.subTitle}>Select up to 3 store categories. The dispatcher will help you with specific items via chat.</Text>

      {validationError ? (
        <View style={styles.errorBanner} testID="validation-error-banner">
          <Text style={styles.errorText} testID="validation-error-text">
            {validationError}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionCard} testID="pabili-section">
        <Text style={styles.sectionTitle}>🛒 Pabili Store Categories</Text>
        <Text style={styles.sectionSubtitle}>
          Tap store categories (max 3) for your errand:
        </Text>

        {pabiliError ? (
          <Text style={styles.errorText} testID="category-limit-error">
            {pabiliError}
          </Text>
        ) : null}

        <View style={styles.categoryGrid}>
          {PABILI_CATEGORIES.map((cat) => {
            const isSelected = selectedCats.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                testID={`category-card-${cat}`}
                style={[styles.categoryBadge, isSelected && styles.categoryBadgeSelected]}
                onPress={() => toggleCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    isSelected && styles.categoryBadgeTextSelected,
                  ]}
                >
                  {cat} {isSelected ? '✓' : '+'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        testID="submit-order-form-button"
        style={styles.submitBtn}
        onPress={validateAndSubmit}
      >
        <Text style={styles.submitBtnText}>Submit Order Request</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  subTitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  errorBanner: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: '#DC2626', fontWeight: '600', textAlign: 'center' },
  sectionCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#F62459', marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  categoryBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  categoryBadgeSelected: { backgroundColor: '#F62459', borderColor: '#F62459' },
  categoryBadgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  categoryBadgeTextSelected: { color: '#FFFFFF' },
  submitBtn: { backgroundColor: '#F62459', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});
