import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';

import { ENDPOINTS } from '../config/api';

export default function RegisterScreen({ navigation }: any) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!formData.username || !formData.password || !formData.firstName || !formData.email) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role: 'CUSTOMER' }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Registration failed');
      }

      Alert.alert('Success', 'Account created successfully!');
      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      
      <TextInput style={styles.input} placeholder="First Name *" value={formData.firstName} onChangeText={(text) => setFormData({...formData, firstName: text})} />
      <TextInput style={styles.input} placeholder="Last Name" value={formData.lastName} onChangeText={(text) => setFormData({...formData, lastName: text})} />
      <TextInput style={styles.input} placeholder="Email *" keyboardType="email-address" value={formData.email} onChangeText={(text) => setFormData({...formData, email: text})} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={formData.phone} onChangeText={(text) => setFormData({...formData, phone: text})} />
      <TextInput style={styles.input} placeholder="Username *" value={formData.username} onChangeText={(text) => setFormData({...formData, username: text})} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password *" value={formData.password} onChangeText={(text) => setFormData({...formData, password: text})} secureTextEntry />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F8F8F8' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F62459', textAlign: 'center', marginBottom: 30 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  button: { backgroundColor: '#F62459', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkText: { color: '#F62459', textAlign: 'center', marginTop: 20, fontWeight: '600' }
});
