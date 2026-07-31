import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { RootStackScreenProps } from '../navigation/types';

export const SERVICE_TYPES = [
  {
    id: 'Pabili',
    name: 'Pabili Service',
    tagline: 'Personal Shopper',
    desc: 'Buy grocery, food, medicines, and retail items from any store in Tacurong City',
  },
];

export default function ServiceListScreen({ route, navigation }: RootStackScreenProps<'ServiceList'>) {
  const { user } = route.params || {};
  const [selectedServices, setSelectedServices] = useState<string[]>(['Pabili']);

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices([]);
    } else {
      setSelectedServices([serviceId]);
    }
  };

  const handleContinue = () => {
    if (selectedServices.length === 0) return;
    navigation.navigate('OrderForm', { user, selectedServices });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Select Errand Service</Text>
      <Text style={styles.subTitle}>Select Pabili Personal Shopper service to build your order</Text>

      <ScrollView style={styles.scrollList}>
        {SERVICE_TYPES.map((service) => {
          const isSelected = selectedServices.includes(service.id);
          return (
            <TouchableOpacity
              key={service.id}
              testID={`service-card-${service.id}`}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => toggleService(service.id)}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                  {service.name}
                </Text>
                {isSelected && <Text style={styles.checkBadge} testID={`selected-badge-${service.id}`}>✓ Selected</Text>}
              </View>
              <Text style={styles.tagline}>{service.tagline}</Text>
              <Text style={styles.desc}>{service.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedServices.length > 0 && (
        <View style={styles.summaryBar} testID="summary-bar">
          <View>
            <Text style={styles.summaryText}>
              Selected: {selectedServices.join(', ')}
            </Text>
            <Text style={styles.summaryCount}>
              Pabili Shopper Service Active
            </Text>
          </View>
          <TouchableOpacity
            testID="continue-button"
            style={styles.continueBtn}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>Continue to Order Form</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  subTitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  scrollList: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cardSelected: {
    borderColor: '#F62459',
    backgroundColor: '#FFEEF3',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  cardTitleSelected: { color: '#F62459' },
  checkBadge: { backgroundColor: '#F62459', color: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  tagline: { fontSize: 14, color: '#F62459', fontWeight: '600', marginBottom: 8 },
  desc: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  summaryBar: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  summaryText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  summaryCount: { color: '#9CA3AF', fontSize: 12 },
  continueBtn: { backgroundColor: '#F62459', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  continueBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});
