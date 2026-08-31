import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  ChevronLeft,
  ShoppingBag,
  Pill,
  Utensils,
  Store,
  Sparkles,
  CheckCircle2,
  MapPin,
  Check,
  X,
  ShieldCheck,
  ArrowRight,
  Package,
  ShoppingCart,
} from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import { saveCustomerLocation } from '../firebase/location';
import { apiClient } from '../services/apiClient';
import { postOrderSubmitted } from '../services/chatSystemMessages';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import ConfirmModal from '../components/ConfirmModal';

interface ItemRow {
  id: string;
  name: string;
  quantity: number;
}

let rowIdCounter = 0;
const makeId = () => `row-${Date.now()}-${rowIdCounter++}`;
/** What the customer is currently typing, before it becomes a list item. */
interface ItemDraft {
  name: string;
  quantity: number;
}

const getCategoryIcon = (category?: string) => {
  const lower = String(category || '').toLowerCase();
  if (lower.includes('pharmacy') || lower.includes('health') || lower.includes('drug') || lower.includes('med')) return Pill;
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('dining') || lower.includes('eatery')) return Utensils;
  if (lower.includes('supermarket') || lower.includes('grocery') || lower.includes('market') || lower.includes('mart')) return ShoppingBag;
  if (lower.includes('bakery') || lower.includes('bread') || lower.includes('cake')) return Store;
  if (lower.includes('retail') || lower.includes('general') || lower.includes('hardware') || lower.includes('supplies')) return Package;
  return ShoppingCart;
};

const QUICK_SUGGESTIONS: Record<string, string[]> = {
  'Supermarket & Grocery': ['Rice (5kg)', 'Fresh Milk', 'Tray of Eggs', 'Cooking Oil', 'Refined Sugar', 'Canned Goods'],
  Groceries: ['Rice (5kg)', 'Fresh Milk', 'Tray of Eggs', 'Cooking Oil', 'Refined Sugar'],
  'Pharmacy & Health': ['Paracetamol 500mg', '70% Isopropyl Alcohol', 'Vitamin C 500mg', 'Face Masks (Box)', 'Bandage Strips'],
  Pharmacy: ['Paracetamol 500mg', '70% Alcohol', 'Vitamin C', 'Face Masks', 'Bandage'],
  'Bakery & Snacks': ['Pandesal (10pcs)', 'Sliced Loaf Bread', 'Spanish Bread', 'Butter Toast', 'Ensaymada'],
  Bakery: ['Pandesal (10pcs)', 'Sliced Bread', 'Spanish Bread'],
  // Keyed by the exact seeded category name. The plural 'Food & Restaurants'
  // that used to sit below this matched no category at all, so its suggestions
  // were unreachable — merged in here rather than left as dead weight.
  'Fast Food & Restaurant': [
    'Burger & Fries Meal',
    'Fried Chicken (2pc)',
    'Rice Meal',
    'Iced Beverage',
    'Pancit / Noodles',
  ],
  'Retail & General Merchandise': ['Bond Paper (Ream)', 'Ballpen Set', 'AA Batteries (4pk)', 'Notebooks', 'Disinfectant Wipes'],
};

export default function ErrandItemsScreen({ route, navigation }: RootStackScreenProps<'ErrandItems'>) {
  const { user } = route.params || {};
  const rawCats = route.params?.selectedCats;
  const selectedCats: string[] = Array.isArray(rawCats) && rawCats.length > 0
    ? rawCats.map((c) => String(c || '').trim()).filter(Boolean)
    : ['Pabili'];
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, isTablet, isCompact } = useResponsive();

  const [itemsByCategory, setItemsByCategory] = useState<Record<string, ItemRow[]>>(() =>
    Object.fromEntries(selectedCats.map((cat) => [cat, [] as ItemRow[]]))
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // The customer's real saved delivery location
  const [defaultLocation, setDefaultLocation] = useState<{ address: string; latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const fetchDefaultLocation = useCallback(() => {
    let isMounted = true;
    setLocationLoading(true);
    apiClient
      .get(`/customer-locations/${user.id}`)
      .then((res) => {
        const locations: Array<{ address: string; latitude: number; longitude: number; isDefault: boolean }> = res.data || [];
        const def = locations.find((l) => l.isDefault) ?? locations[0];
        if (isMounted) {
          if (def) {
            setDefaultLocation({ address: def.address, latitude: def.latitude, longitude: def.longitude });
          } else {
            setDefaultLocation(null);
          }
        }
      })
      .catch((err) => {
        console.warn('[Customer Locations] Failed to fetch default location:', err.message);
      })
      .finally(() => {
        if (isMounted) setLocationLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user.id]);

  // Re-fetch whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDefaultLocation();
    }, [fetchDefaultLocation])
  );

  // Check if user has entered any text
  /**
   * Item entry is compose-then-commit, not a stack of live form fields.
   *
   * Before this, every item was a permanently-editable TextInput and the card
   * opened with one blank one. Three things went wrong with that:
   *
   *  - There was no visual difference between "something I asked for" and "an
   *    empty box". A shopping list you cannot see is not a list; it is a form,
   *    and it gives the customer nothing to feel ownership over as it grows.
   *  - Adding a second item required finding and tapping "Add Another Item"
   *    BEFORE you could type it. Every real list app lets you commit one and
   *    keep going.
   *  - The placeholder asked for "Brand, size, quantity" while a quantity
   *    stepper sat right beside it. Customers split the difference — some typed
   *    "2 Coke 1.5L" with the stepper on 1, others left the name clean and used
   *    the stepper — so the dispatcher received two different conventions for
   *    the same request.
   *
   * `itemsByCategory` now holds only committed items, which is what
   * validateAndSubmit already wanted, and the draft lives separately.
   */
  const [draftByCategory, setDraftByCategory] = useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(selectedCats.map((cat) => [cat, { name: '', quantity: 1 }]))
  );

  const hasEnteredItems = useMemo(() => {
    const anyCommitted = Object.values(itemsByCategory).some((rows) => rows.length > 0);
    const anyDraft = Object.values(draftByCategory).some((d) => d.name.trim().length > 0);
    return anyCommitted || anyDraft;
  }, [itemsByCategory, draftByCategory]);

  // Loss Aversion Back Guard
  const handleBackPress = useCallback(() => {
    if (hasEnteredItems) {
      setShowDiscardModal(true);
      return true;
    }
    navigation.goBack();
    return true;
  }, [hasEnteredItems, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);


  const getDraft = (category: string): ItemDraft =>
    draftByCategory[category] || { name: '', quantity: 1 };

  const setDraftName = (category: string, name: string) => {
    setValidationError(null);
    setDraftByCategory((prev) => ({
      ...prev,
      [category]: { ...getDraft(category), name },
    }));
  };

  const setDraftQuantity = (category: string, delta: number) => {
    setDraftByCategory((prev) => {
      const current = prev[category] || { name: '', quantity: 1 };
      return {
        ...prev,
        [category]: { ...current, quantity: Math.max(1, current.quantity + delta) },
      };
    });
  };

  /**
   * Move the draft into the list.
   *
   * Same-name items merge into one line rather than stacking duplicates —
   * asking for "Coke 1.5L" twice means you want two, and a rider reading two
   * identical lines has to guess whether that was a mistake.
   */
  const commitDraft = (category: string, overrideName?: string) => {
    const draft = getDraft(category);
    const name = (overrideName ?? draft.name).trim();
    if (!name) return;

    const quantity = overrideName ? 1 : draft.quantity;

    setValidationError(null);
    setItemsByCategory((prev) => {
      const existing = prev[category] || [];
      const matchIndex = existing.findIndex(
        (r) => r.name.trim().toLowerCase() === name.toLowerCase()
      );

      if (matchIndex !== -1) {
        const merged = [...existing];
        merged[matchIndex] = {
          ...merged[matchIndex],
          quantity: merged[matchIndex].quantity + quantity,
        };
        return { ...prev, [category]: merged };
      }

      return { ...prev, [category]: [...existing, { id: makeId(), name, quantity }] };
    });

    // Only the typed draft is cleared. A quick-add chip never touched it, so
    // clearing it there would throw away something the customer was mid-way
    // through typing.
    if (!overrideName) {
      setDraftByCategory((prev) => ({ ...prev, [category]: { name: '', quantity: 1 } }));
    }
  };

  const removeItemRow = (category: string, id: string) => {
    setItemsByCategory((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((row) => row.id !== id),
    }));
  };

  /** Quantity on an item already in the list. Dropping to zero removes it,
   *  which is what a customer tapping "minus" on a single item means. */
  const adjustCommittedQuantity = (category: string, id: string, delta: number) => {
    setItemsByCategory((prev) => {
      const rows = prev[category] || [];
      const next = rows
        .map((row) => (row.id === id ? { ...row, quantity: row.quantity + delta } : row))
        .filter((row) => row.quantity > 0);
      return { ...prev, [category]: next };
    });
  };

  const handleQuickAdd = (category: string, itemName: string) => {
    commitDraft(category, itemName);
  };

  /**
   * Everything the customer has asked for in a category, including a draft they
   * have typed but not yet added.
   *
   * Without this the compose row is a trap: type "Coke 1.5L", tap Send, and it
   * silently does not arrive — the one place a shopping app must never lose
   * data. Counting the draft also keeps the footer honest, so the number on the
   * button is always the number that gets sent.
   */
  const getEffectiveRows = useCallback(
    (category: string): ItemRow[] => {
      const committed = itemsByCategory[category] || [];
      const draft = draftByCategory[category];
      if (!draft || !draft.name.trim()) return committed;

      // Matches commitDraft's merge rule, so the preview equals the result.
      const matchIndex = committed.findIndex(
        (r) => r.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
      );
      if (matchIndex !== -1) {
        const merged = [...committed];
        merged[matchIndex] = {
          ...merged[matchIndex],
          quantity: merged[matchIndex].quantity + draft.quantity,
        };
        return merged;
      }
      return [...committed, { id: 'draft', name: draft.name.trim(), quantity: draft.quantity }];
    },
    [itemsByCategory, draftByCategory]
  );

  const getTotalItemCount = () => {
    return selectedCats.reduce(
      (sum, cat) => sum + getEffectiveRows(cat).reduce((rowSum, r) => rowSum + r.quantity, 0),
      0
    );
  };

  const scrollRef = useRef<ScrollView>(null);

  /**
   * What the primary button does while the list is still empty.
   *
   * The alternative — disabling it — is what this screen used to do, and a
   * disabled primary is a dead end: nothing happens on tap, no tooltip appears
   * on touch, and a customer who has not spotted the empty field has no way to
   * discover what is wrong. Here the tap becomes navigation: scroll back to the
   * work and name what is missing, in the same place the fix has to happen.
   */
  const handleEmptyListPress = useCallback(() => {
    setValidationError(
      selectedCats.length === 1
        ? `Add at least one item for ${selectedCats[0]} so your rider knows what to buy.`
        : 'Add at least one item so your rider knows what to buy.'
    );
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [selectedCats]);

  const validateAndSubmit = async () => {
    if (isSubmittingRef.current) return;
    setValidationError(null);

    const validItems: Array<{ storeCategory: string; itemName: string; quantity: number }> = [];

    for (const cat of selectedCats) {
      // Includes an un-added draft, so nothing the customer typed is dropped.
      const catValid = getEffectiveRows(cat);

      if (catValid.length === 0) {
        setValidationError(`Please add at least one item for ${cat}.`);
        return;
      }

      for (const row of catValid) {
        validItems.push({
          storeCategory: cat,
          itemName: row.name.trim(),
          quantity: row.quantity,
        });
      }
    }

    if (validItems.length === 0) {
      setValidationError('Please list at least one item before continuing.');
      return;
    }

    if (!defaultLocation) {
      setValidationError('Please set a delivery location in your profile before submitting.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const errandId = `PABILI-${Date.now().toString().slice(-6)}`;
    const { latitude, longitude, address: deliveryAddress } = defaultLocation;

    try {
      await saveCustomerLocation(user.id, latitude, longitude, deliveryAddress);
    } catch (e) {
      console.error('[Firebase RTDB] Location write warning:', e);
    }

    try {
      const response = await apiClient.post('/errands', {
        customerId: user?.id,
        category: 'Pabili',
        description: `Pabili Store Categories: ${selectedCats.join(', ')}`,
        pickupAddress: selectedCats.join(', '),
        deliveryAddress,
        deliveryLatitude: latitude,
        deliveryLongitude: longitude,
        estimatedCost: 0,
        tip: 0,
        storeCount: selectedCats.length,
        pabiliItems: validItems.map((item) => ({
          itemName: item.itemName,
          storeCategory: item.storeCategory,
          quantity: item.quantity,
          unitPrice: 0,
          estimatedSubtotal: 0,
        })),
      });

      const createdErrand = response.data;
      const newErrandId = String(createdErrand?.id || errandId);

      // Open the conversation with the order itself.
      //
      // The chat used to start empty, so a dispatcher opening it saw nothing
      // and the customer had no visible record of what they had just asked for.
      // Posting the structured request makes the chat the account of the errand
      // from its first line, and gives the dispatcher everything they need
      // without switching panels. Awaited so it lands before the customer can
      // reach the chat, but never allowed to fail the submit — the errand is
      // already created on the server by this point.
      await postOrderSubmitted(newErrandId, {
        items: validItems,
        deliveryAddress,
        categories: selectedCats,
        deliveryFee: Number(createdErrand?.deliveryFee ?? 0),
      });

      navigation.navigate('WaitingForDispatcher', { user, errandId: newErrandId });
    } catch (err: any) {
      Alert.alert('Errand Error', err.message || 'Failed to submit errand request. Please try again.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const totalItemCount = getTotalItemCount();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* 1. TOP NAV HEADER */}
        <View style={[styles.navHeaderRow, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
            testID="back-button"
          >
            <ChevronLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.textDark }]}>Shopping List</Text>
          <View style={styles.navHeaderRightPlaceholder} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* 2. GOAL-GRADIENT 3-STEP PROGRESS STEPPER (STEP 2 ACTIVE) */}
          <View style={styles.stepperContainer}>
            <View
              style={[
                styles.stepPillCompleted,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                  borderColor: isDark ? '#059669' : '#A7F3D0',
                },
              ]}
            >
              <Check size={11} color="#10B981" strokeWidth={3} />
              <Text style={[styles.stepTextCompleted, { color: isDark ? '#34D399' : '#065F46' }]}>
                Stores ({selectedCats.length})
              </Text>
            </View>
            <View style={[styles.stepperLine, { backgroundColor: colors.border }]} />
            <View style={[styles.stepPillActive, { backgroundColor: colors.primary }]}>
              <View style={styles.stepNumCircleActive}>
                <Text style={styles.stepNumActive}>2</Text>
              </View>
              <Text style={styles.stepTextActive}>List Items</Text>
            </View>
            <View style={[styles.stepperLine, { backgroundColor: colors.border }]} />
            <View style={[styles.stepPillInactive, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
              <Text style={[styles.stepNumInactive, { color: colors.textLight }]}>3</Text>
              <Text style={[styles.stepTextInactive, { color: colors.textLight }]}>Review</Text>
            </View>
          </View>

          {/* 3. SCREEN TITLE & SUBTITLE */}
          <View style={styles.heroBanner}>
            <Text style={[styles.headerTitle, { color: colors.textDark }]}>What should we buy?</Text>
            <Text style={[styles.subTitle, { color: colors.textGray }]}>
              Add brands, sizes and quantities so your rider knows exactly what to get.
            </Text>

            {/* Opens by naming what the previous screen accomplished, rather
                than presenting a fresh demand. One line, and it converts the
                screen from "here is more work" into "here is the next part of
                something you have already started" — the customer is now
                protecting an investment instead of re-evaluating the whole
                errand. */}
            <View
              style={[
                styles.carryOverPill,
                { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5' },
              ]}
            >
              <Check size={12} color="#059669" strokeWidth={3} />
              <Text style={styles.carryOverText}>
                {selectedCats.length === 1
                  ? `${selectedCats[0]} chosen`
                  : `${selectedCats.length} stores chosen`}
              </Text>
            </View>
          </View>

          {/* 4. DELIVERY LOCATION STATUS & PREVIEW CARD */}
          {locationLoading ? (
            <View
              style={[
                styles.locationCard,
                { backgroundColor: isDark ? 'rgba(32,138,239,0.08)' : '#F0F7FF', borderColor: colors.primary + '40' },
                Shadows.soft,
              ]}
            >
              <View style={styles.locationCardHeader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationCardTitle, { color: colors.primary }]}>
                    Locating your delivery address...
                  </Text>
                  <Text style={[styles.locationCardSubtitle, { color: colors.textGray }]}>
                    Retrieving your saved location in Tacurong City for routing and courier dispatch.
                  </Text>
                </View>
              </View>
            </View>
          ) : defaultLocation ? (
            <View
              style={[
                styles.locationCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                Shadows.soft,
              ]}
            >
              <View style={styles.locationCardHeader}>
                <View style={[styles.locationIconBadge, { backgroundColor: isDark ? 'rgba(32,138,239,0.15)' : '#E6F4FE' }]}>
                  <MapPin size={16} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationCardLabel, { color: colors.textGray }]}>Delivering To:</Text>
                  <Text style={[styles.locationAddressText, { color: colors.textDark }]} numberOfLines={2}>
                    {defaultLocation.address}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.changeLocationBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray }]}
                  onPress={() => navigation.navigate('CustomerLocation', { user })}
                >
                  <Text style={[styles.changeLocationBtnText, { color: colors.primary }]}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.locationCard,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FEF3C7', borderColor: isDark ? '#D97706' : '#FCD34D' },
                Shadows.soft,
              ]}
            >
              <View style={styles.locationCardHeader}>
                <View style={[styles.locationIconBadge, { backgroundColor: '#F59E0B20' }]}>
                  <AlertCircle size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationCardTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                    No Delivery Location Selected
                  </Text>
                  <Text style={[styles.locationCardSubtitle, { color: isDark ? '#FDE68A' : '#B45309' }]}>
                    Please select or pin your delivery address in Tacurong City before submitting.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.setLocationBtn, { backgroundColor: colors.primary }, Shadows.soft]}
                onPress={() => navigation.navigate('CustomerLocation', { user })}
              >
                <MapPin size={15} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.setLocationBtnText}>Set Delivery Location Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* VALIDATION ERROR BANNER */}
          {validationError ? (
            <View
              style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: colors.danger }]}
              testID="validation-error-banner"
            >
              <AlertCircle size={16} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]} testID="validation-error-text">
                {validationError}
              </Text>
            </View>
          ) : null}

          {/* WHAT HAPPENS NEXT — placed BEFORE the item entry, not after.
              Reciprocity is strongest before the ask and close to useless after
              it: a customer still deciding whether to trust an errand with a
              stranger's shopping needs to read this while deciding, not once
              they have already typed everything in. Sitting below the input it
              reached only the people who no longer needed it, and its position
              quietly implied the ask had been uncomfortable. */}
          <View
            style={[
              styles.trustCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              Shadows.soft,
            ]}
          >
            <View style={[styles.trustIconHalo, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFF0F5' }]}>
              <ShieldCheck size={20} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.trustTextCol}>
              <Text style={[styles.trustTitle, { color: colors.textDark }]}>
                What happens next
              </Text>
              <Text style={[styles.trustSub, { color: colors.textGray }]}>
                1. Dispatcher verifies availability & calculates upfront delivery fare via chat.{'\n'}
                2. Rider purchases items with official store receipts.{'\n'}
                3. Pay total Cash on Delivery (COD) upon arrival.
              </Text>
            </View>
          </View>
          {/* 5. CATEGORY SECTION CARDS */}
          {selectedCats.map((cat, catIdx) => {
            const CatIcon = getCategoryIcon(cat);
            const rows = itemsByCategory[cat] || [];
            const suggestions = QUICK_SUGGESTIONS[cat] || [];
            const validCount = rows.filter((r) => r.name.trim().length > 0).length;

            return (
              <View
                key={`cat-section-${cat}-${catIdx}`}
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  Shadows.soft,
                ]}
                testID={`items-section-${cat}`}
              >
                {/* SECTION HEADER */}
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <View style={[styles.catIconCircle, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFF0F5' }]}>
                      <CatIcon size={18} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.textDark }]}>{cat}</Text>
                      <Text style={[styles.sectionSubtitle, { color: colors.textGray }]}>
                        {validCount === 0
                          ? 'Add your first item'
                          : `${validCount} item${validCount > 1 ? 's' : ''} added`}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.badgePill,
                      {
                        backgroundColor: validCount > 0
                          ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                          : (isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray),
                        borderColor: validCount > 0 ? '#10B981' : colors.border,
                      },
                    ]}
                  >
                    {validCount > 0 && <CheckCircle2 size={11} color="#10B981" />}
                    <Text
                      style={[
                        styles.badgeText,
                        { color: validCount > 0 ? (isDark ? '#34D399' : '#065F46') : colors.textGray },
                      ]}
                    >
                      {validCount > 0 ? 'Ready' : 'Pending'}
                    </Text>
                  </View>
                </View>

                {/* QUICK ADD SUGGESTIONS CHIPS */}
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionTitleRow}>
                      <Sparkles size={12} color={colors.primary} />
                      <Text style={[styles.suggestionTitle, { color: colors.textGray }]}>Popular here — tap to add</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                      {suggestions.map((sugItem, sugIdx) => (
                        <TouchableOpacity
                          key={`sug-${sugItem}-${sugIdx}`}
                          activeOpacity={0.7}
                          style={[
                            styles.sugChip,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray,
                              borderColor: colors.border,
                            },
                          ]}
                          onPress={() => handleQuickAdd(cat, sugItem)}
                        >
                          <Plus size={11} color={colors.primary} />
                          <Text style={[styles.sugChipText, { color: colors.textDark }]}>{sugItem}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* THE LIST — what the customer has actually asked for.
                    Rendered as settled rows, not text fields, so it reads as a
                    shopping list they are building rather than a form they are
                    filling. That difference is the whole point: a visible,
                    growing list is something you protect; a column of identical
                    inputs is something you abandon. */}
                {rows.length > 0 && (
                  <View style={styles.listWrapper}>
                    {rows.map((row, index) => (
                      <View
                        key={row.id}
                        style={[
                          styles.listRow,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                            borderColor: colors.border,
                          },
                        ]}
                        testID={`item-row-${cat}-${index}`}
                      >
                        <View style={styles.listQtyGroup}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.listQtyBtn}
                            onPress={() => adjustCommittedQuantity(cat, row.id, -1)}
                            testID={`decrement-qty-${cat}-${index}`}
                            accessibilityLabel={`Reduce quantity of ${row.name}`}
                          >
                            <Minus size={12} color={colors.textGray} strokeWidth={2.6} />
                          </TouchableOpacity>
                          <Text style={[styles.listQtyValue, { color: colors.textDark }]}>
                            {row.quantity}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.listQtyBtn}
                            onPress={() => adjustCommittedQuantity(cat, row.id, 1)}
                            testID={`increment-qty-${cat}-${index}`}
                            accessibilityLabel={`Increase quantity of ${row.name}`}
                          >
                            <Plus size={12} color={colors.textGray} strokeWidth={2.6} />
                          </TouchableOpacity>
                        </View>

                        <Text
                          style={[styles.listItemName, { color: colors.textDark }]}
                          numberOfLines={2}
                        >
                          {row.name}
                        </Text>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          style={styles.listRemoveBtn}
                          onPress={() => removeItemRow(cat, row.id)}
                          testID={`remove-item-${cat}-${index}`}
                          accessibilityLabel={`Remove ${row.name}`}
                        >
                          <X size={13} color={colors.textLight} strokeWidth={2.4} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* THE COMPOSE ROW — always one, always at the bottom, always
                    ready. Submitting from the keyboard commits and keeps focus,
                    so a customer with five things to buy types five times
                    without reaching for a button between each one. */}
                <View style={styles.composeRow}>
                  <TextInput
                    style={[
                      styles.composeInput,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FAFAFA',
                        borderColor: colors.border,
                        color: colors.textDark,
                      },
                    ]}
                    /* A concrete example of a good entry, and no mention of
                       quantity — the stepper owns that now. The old hint asked
                       for quantity in a field that was not for quantity. */
                    placeholder="e.g. Coke 1.5L"
                    placeholderTextColor={colors.textLight}
                    value={getDraft(cat).name}
                    onChangeText={(val) => setDraftName(cat, val)}
                    onSubmitEditing={() => commitDraft(cat)}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    testID={`item-name-input-${cat}`}
                  />

                  <View
                    style={[
                      styles.composeStepper,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.stepperBtn}
                      onPress={() => setDraftQuantity(cat, -1)}
                      testID={`draft-decrement-${cat}`}
                    >
                      <Minus
                        size={13}
                        color={getDraft(cat).quantity > 1 ? colors.textDark : colors.textLight}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.stepperValueText, { color: colors.textDark }]}>
                      {getDraft(cat).quantity}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.stepperBtn}
                      onPress={() => setDraftQuantity(cat, 1)}
                      testID={`draft-increment-${cat}`}
                    >
                      <Plus size={13} color={colors.textDark} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.composeAddBtn,
                      {
                        backgroundColor: getDraft(cat).name.trim()
                          ? colors.primary
                          : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : '#E5E7EB',
                      },
                    ]}
                    onPress={() => commitDraft(cat)}
                    testID={`add-item-btn-${cat}`}
                    accessibilityLabel={`Add item to ${cat}`}
                  >
                    <Plus
                      size={17}
                      color={getDraft(cat).name.trim() ? '#FFFFFF' : colors.textLight}
                      strokeWidth={2.8}
                    />
                  </TouchableOpacity>
                </View>

              </View>
            );
          })}

        </ScrollView>

        {/* 7. BOTTOM ORDER SUMMARY & SUBMIT ACTION BAR */}
        <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }, Shadows.liftedUp]}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textGray }]}>
                {totalItemCount === 0 ? 'Your list' : 'Ready to send'}
              </Text>
              <Text style={[styles.summaryValue, { color: colors.textDark }]}>
                {totalItemCount === 0
                  ? `Add your first item`
                  : `${totalItemCount} ${totalItemCount === 1 ? 'item' : 'items'} · ${selectedCats.length} ${selectedCats.length === 1 ? 'store' : 'stores'}`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            testID="submit-errand-items-button"
            activeOpacity={0.85}
            style={[
              styles.submitBtn,
              {
                backgroundColor: locationLoading
                  ? (isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB')
                  : !defaultLocation
                  ? '#D97706'
                  : totalItemCount === 0
                  ? (isDark ? 'rgba(246,36,89,0.35)' : '#F7A8BE')
                  : colors.primary,
              },
              (isSubmitting || locationLoading) && { opacity: 0.8 },
              totalItemCount > 0 && defaultLocation && Shadows.liftedUp,
            ]}
            onPress={
              !defaultLocation && !locationLoading
                ? () => navigation.navigate('CustomerLocation', { user })
                : totalItemCount === 0
                ? handleEmptyListPress
                : validateAndSubmit
            }
            disabled={isSubmitting || locationLoading}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : locationLoading ? (
              <View style={styles.submitBtnContent}>
                <ActivityIndicator size="small" color={colors.textDark} />
                <Text style={[styles.submitBtnText, { color: colors.textDark }]}>
                  Locating Delivery Address...
                </Text>
              </View>
            ) : !defaultLocation ? (
              <View style={styles.submitBtnContent}>
                <MapPin size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.submitBtnText}>Set Delivery Location to Continue</Text>
              </View>
            ) : (
              <View style={styles.submitBtnContent}>
                <ShoppingBag size={17} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.submitBtnText}>
                  {totalItemCount > 0
                    ? `Send my errand (${totalItemCount} ${totalItemCount === 1 ? 'item' : 'items'})`
                    : 'Send my errand'}
                </Text>
                {totalItemCount > 0 && <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* LOSS AVERSION DISCARD CONFIRMATION MODAL */}
      <ConfirmModal
        visible={showDiscardModal}
        title="Discard Shopping List?"
        message="You have listed items in your shopping list. Leaving now will discard your current draft."
        confirmLabel="Discard & Exit"
        cancelLabel="Keep Editing"
        destructive={true}
        onConfirm={() => {
          setShowDiscardModal(false);
          navigation.goBack();
        }}
        onCancel={() => setShowDiscardModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.md, 0.35),
  },
  navHeaderRightPlaceholder: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 3,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  stepPillCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  stepTextCompleted: {
    fontFamily: FontFamily.bold,
    fontSize: 10.5,
  },
  stepperLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 4,
  },
  stepPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  stepNumCircleActive: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#F62459',
  },
  stepTextActive: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  stepPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  stepNumInactive: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },
  stepTextInactive: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
  heroBanner: {
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xl,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  // ── The committed list ────────────────────────────────────────────────
  // Quantity sits to the LEFT of the name, the way a written shopping list
  // reads ("2 Coke 1.5L"), and is visually lighter than the item itself —
  // the name is what the customer cares about, the number is an adjustment.
  listWrapper: {
    gap: 6,
    marginBottom: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  listQtyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listQtyBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listQtyValue: {
    fontFamily: FontFamily.bold,
    fontSize: 12.5,
    minWidth: 16,
    textAlign: 'center',
  },
  listItemName: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
  },
  listRemoveBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── The compose row ───────────────────────────────────────────────────
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  composeInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
  },
  composeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    paddingHorizontal: 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  composeAddBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  carryOverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  carryOverText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#059669',
  },
  subTitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 1,
    lineHeight: 18,
  },
  locationCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCardLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationAddressText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
    marginTop: 1,
  },
  changeLocationBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  changeLocationBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
  },
  locationCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
    marginBottom: 2,
  },
  locationCardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  setLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  setLocationBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.xs + 1,
    flex: 1,
  },
  sectionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
  sectionSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(9.5, 0.2),
  },
  suggestionsContainer: {
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  suggestionTitle: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(9.5, 0.2),
  },
  suggestionsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  sugChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  sugChipText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(10, 0.2),
  },
  stepperBtn: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    minWidth: 16,
    textAlign: 'center',
  },
  removeBtn: {
    width: 32,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnPlaceholder: {
    width: 32,
  },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  trustIconHalo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTextCol: {
    flex: 1,
  },
  trustTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginBottom: 1,
  },
  trustSub: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    lineHeight: 14,
  },
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderTopWidth: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  summaryRow: {
    marginBottom: Spacing.xs + 2,
  },
  summaryLabel: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(9, 0.2),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  submitBtn: {
    paddingVertical: moderateScale(11, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: moderateScale(48, 0.2),
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    color: '#FFFFFF',
  },
});
