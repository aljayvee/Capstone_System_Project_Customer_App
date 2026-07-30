import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { RootStackScreenProps, OrderPayload } from '../navigation/types';

export const PABILI_CATEGORIES = [
  'Retail Store',
  'Restaurant',
  'Pharmacy',
  'Department Store',
  'Convenience Store',
  'Cafés',
  'Bakery',
  'Remittance',
  'Banks',
  'Food Stalls',
  'Frozen Goods',
  'Other',
];

export default function OrderFormScreen({ route, navigation }: RootStackScreenProps<'OrderForm'>) {
  const { user, selectedServices = [] } = route.params || {};

  // Pabili State
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [catItems, setCatItems] = useState<Record<string, string[]>>({});
  const [pabiliError, setPabiliError] = useState<string | null>(null);

  // Padala State
  const [padalaItem, setPadalaItem] = useState('');
  const [padalaSender, setPadalaSender] = useState('Current Location');
  const [padalaReceiver, setPadalaReceiver] = useState('');
  const [padalaReceiverPhone, setPadalaReceiverPhone] = useState('');

  // Bills State
  const [billsBiller, setBillsBiller] = useState('');
  const [billsAccountNo, setBillsAccountNo] = useState('');
  const [billsAmount, setBillsAmount] = useState('');

  // Form Validation State
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleCategory = (catName: string) => {
    setPabiliError(null);
    if (selectedCats.includes(catName)) {
      setSelectedCats(selectedCats.filter((c) => c !== catName));
    } else {
      if (selectedCats.length >= 3) {
        const msg = 'You can select up to 3 categories only.';
        setPabiliError(msg);
        Alert.alert('Category Limit', msg);
        return;
      }
      setSelectedCats([...selectedCats, catName]);
      if (!catItems[catName]) {
        setCatItems({ ...catItems, [catName]: [''] });
      }
    }
  };

  const handleAddItem = (catName: string) => {
    const current = catItems[catName] || [];
    setCatItems({
      ...catItems,
      [catName]: [...current, ''],
    });
  };

  const handleUpdateItem = (catName: string, index: number, text: string) => {
    const current = catItems[catName] || [];
    const updated = [...current];
    updated[index] = text;
    setCatItems({
      ...catItems,
      [catName]: updated,
    });
  };

  const handleRemoveItem = (catName: string, index: number) => {
    const current = catItems[catName] || [];
    const updated = current.filter((_, i) => i !== index);
    setCatItems({
      ...catItems,
      [catName]: updated,
    });
  };

  const validateAndSubmit = () => {
    setValidationError(null);

    const isPabili = selectedServices.includes('Pabili');
    const isPadala = selectedServices.includes('Padala');
    const isBills = selectedServices.includes('Bills Payment');

    if (isPabili) {
      if (selectedCats.length === 0) {
        setValidationError('Please select at least one Pabili category.');
        return;
      }
      for (const cat of selectedCats) {
        const items = catItems[cat] || [];
        const nonArrayOrEmpty = items.filter((i) => i.trim().length > 0);
        if (nonArrayOrEmpty.length === 0) {
          setValidationError(`Please add at least one item for ${cat}.`);
          return;
        }
      }
    }

    if (isPadala) {
      if (!padalaItem.trim()) {
        setValidationError('Please enter parcel/item description for Padala.');
        return;
      }
      if (!padalaReceiverPhone.trim()) {
        setValidationError('Please enter receiver phone number for Padala.');
        return;
      }
    }

    if (isBills) {
      if (!billsBiller.trim()) {
        setValidationError('Please enter the biller name for Bills Payment.');
        return;
      }
      if (!billsAccountNo.trim()) {
        setValidationError('Please enter the account/reference number.');
        return;
      }
      const numAmount = parseFloat(billsAmount);
      if (isNaN(numAmount) || numAmount <= 0) {
        setValidationError('Please enter a valid bill amount greater than 0.');
        return;
      }
    }

    const payload: OrderPayload = {
      selectedServices,
      pabiliCats: isPabili ? selectedCats : undefined,
      catItems: isPabili ? catItems : undefined,
      padalaInfo: isPadala
        ? {
            item: padalaItem,
            sender: padalaSender,
            receiver: padalaReceiver,
            receiverPhone: padalaReceiverPhone,
          }
        : undefined,
      billsInfo: isBills
        ? {
            biller: billsBiller,
            accountNo: billsAccountNo,
            amount: parseFloat(billsAmount) || 0,
          }
        : undefined,
    };

    navigation.navigate('Checkout', { user, orderPayload: payload });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.headerTitle}>Order Details</Text>
      <Text style={styles.subTitle}>
        Filling form for: {selectedServices.join(' & ')}
      </Text>

      {validationError ? (
        <View style={styles.errorBanner} testID="validation-error-banner">
          <Text style={styles.errorText} testID="validation-error-text">
            {validationError}
          </Text>
        </View>
      ) : null}

      {/* PABILI SECTION */}
      {selectedServices.includes('Pabili') && (
        <View style={styles.sectionCard} testID="pabili-section">
          <Text style={styles.sectionTitle}>🛒 Pabili (Personal Shopper)</Text>
          <Text style={styles.sectionSubtitle}>
            Select store categories (max 3) and add items to buy:
          </Text>

          {pabiliError ? (
            <Text style={styles.errorText} testID="category-limit-error">
              {pabiliError}
            </Text>
          ) : null}

          <View style={styles.categoryGrid}>
            {PABILI_CATEGORIES.map((cat) => {
              const isSelected = selectedCats.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  testID={`category-card-${cat}`}
                  style={[styles.categoryBadge, isSelected && styles.categoryBadgeSelected]}
                  onPress={() => toggleCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryBadgeText,
                      isSelected && styles.categoryBadgeTextSelected,
                    ]}
                  >
                    {cat} {isSelected ? '✓' : '+'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Items input per selected category */}
          {selectedCats.map((cat) => (
            <View key={cat} style={styles.catItemBox} testID={`cat-items-${cat}`}>
              <Text style={styles.catItemBoxTitle}>{cat} Items:</Text>
              {(catItems[cat] || ['']).map((itemVal, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <TextInput
                    testID={`item-input-${cat}-${idx}`}
                    style={styles.itemInput}
                    placeholder={`Item ${idx + 1} description`}
                    value={itemVal}
                    onChangeText={(text) => handleUpdateItem(cat, idx, text)}
                  />
                  <TouchableOpacity
                    testID={`remove-item-${cat}-${idx}`}
                    style={styles.removeBtn}
                    onPress={() => handleRemoveItem(cat, idx)}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                testID={`add-item-button-${cat}`}
                style={styles.addItemBtn}
                onPress={() => handleAddItem(cat)}
              >
                <Text style={styles.addItemBtnText}>+ Add Another Item</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* PADALA SECTION */}
      {selectedServices.includes('Padala') && (
        <View style={styles.sectionCard} testID="padala-section">
          <Text style={styles.sectionTitle}>📦 Padala (Parcel Delivery)</Text>
          
          <Text style={styles.label}>Item / Parcel Description *</Text>
          <TextInput
            testID="padala-item-input"
            style={styles.input}
            placeholder="e.g. Documents, Cake, Clothing"
            value={padalaItem}
            onChangeText={setPadalaItem}
          />

          <Text style={styles.label}>Sender Address</Text>
          <TextInput
            testID="padala-sender-input"
            style={styles.input}
            placeholder="Sender address"
            value={padalaSender}
            onChangeText={setPadalaSender}
          />

          <Text style={styles.label}>Receiver Name & Address</Text>
          <TextInput
            testID="padala-receiver-input"
            style={styles.input}
            placeholder="Receiver address details"
            value={padalaReceiver}
            onChangeText={setPadalaReceiver}
          />

          <Text style={styles.label}>Receiver Phone *</Text>
          <TextInput
            testID="padala-receiver-phone-input"
            style={styles.input}
            placeholder="09XX-XXX-XXXX"
            value={padalaReceiverPhone}
            onChangeText={setPadalaReceiverPhone}
            keyboardType="phone-pad"
          />
        </View>
      )}

      {/* BILLS PAYMENT SECTION */}
      {selectedServices.includes('Bills Payment') && (
        <View style={styles.sectionCard} testID="bills-section">
          <Text style={styles.sectionTitle}>💳 Bills Payment</Text>

          <Text style={styles.label}>Biller Name *</Text>
          <TextInput
            testID="bills-biller-input"
            style={styles.input}
            placeholder="e.g. Meralco, Maynilad, Telecom"
            value={billsBiller}
            onChangeText={setBillsBiller}
          />

          <Text style={styles.label}>Account / Reference Number *</Text>
          <TextInput
            testID="bills-account-input"
            style={styles.input}
            placeholder="Account No."
            value={billsAccountNo}
            onChangeText={setBillsAccountNo}
          />

          <Text style={styles.label}>Bill Amount (₱) *</Text>
          <TextInput
            testID="bills-amount-input"
            style={styles.input}
            placeholder="Amount in ₱"
            value={billsAmount}
            onChangeText={setBillsAmount}
            keyboardType="numeric"
          />
        </View>
      )}

      <TouchableOpacity
        testID="submit-order-form-button"
        style={styles.submitBtn}
        onPress={validateAndSubmit}
      >
        <Text style={styles.submitBtnText}>Proceed to Checkout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8', padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  subTitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  errorBanner: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FCA5A5' },
  errorText: { color: '#DC2626', fontWeight: '600', textAlign: 'center' },
  sectionCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#F62459', marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  categoryBadgeSelected: { backgroundColor: '#F62459', borderColor: '#F62459' },
  categoryBadgeText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  categoryBadgeTextSelected: { color: '#FFFFFF' },
  catItemBox: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  catItemBoxTitle: { fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  itemInput: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 8, fontSize: 14 },
  removeBtn: { marginLeft: 8, backgroundColor: '#EF4444', padding: 8, borderRadius: 6 },
  removeBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  addItemBtn: { alignSelf: 'flex-start', marginTop: 4 },
  addItemBtnText: { color: '#F62459', fontWeight: '600', fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  submitBtn: { backgroundColor: '#F62459', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
});
