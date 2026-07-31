import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { ref, push, onValue } from 'firebase/database';
import { database } from '../firebase/config';
import { RootStackScreenProps } from '../navigation/types';
import { API_BASE_URL } from '../config/api';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  role: 'customer' | 'dispatcher';
  text: string;
  timestamp: number;
}

interface StorePinpoint {
  id?: number;
  storeName: string;
  latitude: number;
  longitude: number;
}

export default function CustomerChatScreen({
  route,
  navigation,
}: RootStackScreenProps<'CustomerChat'>) {
  const { user, orderId } = route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Customer', lastName: 'User' },
    orderId: 'PABILI-123456',
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [dispatcherName, setDispatcherName] = useState<string>('Dispatcher');

  // Store Pinpoints Modal state
  const [pinpoints, setPinpoints] = useState<StorePinpoint[]>([]);
  const [showMapModal, setShowMapModal] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const fetchPinpoints = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/pabili/${orderId}/pinpoints`);
      if (response.ok) {
        const data = await response.json();
        const raw = data.pinpoints || [];
        const sanitized = raw.map((p: any) => ({
          id: p.id,
          storeName: p.storeName || 'Store',
          latitude: parseFloat(String(p.latitude)) || 6.671,
          longitude: parseFloat(String(p.longitude)) || 124.6644,
        }));
        setPinpoints(sanitized);
      }
    } catch (e) {
      console.warn('Failed to fetch store pinpoints:', e);
    }
  };

  useEffect(() => {
    // 1. Subscribe to order metadata (dispatcher info)
    const metaRef = ref(database, `chats/${orderId}/meta`);
    const unsubMeta = onValue(metaRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.dispatcherName) {
        setDispatcherName(val.dispatcherName);
      }
    });

    // 2. Subscribe to messages in real-time
    const messagesRef = ref(database, `chats/${orderId}/messages`);
    const unsubMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed: ChatMessage[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        parsed.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(parsed);
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    fetchPinpoints();

    return () => {
      unsubMeta();
      unsubMessages();
    };
  }, [orderId]);

  const handleSendMessage = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const messagesRef = ref(database, `chats/${orderId}/messages`);
    push(messagesRef, {
      senderId: String(user.id),
      senderName: user.firstName || 'Customer',
      role: 'customer',
      text: trimmed,
      timestamp: Date.now(),
    });

    setInputText('');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 25}
    >
      {/* CHAT HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Order #{orderId}</Text>
          <Text style={styles.headerSubtitle}>Live Errand Support ({dispatcherName})</Text>
        </View>

        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => {
            fetchPinpoints();
            setShowMapModal(true);
          }}
        >
          <Text style={styles.mapBtnText}>📍 View Map ({pinpoints.length})</Text>
        </TouchableOpacity>
      </View>

      {/* MESSAGES LIST */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F62459" />
          <Text style={styles.loadingText}>Connecting to live chat...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No messages yet.</Text>
          <Text style={styles.emptySubtext}>
            Type a message below to discuss item details with your dispatcher.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isCustomer = item.role === 'customer';
            return (
              <View
                style={[
                  styles.messageBubbleContainer,
                  isCustomer ? styles.customerBubbleAlign : styles.dispatcherBubbleAlign,
                ]}
              >
                <Text style={styles.senderLabel}>
                  {isCustomer ? 'You' : item.senderName || 'Dispatcher'}
                </Text>
                <View
                  style={[
                    styles.bubble,
                    isCustomer ? styles.customerBubble : styles.dispatcherBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isCustomer ? styles.customerText : styles.dispatcherText,
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
                <Text style={styles.timeLabel}>{formatTime(item.timestamp)}</Text>
              </View>
            );
          }}
        />
      )}

      {/* INPUT BAR */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type your item request or message..."
          placeholderTextColor="#9CA3AF"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity
          testID="send-message-button"
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* STORE PINPOINTS MAP MODAL */}
      <Modal visible={showMapModal} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📍 Dispatcher Store Pinpoints</Text>
            <TouchableOpacity onPress={() => setShowMapModal(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalMapWrapper}>
            {showMapModal && (
              <MapView
                style={styles.modalMap}
                initialRegion={{
                  latitude: (pinpoints[0] && typeof pinpoints[0].latitude === 'number' && !isNaN(pinpoints[0].latitude)) ? pinpoints[0].latitude : 6.671,
                  longitude: (pinpoints[0] && typeof pinpoints[0].longitude === 'number' && !isNaN(pinpoints[0].longitude)) ? pinpoints[0].longitude : 124.6644,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                {pinpoints.map((pin, idx) => {
                  const lat = typeof pin.latitude === 'number' ? pin.latitude : parseFloat(String(pin.latitude));
                  const lng = typeof pin.longitude === 'number' ? pin.longitude : parseFloat(String(pin.longitude));
                  if (isNaN(lat) || isNaN(lng)) return null;

                  return (
                    <Marker
                      key={idx}
                      coordinate={{ latitude: lat, longitude: lng }}
                      title={`Store #${idx + 1}: ${pin.storeName || 'Store'}`}
                      description="Pinpointed by Dispatcher"
                      pinColor="red"
                    />
                  );
                })}
              </MapView>
            )}
          </View>

          <View style={styles.pinListContainer}>
            <Text style={styles.pinListHeader}>Pinpointed Shopping Stores ({pinpoints.length}):</Text>
            {pinpoints.length === 0 ? (
              <Text style={styles.noPinsText}>Dispatcher has not set specific store pinpoints yet.</Text>
            ) : (
              pinpoints.map((pin, idx) => (
                <View key={idx} style={styles.pinCard}>
                  <Text style={styles.pinCardTitle}>📍 Store #{idx + 1}: {pin.storeName}</Text>
                  <Text style={styles.pinCardCoords}>
                    Coordinates: {parseFloat(String(pin.latitude)).toFixed(4)}, {parseFloat(String(pin.longitude)).toFixed(4)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  headerSubtitle: { color: '#93C5FD', fontSize: 12, marginTop: 2 },
  mapBtn: { backgroundColor: '#F62459', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  mapBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { marginTop: 8, color: '#4B5563', fontSize: 14 },
  emptyText: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
  emptySubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  messagesList: { padding: 16, paddingBottom: 20 },
  messageBubbleContainer: { marginBottom: 12, maxWidth: '80%' },
  customerBubbleAlign: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  dispatcherBubbleAlign: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 2 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  customerBubble: { backgroundColor: '#F62459', borderBottomRightRadius: 2 },
  dispatcherBubble: { backgroundColor: '#1E3A5F', borderBottomLeftRadius: 2 },
  messageText: { fontSize: 15, lineHeight: 20 },
  customerText: { color: '#FFFFFF' },
  dispatcherText: { color: '#FFFFFF' },
  timeLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    color: '#1F2937',
  },
  sendBtn: {
    backgroundColor: '#F62459',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: '#FCA5A5' },
  sendBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 30 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  closeBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  modalMapWrapper: { height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  modalMap: { width: '100%', height: '100%' },
  pinListContainer: { flex: 1 },
  pinListHeader: { fontSize: 15, fontWeight: 'bold', color: '#374151', marginBottom: 10 },
  noPinsText: { color: '#9CA3AF', fontStyle: 'italic', fontSize: 13 },
  pinCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  pinCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  pinCardCoords: { fontSize: 12, color: '#6B7280', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});

