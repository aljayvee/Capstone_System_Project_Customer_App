import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { RootStackScreenProps } from '../navigation/types';
import { API_BASE_URL } from '../config/api';

export default function WaitingForDispatcherScreen({
  route,
  navigation,
}: RootStackScreenProps<'WaitingForDispatcher'>) {
  const { user, orderId } = route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Customer', lastName: 'User' },
    orderId: 'PABILI-123456',
  };

  const [orderStatus, setOrderStatus] = useState<string>('PENDING');
  const [dispatcherName, setDispatcherName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkOrderStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/orders/pabili/customer/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          const currentOrder = (data.orders || []).find((o: any) => o.orderId === orderId);
          if (currentOrder && isMounted) {
            setOrderStatus(currentOrder.status);
            if (currentOrder.dispatcherName) {
              setDispatcherName(currentOrder.dispatcherName);
            }
          }
        }
      } catch (err) {
        console.error('[WaitingScreen] Error checking order status:', err);
      }
    };

    checkOrderStatus();
    const interval = setInterval(checkOrderStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user.id, orderId]);

  const isAccepted = orderStatus === 'ACCEPTED' || orderStatus === 'Assigned' || orderStatus === 'In Progress';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* STATUS BANNER */}
      <View style={[styles.statusCard, isAccepted && styles.acceptedCard]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>{isAccepted ? '💬' : '🛵'}</Text>
        </View>
        <Text style={[styles.statusTitle, isAccepted && styles.acceptedTitle]}>
          {isAccepted ? 'Dispatcher Ready!' : 'Please wait for the dispatcher to assist you.'}
        </Text>
        <Text style={[styles.statusSubtitle, isAccepted && styles.acceptedSubtitle]}>
          {isAccepted
            ? `${dispatcherName || 'A dispatcher'} has accepted your order request and is ready to assist you.`
            : 'Your Pabili errand order has been submitted to dispatch. A dispatcher will review your request shortly.'}
        </Text>
        {!isAccepted && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#F62459" />
            <Text style={styles.loadingText}>Waiting for dispatcher to accept...</Text>
          </View>
        )}
      </View>

      {/* ORDER SUMMARY BANNER */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Order Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Order ID:</Text>
          <Text style={styles.infoValBold}>{orderId}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Service:</Text>
          <Text style={styles.infoVal}>Pabili (Personal Shopper)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Current Status:</Text>
          <View
            style={[
              styles.statusBadge,
              isAccepted ? styles.badgeAccepted : styles.badgePending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isAccepted ? styles.badgeTextAccepted : styles.badgeTextPending,
              ]}
            >
              {orderStatus}
            </Text>
          </View>
        </View>
      </View>

      {/* ACTION BUTTONS */}
      <TouchableOpacity
        testID="open-chat-button"
        style={styles.chatBtn}
        onPress={() => navigation.navigate('CustomerChat', { user, orderId })}
      >
        <Text style={styles.chatBtnText}>💬 Review Order & Live Chat</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="back-to-dashboard-button"
        style={styles.secondaryBtn}
        onPress={() => navigation.navigate('CustomerPortal', { user })}
      >
        <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8', padding: 20 },
  statusCard: {
    backgroundColor: '#FFF1F2',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  acceptedCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconEmoji: { fontSize: 28 },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9F1239',
    textAlign: 'center',
    marginBottom: 8,
  },
  acceptedTitle: {
    color: '#065F46',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#BE123C',
    textAlign: 'center',
    lineHeight: 20,
  },
  acceptedSubtitle: {
    color: '#047857',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#9F1239',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoVal: { fontSize: 14, color: '#1F2937' },
  infoValBold: { fontSize: 14, fontWeight: 'bold', color: '#1E3A5F' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeAccepted: { backgroundColor: '#D1FAE5' },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold' },
  badgeTextPending: { color: '#92400E' },
  badgeTextAccepted: { color: '#065F46' },
  chatBtn: {
    backgroundColor: '#1E3A5F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  chatBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryBtnText: { color: '#4B5563', fontWeight: '600', fontSize: 15 },
});
