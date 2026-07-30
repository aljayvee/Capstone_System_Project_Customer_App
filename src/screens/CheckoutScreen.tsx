import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { RootStackScreenProps, FinalOrder } from '../navigation/types';
import { database } from '../firebase/config';
import { ref, set } from 'firebase/database';

export default function CheckoutScreen({ route, navigation }: RootStackScreenProps<'Checkout'>) {
  const { user, orderPayload } = route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Test', lastName: 'User' },
    orderPayload: { selectedServices: ['Pabili'] },
  };

  const services = orderPayload?.selectedServices || ['Pabili'];

  // Distance estimation
  const distanceKm = 2.5;
  const baseFee = 70;
  const distanceFee = Math.floor(distanceKm) * 5; // ₱10

  // Purchase subtotal calculation
  const billsAmount = orderPayload?.billsInfo?.amount || 0;
  const totalPurchaseAmount = orderPayload?.totalPurchaseAmount || billsAmount;

  // Commission calculation
  let commission = 0;
  if (totalPurchaseAmount > 3000) {
    commission = Math.round(totalPurchaseAmount * 0.1);
  } else if (totalPurchaseAmount > 0) {
    commission = 50;
  }

  const grandTotal = baseFee + distanceFee + commission + totalPurchaseAmount;

  // COD Restriction check
  const isCodRestricted =
    services.includes('Bills Payment') && billsAmount > 3000;

  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'GCash' | 'Bank Transfer'>(
    isCodRestricted ? 'GCash' : 'COD'
  );

  const handleSelectPayment = (method: 'COD' | 'GCash' | 'Bank Transfer') => {
    if (method === 'COD' && isCodRestricted) {
      Alert.alert(
        'COD Unavailable',
        'Cash on Delivery is unavailable for bills over ₱3,000.'
      );
      return;
    }
    setPaymentMethod(method);
  };

  const handlePlaceOrder = () => {
    const orderId = `SGO-${Date.now().toString().slice(-6)}`;
    const finalOrder: FinalOrder = {
      orderId,
      services,
      payload: orderPayload,
      baseFee,
      distanceKm,
      distanceFee,
      commission,
      subtotal: totalPurchaseAmount,
      grandTotal,
      paymentMethod,
      status: 'Order Placed',
      createdAt: Date.now(),
    };

    // Save to Firebase
    try {
      const orderRef = ref(database, `orders/${user.id}`);
      set(orderRef, {
        orderId,
        services: services.join(', '),
        status: 'Order Placed',
        grandTotal,
        paymentMethod,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.log('Firebase write optional in test:', e);
    }

    navigation.navigate('OrderConfirmation', { user, finalOrder });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Checkout & Payment</Text>
      <Text style={styles.subTitle}>Review order summary and select payment method</Text>

      {/* MAP PREVIEW */}
      <View style={styles.mapCard}>
        <Text style={styles.cardTitle}>📍 Delivery Route Map Preview</Text>
        <View style={styles.mapWrapper}>
          <MapView
            testID="map-view"
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: 6.671,
              longitude: 124.6644,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
          >
            <Marker
              testID="customer-marker"
              coordinate={{ latitude: 6.671, longitude: 124.6644 }}
              title="Delivery Location"
            />
          </MapView>
        </View>
      </View>

      {/* ORDER SUMMARY */}
      <View style={styles.card} testID="order-summary-card">
        <Text style={styles.cardTitle}>📋 Order Summary</Text>
        <Text style={styles.summaryItem}>
          <Text style={styles.boldText}>Services:</Text> {services.join(' / ')}
        </Text>
        {orderPayload?.pabiliCats && (
          <Text style={styles.summaryItem}>
            <Text style={styles.boldText}>Pabili Stores:</Text>{' '}
            {orderPayload.pabiliCats.join(', ')}
          </Text>
        )}
        {orderPayload?.padalaInfo && (
          <Text style={styles.summaryItem}>
            <Text style={styles.boldText}>Parcel:</Text>{' '}
            {orderPayload.padalaInfo.item} (To: {orderPayload.padalaInfo.receiverPhone})
          </Text>
        )}
        {orderPayload?.billsInfo && (
          <Text style={styles.summaryItem}>
            <Text style={styles.boldText}>Biller:</Text>{' '}
            {orderPayload.billsInfo.biller} (Acc: {orderPayload.billsInfo.accountNo})
          </Text>
        )}
      </View>

      {/* ITEMIZED PRICE BREAKDOWN */}
      <View style={styles.card} testID="price-breakdown-card">
        <Text style={styles.cardTitle}>💰 Price Breakdown</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Base Delivery Fee:</Text>
          <Text style={styles.priceVal} testID="price-base-fee">₱{baseFee}.00</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Distance Fee ({distanceKm} km @ ₱5/km):</Text>
          <Text style={styles.priceVal} testID="price-distance-fee">₱{distanceFee}.00</Text>
        </View>

        {totalPurchaseAmount > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Purchase Subtotal:</Text>
            <Text style={styles.priceVal}>₱{totalPurchaseAmount.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Service Commission:</Text>
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

        {isCodRestricted && (
          <View style={styles.warningBox} testID="cod-disabled-warning">
            <Text style={styles.warningText}>
              ⚠️ Cash on Delivery (COD) is unavailable for bills &gt; ₱3,000.
            </Text>
          </View>
        )}

        {/* COD Option */}
        <TouchableOpacity
          testID="payment-option-COD"
          style={[
            styles.paymentTile,
            paymentMethod === 'COD' && styles.paymentTileSelected,
            isCodRestricted && styles.paymentTileDisabled,
          ]}
          onPress={() => handleSelectPayment('COD')}
          disabled={isCodRestricted}
        >
          <Text
            style={[
              styles.paymentText,
              paymentMethod === 'COD' && styles.paymentTextSelected,
              isCodRestricted && styles.paymentTextDisabled,
            ]}
          >
            💵 Cash on Delivery (COD) {isCodRestricted ? '(Unavailable)' : ''}
          </Text>
        </TouchableOpacity>

        {/* GCash Option */}
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

        {/* Bank Transfer Option */}
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
        <Text style={styles.submitBtnText}>Place Order Now</Text>
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
  warningBox: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 12 },
  warningText: { color: '#92400E', fontSize: 12, fontWeight: '600' },
  paymentTile: { backgroundColor: '#F9FAFB', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 10 },
  paymentTileSelected: { backgroundColor: '#FFEEF3', borderColor: '#F62459' },
  paymentTileDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB', opacity: 0.6 },
  paymentText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  paymentTextSelected: { color: '#F62459', fontWeight: 'bold' },
  paymentTextDisabled: { color: '#9CA3AF' },
  submitBtn: { backgroundColor: '#F62459', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});
