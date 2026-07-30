import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { database } from '../firebase/config';
import { ref, onValue, set, push } from 'firebase/database';

export default function CustomerPortalScreen({ route, navigation }: any) {
  const { user } = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [orderStatus, setOrderStatus] = useState('No active orders');

  useEffect(() => {
    // 1. Listen for Order Updates
    const orderRef = ref(database, `orders/${user.id}`);
    const unsubscribeOrder = onValue(orderRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOrderStatus(data.status);
      }
    });

    // 2. Listen for Chat Messages
    const chatRef = ref(database, `chats/${user.id}`);
    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.values(data);
        setMessages(msgs);
      }
    });

    // 3. Simulate GPS Location sending every 10 seconds
    const gpsInterval = setInterval(() => {
      const locRef = ref(database, `locations/${user.id}`);
      set(locRef, {
        lat: 6.671 + (Math.random() * 0.01),
        lng: 124.6644 + (Math.random() * 0.01),
        timestamp: Date.now()
      });
    }, 10000);

    return () => {
      unsubscribeOrder();
      unsubscribeChat();
      clearInterval(gpsInterval);
    };
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const chatRef = ref(database, `chats/${user.id}`);
    const newMsgRef = push(chatRef);
    set(newMsgRef, {
      sender: user.username,
      text: newMessage,
      timestamp: Date.now()
    }).then(() => setNewMessage(''));
  };

  const createTestOrder = () => {
    const orderRef = ref(database, `orders/${user.id}`);
    set(orderRef, {
      status: 'Pending',
      items: 'Test Errand',
      timestamp: Date.now()
    }).then(() => Alert.alert('Success', 'Test order created!'));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Welcome, {user.firstName}!</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Order Status:</Text>
        <Text style={styles.statusText}>{orderStatus}</Text>
        <TouchableOpacity 
          testID="create-order-button"
          style={styles.button} 
          onPress={() => navigation.navigate('ServiceList', { user })}
        >
          <Text style={styles.buttonText}>Create New Order</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chatSection}>
        <Text style={styles.cardTitle}>Live Chat</Text>
        <ScrollView style={styles.chatBox}>
          {messages.map((msg, idx) => (
            <View key={idx} style={styles.messageRow}>
              <Text style={styles.messageSender}>{msg.sender}:</Text>
              <Text style={styles.messageText}>{msg.text}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput 
            style={styles.input} 
            value={newMessage} 
            onChangeText={setNewMessage}
            placeholder="Type a message..." 
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#9CA3AF' }]} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F8F8F8' },
  header: { fontSize: 22, fontWeight: 'bold', color: '#F62459', marginBottom: 20 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 5 },
  statusText: { fontSize: 18, color: '#F62459', fontWeight: 'bold', marginBottom: 15 },
  button: { backgroundColor: '#F62459', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  chatSection: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20 },
  chatBox: { flex: 1, marginBottom: 10 },
  messageRow: { flexDirection: 'row', marginBottom: 5 },
  messageSender: { fontWeight: 'bold', marginRight: 5, color: '#374151' },
  messageText: { color: '#1F2937' },
  inputRow: { flexDirection: 'row' },
  input: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginRight: 10 },
  sendBtn: { backgroundColor: '#F62459', padding: 12, borderRadius: 8, justifyContent: 'center' }
});
