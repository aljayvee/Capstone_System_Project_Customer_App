import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { RootStackScreenProps, FinalOrder } from '../navigation/types';
import { saveCustomerLocation } from '../firebase/location';
import { API_BASE_URL } from '../config/api';

export default function CheckoutScreen({ route, navigation }: RootStackScreenProps<'Checkout'>) {
  const { user, orderPayload } = route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Test', lastName: 'User' },
    orderPayload: { selectedServices: ['Pabili'], pabiliCats: ['Grocery'], catItems: { Grocery: ['Item 1'] } },
  };

  const services = ['Pabili'];
  const latitude = orderPayload?.latitude || 6.671;
  const longitude = orderPayload?.longitude || 124.6644;

  // Distance estimation for Pabili
  const distanceKm = 2.5;
  const baseFee = 70;
  const distanceFee = Math.floor(distanceKm) * 4; // ₱10
  const totalPurchaseAmount = orderPayload?.totalPurchaseAmount || 0;

  // Commission calculation
  let commission = 0;
  if (totalPurchaseAmount > 3000) {
    commission = Math.round(totalPurchaseAmount * 0.1);
  } else if (totalPurchaseAmount > 0) {
    commission = 50;
  }

  const grandTotal = baseFee + distanceFee + commission + totalPurchaseAmount;

  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'GCash' | 'Bank Transfer'>('COD');

  const handleSelectPayment = (method: 'COD' | 'GCash' | 'Bank Transfer') => {
    setPaymentMethod(method);
  };

  const handlePlaceOrder = async () => {
    const orderId = `PABILI-${Date.now().toString().slice(-6)}`;
    const finalOrder: FinalOrder = {
      orderId,
      services: ['Pabili'],
      payload: orderPayload,
      baseFee,
      distanceKm,
      distanceFee,
      commission,
      subtotal: totalPurchaseAmount,
      grandTotal,
      paymentMethod,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    // 1. Save GPS Location to Firebase Realtime Database
    try {
      await saveCustomerLocation(user.id, latitude, longitude, 'Tacurong City Delivery Location');
    } catch (e) {
      console.error('[Firebase RTDB] Location write warning:', e);
    }

    // 2. Save Order details exclusively into MariaDB database (`errand_system_db`)
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/pabili`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerId: user.id,
          customerName: `${user.firstName} ${user.lastName}`.trim(),
          pabiliCats: orderPayload.pabiliCats,
          catItems: orderPayload.catItems,
          totalPurchaseAmount,
          baseFee,
          distanceKm,
          distanceFee,
          commission,
          grandTotal,
          paymentMethod,
          deliveryAddress: orderPayload.deliveryAddress || 'Tacurong City',
          latitude,
          longitude,
        }),
      });
      if (response && response.ok) {
        const data = await response.json();
        console.log('[MariaDB Backend] Pabili order saved to errand_system_db:', data);
      }
    } catch (err) {
      console.error('[MariaDB Backend] Error saving Pabili order to errand_system_db:', err);
    }

    navigation.navigate('WaitingForDispatcher', { user, orderId, finalOrder });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Checkout & Payment</Text>
      <Text style={styles.subTitle}>Review Pabili order summary and select payment method</Text>

      {/* MAP PREVIEW */}
      <View style={styles.mapCard}>
        <Text style={styles.cardTitle}>📍 Delivery Location Map Preview</Text>
        <View style={styles.mapWrapper}>
          <MapView
            testID="map-view"
            style={styles.map}
            initialRegion={{
              latitude,
              longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
          >
            <Marker
              testID="customer-marker"
              coordinate={{ latitude, longitude }}
              title="Customer GPS Location"
              description="Tacurong City Delivery Spot"
            />
          </MapView>
        </View>
      </View>

      {/* ORDER SUMMARY */}
      <View style={styles.card} testID="order-summary-card">
        <Text style={styles.cardTitle}>📋 Pabili Order Summary</Text>
        <Text style={styles.summaryItem}>
          <Text style={styles.boldText}>Service:</Text> Pabili (Personal Shopper)
        </Text>
        {orderPayload?.pabiliCats && (
          <Text style={styles.summaryItem}>
            <Text style={styles.boldText}>Store Categories:</Text>{' '}
            {orderPayload.pabiliCats.join(', ')}
          </Text>
        )}
      </View>

      {/* ITEMIZIED PRICE BREAKDOWN */}
      <View style={styles.card} testID="price-breakdown-card">
        <Text style={styles.cardTitle}>💰 Price Breakdown</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Base Delivery Fee:</Text>
          <Text style={styles.priceVal} testID="price-base-fee">₱{baseFee}.00</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Distance Fee ({distanceKm} km @ ₱4/km):</Text>
          <Text style={styles.priceVal} testID="price-distance-fee">₱{distanceFee}.00</Text>
        </View>

        {totalPurchaseAmount > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Items Purchase Subtotal:</Text>
            <Text style={styles.priceVal}>₱{totalPurchaseAmount.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Shopper Commission:</Text>
          <Text style={styles.priceVal} testID="price-commission">₱{commission}.00</Text>
        </View>

        <View style={[styles.priceRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Grand Total:</Text>
          <Text style={styles.grandTotalVal} testID="price-grand-total">
            ₱{grandTotal.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* PAYMENT OPTIONS */}
      <View style={styles.card} testID="payment-options-card">
        <Text style={styles.cardTitle}>💳 Select Payment Method</Text>

        <TouchableOpacity
          testID="payment-option-COD"
          style={[
            styles.paymentTile,
            paymentMethod === 'COD' && styles.paymentTileSelected,
          ]}
          onPress={() => handleSelectPayment('COD')}
        >
          <Text
            style={[
              styles.paymentText,
              paymentMethod === 'COD' && styles.paymentTextSelected,
            ]}
          >
            💵 Cash on Delivery (COD)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="payment-option-GCash"
          style={[
            styles.paymentTile,
            paymentMethod === 'GCash' && styles.paymentTileSelected,
          ]}
          onPress={() => handleSelectPayment('GCash')}
        >
          <Text
            style={[
              styles.paymentText,
              paymentMethod === 'GCash' && styles.paymentTextSelected,
            ]}
          >
            📱 GCash (E-Wallet)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="payment-option-Bank Transfer"
          style={[
            styles.paymentTile,
            paymentMethod === 'Bank Transfer' && styles.paymentTileSelected,
          ]}
          onPress={() => handleSelectPayment('Bank Transfer')}
        >
          <Text
            style={[
              styles.paymentText,
              paymentMethod === 'Bank Transfer' && styles.paymentTextSelected,
            ]}
          >
            🏦 Bank Transfer
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        testID="submit-order-button"
        style={styles.submitBtn}
        onPress={handlePlaceOrder}
      >
        <Text style={styles.submitBtnText}>Place Pabili Order Now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  subTitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  mapCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  mapWrapper: { height: 180, borderRadius: 8, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
  summaryItem: { fontSize: 14, color: '#374151', marginBottom: 6 },
  boldText: { fontWeight: 'bold' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, color: '#4B5563' },
  priceVal: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 10, marginTop: 6 },
  grandTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#F62459' },
  grandTotalVal: { fontSize: 18, fontWeight: 'bold', color: '#F62459' },
  paymentTile: { backgroundColor: '#F9FAFB', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 10 },
  paymentTileSelected: { backgroundColor: '#FFEEF3', borderColor: '#F62459' },
  paymentText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  paymentTextSelected: { color: '#F62459', fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#F62459', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});
