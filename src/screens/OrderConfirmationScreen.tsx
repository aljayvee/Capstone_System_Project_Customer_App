import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { RootStackScreenProps } from '../navigation/types';

export const TRACKING_STEPS = [
  'Order Received',
  'Rider Assigned',
  'Traveling to Location',
  'Items Purchased / Picked Up',
  'En Route to Destination',
  'Delivered',
];

export default function OrderConfirmationScreen({
  route,
  navigation,
}: RootStackScreenProps<'OrderConfirmation'>) {
  const { user, finalOrder } = route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Test', lastName: 'User' },
    finalOrder: {
      orderId: 'SGO-123456',
      services: ['Pabili'],
      payload: { selectedServices: ['Pabili'] },
      baseFee: 70,
      distanceKm: 2.5,
      distanceFee: 10,
      commission: 50,
      subtotal: 0,
      grandTotal: 130,
      paymentMethod: 'COD',
      status: 'Order Placed',
      createdAt: Date.now(),
    },
  };

  const [currentStep, setCurrentStep] = useState(0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* SUCCESS BANNER */}
      <View style={styles.successCard}>
        <Text style={styles.successBadge}>✓ Success</Text>
        <Text style={styles.successTitle}>Order Confirmed!</Text>
        <Text style={styles.successSubtitle}>
          Your errand request has been transmitted to dispatch.
        </Text>
      </View>

      {/* DIGITAL RECEIPT */}
      <View style={styles.card} testID="digital-receipt">
        <Text style={styles.cardTitle}>🧾 Digital Receipt</Text>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Order ID:</Text>
          <Text style={styles.receiptVal} testID="order-id-text">
            {finalOrder.orderId}
          </Text>
        </View>

        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Services:</Text>
          <Text style={styles.receiptVal}>{finalOrder.services.join(' / ')}</Text>
        </View>

        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Payment Method:</Text>
          <Text style={styles.receiptVal}>{finalOrder.paymentMethod}</Text>
        </View>

        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Base Delivery Fee:</Text>
          <Text style={styles.receiptVal}>₱{finalOrder.baseFee}.00</Text>
        </View>

        <View style={styles.receiptRow}>
          <Text style={styles.receiptLabel}>Distance Fee:</Text>
          <Text style={styles.receiptVal}>₱{finalOrder.distanceFee}.00</Text>
        </View>

        {finalOrder.commission > 0 && (
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Service Commission:</Text>
            <Text style={styles.receiptVal}>₱{finalOrder.commission}.00</Text>
          </View>
        )}

        <View style={[styles.receiptRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Amount Paid/Due:</Text>
          <Text style={styles.totalVal} testID="grand-total-text">
            ₱{finalOrder.grandTotal.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* TRACKING STEPPER */}
      <View style={styles.card} testID="tracking-stepper">
        <Text style={styles.cardTitle}>🛵 Order Tracking Status</Text>
        <View style={styles.stepperContainer}>
          {TRACKING_STEPS.map((step, idx) => {
            const isCompleted = idx <= currentStep;
            return (
              <View key={idx} style={styles.stepRow} testID={`tracking-step-${idx}`}>
                <View
                  style={[
                    styles.stepCircle,
                    isCompleted && styles.stepCircleCompleted,
                  ]}
                >
                  <Text style={[styles.stepNumber, isCompleted && styles.stepNumberCompleted]}>
                    {isCompleted ? '✓' : idx + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepText,
                    isCompleted && styles.stepTextCompleted,
                  ]}
                >
                  {step}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* MAP PREVIEW */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Live Rider Location Map</Text>
        <View style={styles.mapWrapper}>
          <MapView
            testID="confirmation-map-view"
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
              testID="rider-marker"
              coordinate={{ latitude: 6.671, longitude: 124.6644 }}
              title="Rider Assigned Location"
            />
          </MapView>
        </View>
      </View>

      <TouchableOpacity
        testID="back-to-dashboard-button"
        style={styles.homeBtn}
        onPress={() => navigation.navigate('CustomerPortal', { user })}
      >
        <Text style={styles.homeBtnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8', padding: 20 },
  successCard: { backgroundColor: '#D1FAE5', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0' },
  successBadge: { backgroundColor: '#10B981', color: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, fontWeight: 'bold', fontSize: 12, marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#065F46', marginBottom: 4 },
  successSubtitle: { fontSize: 13, color: '#047857', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  receiptLabel: { fontSize: 14, color: '#6B7280' },
  receiptVal: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 10, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#F62459' },
  totalVal: { fontSize: 18, fontWeight: 'bold', color: '#F62459' },
  stepperContainer: { marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  stepCircleCompleted: { backgroundColor: '#10B981' },
  stepNumber: { fontSize: 12, fontWeight: 'bold', color: '#6B7280' },
  stepNumberCompleted: { color: '#FFFFFF' },
  stepText: { fontSize: 14, color: '#9CA3AF' },
  stepTextCompleted: { color: '#1F2937', fontWeight: '600' },
  mapWrapper: { height: 160, borderRadius: 8, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
  homeBtn: { backgroundColor: '#F62459', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  homeBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});
