import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { RootStackScreenProps } from '../navigation/types';

export const SERVICE_TYPES = [
  {
    id: 'Pabili',
    name: 'Pabili',
    tagline: 'Personal Shopper',
    desc: 'Buy grocery, food, medicines, and retail items from any store',
  },
  {
    id: 'Padala',
    name: 'Padala',
    tagline: 'Parcel & Courier',
    desc: 'Send or pick up documents, parcels, and items across Tacurong',
  },
  {
    id: 'Bills Payment',
    name: 'Bills Payment',
    tagline: 'Bills & Remittance',
    desc: 'Pay utility bills, tuition, government, or send cash remittance',
  },
];

export default function ServiceListScreen({ route, navigation }: RootStackScreenProps<'ServiceList'>) {
  const { user } = route.params || {};
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleService = (serviceId: string) => {
    setErrorMsg(null);
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((s) => s !== serviceId));
    } else {
      if (selectedServices.length >= 2) {
        const msg = 'You can select up to 2 services max.';
        setErrorMsg(msg);
        Alert.alert('Selection Limit', msg);
        return;
      }
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

  const handleContinue = () => {
    if (selectedServices.length === 0) return;
    navigation.navigate('OrderForm', { user, selectedServices });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Select Errand Services</Text>
      <Text style={styles.subTitle}>Choose up to 2 services for your order</Text>

      {errorMsg ? (
        <View style={styles.errorBanner} testID="error-banner">
          <Text style={styles.errorText} testID="selection-limit-error">
            {errorMsg}
          </Text>
        </View>
      ) : null}

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
              Selected: {selectedServices.join(' + ')}
            </Text>
            <Text style={styles.summaryCount}>
              {selectedServices.length} / 2 services selected
            </Text>
          </View>
          <TouchableOpacity
            testID="continue-button"
            style={styles.continueBtn}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
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
  errorBanner: { backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: '#DC2626', fontWeight: '600', textAlign: 'center' },
  scrollList: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cardSelected: {
    borderColor: '#F62459',
    backgroundColor: '#FFEEF3',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  cardTitleSelected: { color: '#F62459' },
  checkBadge: { backgroundColor: '#F62459', color: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  tagline: { fontSize: 13, color: '#F62459', fontWeight: '600', marginBottom: 6 },
  desc: { fontSize: 14, color: '#4B5563' },
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
