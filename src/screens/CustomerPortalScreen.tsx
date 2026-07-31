import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { database } from '../firebase/config';
import { saveCustomerLocation } from '../firebase/location';
import { ref, onValue, push, set } from 'firebase/database';
import { API_BASE_URL } from '../config/api';

const PINK = '#F62459';
const PINK_DARK = '#C41B47';
const PINK_LIGHT = '#FFEEF3';
const CHARCOAL = '#1F2937';

const RECOMENDED_MERCHANTS = [
  { id: '1', name: 'SM Supermarket', category: 'Grocery & Fresh', rating: '4.9 ★', estTime: '20-30 mins', icon: '🛒' },
  { id: '2', name: 'Mercury Drug', category: 'Pharmacy & Medical', rating: '4.8 ★', estTime: '15-25 mins', icon: '💊' },
  { id: '3', name: 'Jollibee Tacurong', category: 'Fast Food & Snacks', rating: '4.9 ★', estTime: '20-35 mins', icon: '🍔' },
  { id: '4', name: 'Robinsons Supermarket', category: 'Department & Grocery', rating: '4.7 ★', estTime: '25-40 mins', icon: '🛍️' },
  { id: '5', name: 'Watsons Pharmacy', category: 'Beauty & Health', rating: '4.8 ★', estTime: '15-30 mins', icon: '💄' },
  { id: '6', name: 'Julie\'s Bakeshop', category: 'Bakery & Bread', rating: '4.9 ★', estTime: '10-20 mins', icon: '🍞' },
];

export default function CustomerPortalScreen({ route, navigation }: any) {
  const user = route.params?.user || { id: '1', username: 'customer', firstName: 'Customer', lastName: 'User' };
  
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'track' | 'chat' | 'account'>('home');
  const [dbOrders, setDbOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Realtime Status State
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [riderLocation, setRiderLocation] = useState<{ latitude: number; longitude: number }>({
    latitude: 6.671,
    longitude: 124.6644,
  });

  // Fetch Orders from MariaDB `errand_system_db` REST API
  const fetchCustomerOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/pabili/customer/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setDbOrders(data.orders || []);
        if (data.orders && data.orders.length > 0) {
          setActiveOrder(data.orders[0]);
        }
      }
    } catch (err) {
      console.error('[REST API] Error fetching Pabili orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchCustomerOrders();

    // 1. Listen for Realtime Chat Messages from Firebase
    const chatRef = ref(database, `chats/${user.id}`);
    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMessages(Object.values(data));
      }
    });

    // 2. Transmit Customer Live GPS Location to Firebase Realtime Database
    saveCustomerLocation(user.id, 6.671, 124.6644, 'Tacurong City Center');
    const gpsInterval = setInterval(() => {
      const currentLat = 6.671 + (Math.random() * 0.002 - 0.001);
      const currentLng = 124.6644 + (Math.random() * 0.002 - 0.001);
      saveCustomerLocation(user.id, currentLat, currentLng, 'Tacurong City Center');
    }, 12000);

    return () => {
      unsubscribeChat();
      clearInterval(gpsInterval);
    };
  }, [user.id]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const chatRef = ref(database, `chats/${user.id}`);
    const newMsgRef = push(chatRef);
    set(newMsgRef, {
      sender: `${user.firstName} ${user.lastName}`.trim() || user.username,
      text: newMessage,
      timestamp: Date.now(),
    }).then(() => setNewMessage(''));
  };

  const renderStatusBadge = (status: string) => {
    let bg = '#FEF3C7';
    let text = '#92400E';
    if (status === 'DELIVERED') {
      bg = '#D1FAE5';
      text = '#065F46';
    } else if (status === 'EN ROUTE' || status === 'ASSIGNED') {
      bg = '#DBEAFE';
      text = '#1E40AF';
    } else if (status === 'PENDING') {
      bg = PINK_LIGHT;
      text = PINK_DARK;
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusText, { color: text }]}>{status || 'PENDING'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* APP TOP BAR */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greetingText}>Hello, {user.firstName || 'Customer'}! 👋</Text>
          <View style={styles.locationPill}>
            <Text style={styles.locationText}>📍 Tacurong City, Sultan Kudarat</Text>
          </View>
        </View>
      </View>

      {/* MAIN CONTENT AREA */}
      <View style={styles.mainContent}>
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            {/* HERO BANNER */}
            <View style={styles.heroCard}>
              <Text style={styles.heroTag}>SUGO ERRANDS</Text>
              <Text style={styles.heroTitle}>Pabili Personal Shopper</Text>
              <Text style={styles.heroSubtitle}>
                We buy groceries, medicines, food & retail items across Tacurong City and deliver to your doorstep!
              </Text>
              <TouchableOpacity
                testID="create-order-button"
                style={styles.heroBtn}
                onPress={() => navigation.navigate('ServiceList', { user })}
              >
                <Text style={styles.heroBtnText}>+ Create New Pabili Request</Text>
              </TouchableOpacity>
            </View>

            {/* RECENT ACTIVE ORDER CARD */}
            {activeOrder ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>🛵 Latest Active Order</Text>
                  {renderStatusBadge(activeOrder.status)}
                </View>
                <Text style={styles.orderIdText}>Order #{activeOrder.orderId}</Text>
                <Text style={styles.orderDetailText}>Stores: {activeOrder.categories}</Text>
                <Text style={styles.orderDetailText}>Total Amount: ₱{parseFloat(activeOrder.grandTotal).toFixed(2)}</Text>
                
                <TouchableOpacity
                  style={styles.trackOrderBtn}
                  onPress={() => setActiveTab('track')}
                >
                  <Text style={styles.trackOrderBtnText}>View Live Map & Tracking ➔</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* RECOMMENDED STORES */}
            <Text style={styles.sectionHeader}>🏬 Recommended Shopping Spots</Text>
            <View style={styles.merchantGrid}>
              {RECOMENDED_MERCHANTS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.merchantCard}
                  onPress={() => navigation.navigate('ServiceList', { user })}
                >
                  <Text style={styles.merchantIcon}>{item.icon}</Text>
                  <Text style={styles.merchantName}>{item.name}</Text>
                  <Text style={styles.merchantCategory}>{item.category}</Text>
                  <View style={styles.merchantMeta}>
                    <Text style={styles.merchantRating}>{item.rating}</Text>
                    <Text style={styles.merchantTime}>{item.estTime}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* TAB 2: MY ORDERS (Fetched from MariaDB errand_system_db via REST API) */}
        {activeTab === 'orders' && (
          <View style={{ flex: 1 }}>
            <View style={styles.ordersHeaderRow}>
              <Text style={styles.sectionHeader}>📋 My Pabili Order History</Text>
              <TouchableOpacity onPress={fetchCustomerOrders} style={styles.refreshBtn}>
                <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>

            {loadingOrders ? (
              <ActivityIndicator size="large" color={PINK} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={dbOrders}
                keyExtractor={(item) => String(item.id || item.orderId)}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No Pabili orders found in MariaDB errand_system_db database.</Text>
                    <TouchableOpacity
                      style={styles.heroBtn}
                      onPress={() => navigation.navigate('ServiceList', { user })}
                    >
                      <Text style={styles.heroBtnText}>Place Your First Pabili Order</Text>
                    </TouchableOpacity>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Order #{item.orderId}</Text>
                      {renderStatusBadge(item.status)}
                    </View>
                    <Text style={styles.orderDetailText}><Text style={{ fontWeight: 'bold' }}>Categories:</Text> {item.categories}</Text>
                    <Text style={styles.orderDetailText}><Text style={{ fontWeight: 'bold' }}>Total Amount:</Text> ₱{parseFloat(item.grandTotal).toFixed(2)} ({item.paymentMethod})</Text>
                    <Text style={styles.orderDetailText}><Text style={{ fontWeight: 'bold' }}>Address:</Text> {item.deliveryAddress || 'Tacurong City'}</Text>
                    <Text style={styles.orderDateText}>Date: {new Date(item.createdAt).toLocaleString()}</Text>
                  </View>
                )}
              />
            )}
          </View>
        )}

        {/* TAB 3: LIVE TRACKING */}
        {activeTab === 'track' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.sectionHeader}>🛵 Live Order Tracking</Text>
            
            {activeOrder ? (
              <>
                <View style={styles.mapWrapper}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: parseFloat(activeOrder.latitude) || 6.671,
                      longitude: parseFloat(activeOrder.longitude) || 124.6644,
                      latitudeDelta: 0.015,
                      longitudeDelta: 0.015,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: parseFloat(activeOrder.latitude) || 6.671,
                        longitude: parseFloat(activeOrder.longitude) || 124.6644,
                      }}
                      title="Your Location"
                      description={activeOrder.deliveryAddress || 'Tacurong City'}
                    />
                    <Marker
                      coordinate={riderLocation}
                      title="Assigned Rider"
                      description="En Route with your Pabili Items"
                      pinColor="blue"
                    />
                  </MapView>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Order #{activeOrder.orderId}</Text>
                    {renderStatusBadge(activeOrder.status)}
                  </View>
                  <Text style={styles.statusDetailText}>
                    Stores: <Text style={{ fontWeight: 'bold' }}>{activeOrder.categories}</Text>
                  </Text>
                  <Text style={styles.statusDetailText}>
                    Total Amount: <Text style={{ fontWeight: 'bold', color: PINK }}>₱{parseFloat(activeOrder.grandTotal).toFixed(2)}</Text>
                  </Text>
                  <Text style={styles.statusDetailText}>
                    Assigned Rider: <Text style={{ fontWeight: 'bold' }}>{activeOrder.riderName || 'Assigning Rider...'}</Text>
                  </Text>
                  <Text style={styles.statusDetailText}>
                    Destination: <Text style={{ fontWeight: 'bold' }}>{activeOrder.deliveryAddress || 'Tacurong City'}</Text>
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>You have no active Pabili orders to track.</Text>
                <TouchableOpacity
                  style={styles.heroBtn}
                  onPress={() => navigation.navigate('ServiceList', { user })}
                >
                  <Text style={styles.heroBtnText}>+ Create New Pabili Request</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {/* TAB 4: LIVE CHAT */}
        {activeTab === 'chat' && (
          <View style={styles.chatContainer}>
            <Text style={styles.sectionHeader}>💬 Dispatcher & Support Live Chat</Text>
            <ScrollView style={styles.chatBox}>
              {messages.length === 0 ? (
                <Text style={styles.emptyChatText}>No messages yet. Type below to chat with dispatcher!</Text>
              ) : (
                messages.map((msg, idx) => (
                  <View key={idx} style={styles.messageRow}>
                    <Text style={styles.messageSender}>{msg.sender}:</Text>
                    <Text style={styles.messageText}>{msg.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type your message to dispatcher..."
              />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 5: ACCOUNT */}
        {activeTab === 'account' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.sectionHeader}>👤 Account & Profile</Text>
            <View style={styles.card}>
              <Text style={styles.profileName}>{user.firstName} {user.lastName}</Text>
              <Text style={styles.profileText}>Username: @{user.username}</Text>
              <Text style={styles.profileText}>Email: {user.email || 'customer@sugo.ph'}</Text>
              <Text style={styles.profileText}>Phone: {user.phone || '0917-000-0000'}</Text>
              <Text style={styles.profileText}>Role: CUSTOMER (Pabili Shopper)</Text>
              <Text style={styles.profileText}>Default Address: Tacurong City, Sultan Kudarat</Text>
            </View>

            <TouchableOpacity
              style={styles.locationManageBtn}
              onPress={() => navigation.navigate('CustomerLocation', { user })}
            >
              <Text style={styles.locationManageBtnText}>📍 Manage Saved Delivery Locations & Pinpoints</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* ONGOING ERRAND SHORTCUT / FLOATING ACTION BUTTON */}
      {activeOrder && ['PENDING', 'ACCEPTED', 'Assigned', 'In Progress'].includes(activeOrder.status) && (
        <TouchableOpacity
          testID="ongoing-errand-shortcut"
          style={styles.fab}
          onPress={() => {
            if (activeOrder.status === 'PENDING') {
              navigation.navigate('WaitingForDispatcher', { user, orderId: activeOrder.orderId });
            } else {
              navigation.navigate('CustomerChat', { user, orderId: activeOrder.orderId });
            }
          }}
        >
          <Text style={styles.fabIcon}>💬</Text>
          <Text style={styles.fabText}>
            {activeOrder.status === 'PENDING' ? 'Waiting for Dispatcher...' : 'Ongoing Chat'}
          </Text>
        </TouchableOpacity>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
          <Text style={[styles.navIcon, activeTab === 'home' && styles.navIconActive]}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 'home' && styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('orders'); fetchCustomerOrders(); }}>
          <Text style={[styles.navIcon, activeTab === 'orders' && styles.navIconActive]}>📋</Text>
          <Text style={[styles.navLabel, activeTab === 'orders' && styles.navLabelActive]}>My Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('track')}>
          <Text style={[styles.navIcon, activeTab === 'track' && styles.navIconActive]}>🛵</Text>
          <Text style={[styles.navLabel, activeTab === 'track' && styles.navLabelActive]}>Track</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('account')}>
          <Text style={[styles.navIcon, activeTab === 'account' && styles.navIconActive]}>👤</Text>
          <Text style={[styles.navLabel, activeTab === 'account' && styles.navLabelActive]}>Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  topBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greetingText: { fontSize: 20, fontWeight: 'bold', color: CHARCOAL },
  locationPill: { marginTop: 2 },
  locationText: { fontSize: 12, color: PINK_DARK, fontWeight: '600' },
  chatIconButton: { backgroundColor: PINK_LIGHT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chatIconText: { color: PINK_DARK, fontWeight: 'bold', fontSize: 13 },
  mainContent: { flex: 1, padding: 16 },
  heroCard: {
    backgroundColor: CHARCOAL,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroTag: { color: PINK, fontWeight: 'bold', fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  heroTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  heroSubtitle: { color: '#9CA3AF', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  heroBtn: { backgroundColor: PINK, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  heroBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: CHARCOAL },
  orderIdText: { fontSize: 14, fontWeight: 'bold', color: PINK, marginBottom: 4 },
  orderDetailText: { fontSize: 13, color: '#374151', marginBottom: 4 },
  orderDateText: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  trackOrderBtn: { backgroundColor: PINK_LIGHT, padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
  trackOrderBtnText: { color: PINK_DARK, fontWeight: 'bold', fontSize: 13 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: CHARCOAL, marginBottom: 12 },
  merchantGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  merchantCard: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  merchantIcon: { fontSize: 24, marginBottom: 6 },
  merchantName: { fontSize: 14, fontWeight: 'bold', color: CHARCOAL },
  merchantCategory: { fontSize: 11, color: '#6B7280', marginBottom: 8 },
  merchantMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  merchantRating: { fontSize: 11, fontWeight: 'bold', color: '#D97706' },
  merchantTime: { fontSize: 11, color: '#9CA3AF' },
  ordersHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  refreshBtn: { backgroundColor: PINK_LIGHT, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  refreshBtnText: { color: PINK_DARK, fontWeight: 'bold', fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { color: '#6B7280', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  mapWrapper: { height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  map: { width: '100%', height: '100%' },
  statusDetailText: { fontSize: 14, color: CHARCOAL, marginBottom: 6 },
  chatContainer: { flex: 1 },
  chatBox: { flex: 1, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  emptyChatText: { color: '#9CA3AF', textAlign: 'center', marginTop: 20 },
  messageRow: { marginBottom: 10, backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8 },
  messageSender: { fontWeight: 'bold', color: PINK, fontSize: 12, marginBottom: 2 },
  messageText: { color: CHARCOAL, fontSize: 14 },
  inputRow: { flexDirection: 'row' },
  chatInput: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, marginRight: 8 },
  sendBtn: { backgroundColor: PINK, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  profileName: { fontSize: 20, fontWeight: 'bold', color: CHARCOAL, marginBottom: 8 },
  profileText: { fontSize: 14, color: '#4B5563', marginBottom: 6 },
  locationManageBtn: { backgroundColor: '#FFEEF3', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: PINK },
  locationManageBtnText: { color: PINK_DARK, fontWeight: 'bold', fontSize: 14 },
  logoutBtn: { backgroundColor: '#EF4444', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  logoutBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 10,
    justifyContent: 'space-around',
  },
  navItem: { alignItems: 'center' },
  navIcon: { fontSize: 20, color: '#9CA3AF' },
  navIconActive: { color: PINK },
  navLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  navLabelActive: { color: PINK, fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: PINK,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 5,
    elevation: 6,
  },
  fabIcon: { fontSize: 18, marginRight: 8 },
  fabText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});
