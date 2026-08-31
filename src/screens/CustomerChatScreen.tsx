import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, push, onValue, update } from 'firebase/database';
import { getSocket } from '../services/socketClient';
import {
  MapPin,
  CreditCard,
  Send,
  RotateCw,
  WifiOff,
  ChevronLeft,
  Headphones,
  Info,
  Package,
  ClipboardCheck,
  Store,
  Receipt,
  CheckCircle2,
  Clock,
  Trash2,
  XCircle,
  ReceiptText,
} from 'lucide-react-native';
import { ChatMessagesSkeleton } from '../components/ChatSkeleton';
import { database } from '../firebase/config';
import { RootStackScreenProps } from '../navigation/types';
import MapPreviewField from '../components/MapPreviewField';
import ErrandDetailsModal from '../components/ErrandDetailsModal';
import { PaymentModeSelectionModal } from '../components/PaymentModeSelectionModal';
import { RatingModal } from '../components/RatingModal';
import StatusBadge from '../components/StatusBadge';
import { apiClient } from '../services/apiClient';
import { API_BASE_URL } from '../config/api';
import { sanitizeCoordinate } from '../utils/coords';
import { useThemeColor } from '../hooks/useThemeColor';
import { formatErrandId } from '../utils/formatErrandId';
import FeeBreakdownCard from '../components/FeeBreakdownCard';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';

interface StorePinpoint {
  storeName: string;
  latitude: number;
  longitude: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  role: 'customer' | 'dispatcher';
  type?: 'text' | 'pinpoints' | 'payment_prompt' | 'order_confirmation' | 'item_deleted';
  text: string;
  pinpoints?: StorePinpoint[];
  items?: Array<{ itemName: string; storeCategory?: string; quantity: number }>;
  groupedItems?: any;
  storeGroups?: any[];
  deliveryFee?: number;
  totalCost?: number;
  confirmed?: boolean;
  timestamp: number;
}

interface ParsedCategoryGroup {
  categoryName: string;
  items: Array<{ itemName: string; quantity: number; priceNote?: string }>;
}

interface ParsedStoreGroup {
  storeName: string;
  categories: ParsedCategoryGroup[];
  totalItemsCount: number;
}

const parseOrderConfirmationTree = (msgItem: any): ParsedStoreGroup[] => {
  const result: ParsedStoreGroup[] = [];
  const grouped = msgItem.groupedItems;
  const rawStoreGroups = msgItem.storeGroups;
  const flatItems: any[] = Array.isArray(msgItem.items) ? msgItem.items : [];

  if (grouped && typeof grouped === 'object' && Object.keys(grouped).length > 0) {
    Object.keys(grouped).forEach((storeKey) => {
      const storeVal = grouped[storeKey];
      const categories: ParsedCategoryGroup[] = [];

      if (Array.isArray(storeVal)) {
        // Flat array of items directly under store name
        categories.push({
          categoryName: 'General Items',
          items: storeVal.map((it: any) => ({
            itemName: it.itemName || 'Item',
            quantity: Math.max(1, Number(it.quantity) || 1),
            priceNote: it.priceNote || 'Actual store receipt upon purchase',
          })),
        });
      } else if (storeVal && typeof storeVal === 'object') {
        // Nested categories under store name: { "Fast Food & Restaurant": [ items ] }
        Object.keys(storeVal).forEach((catKey) => {
          const catVal = storeVal[catKey];
          const itemList: any[] = Array.isArray(catVal) ? catVal : [];
          categories.push({
            categoryName: catKey,
            items: itemList.map((it: any) => ({
              itemName: it.itemName || 'Item',
              quantity: Math.max(1, Number(it.quantity) || 1),
              priceNote: it.priceNote || 'Actual store receipt upon purchase',
            })),
          });
        });
      }

      const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
      result.push({
        storeName: storeKey,
        categories,
        totalItemsCount: totalItems,
      });
    });
  } else if (Array.isArray(rawStoreGroups) && rawStoreGroups.length > 0) {
    rawStoreGroups.forEach((sg: any) => {
      const storeName = sg.storeName || 'Store';
      const items = Array.isArray(sg.items) ? sg.items : [];
      result.push({
        storeName,
        categories: [
          {
            categoryName: 'General Items',
            items: items.map((it: any) => ({
              itemName: it.itemName || 'Item',
              quantity: Math.max(1, Number(it.quantity) || 1),
              priceNote: it.priceNote || 'Actual store receipt upon purchase',
            })),
          },
        ],
        totalItemsCount: items.length,
      });
    });
  } else if (flatItems.length > 0) {
    const storeMap: Record<string, Record<string, any[]>> = {};
    flatItems.forEach((it) => {
      const rawCat = it.storeCategory || 'Store 1';
      let storeName = 'Store 1';
      let catName = 'General Items';

      if (rawCat.includes(' | ')) {
        const parts = rawCat.split(' | ');
        storeName = parts[0]?.trim() || 'Store 1';
        catName = parts[1]?.trim() || 'General Items';
      } else {
        storeName = rawCat;
      }

      if (!storeMap[storeName]) storeMap[storeName] = {};
      if (!storeMap[storeName][catName]) storeMap[storeName][catName] = [];
      storeMap[storeName][catName].push(it);
    });

    Object.keys(storeMap).forEach((stKey) => {
      const categories: ParsedCategoryGroup[] = [];
      Object.keys(storeMap[stKey]).forEach((cKey) => {
        categories.push({
          categoryName: cKey,
          items: storeMap[stKey][cKey].map((it: any) => ({
            itemName: it.itemName || 'Item',
            quantity: Math.max(1, Number(it.quantity) || 1),
            priceNote: it.priceNote || 'Actual store receipt upon purchase',
          })),
        });
      });
      const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
      result.push({
        storeName: stKey,
        categories,
        totalItemsCount: totalItems,
      });
    });
  }

  return result;
};

export default function CustomerChatScreen({
  route,
  navigation,
}: RootStackScreenProps<'CustomerChat'>) {
  const { user, errandId, initialStatus } = (route.params || {
    user: { id: 'test-user', username: 'testuser', firstName: 'Customer', lastName: 'User' },
    errandId: 'PABILI-123456',
    initialStatus: null,
  }) as any;

  const { colors, isDark } = useThemeColor();
  const { width: windowWidth, isTablet, isCompact } = useResponsive();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCircularFallback, setShowCircularFallback] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [dispatcherName, setDispatcherName] = useState<string>('Dispatcher');
  const [showMapModal, setShowMapModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmedPaymentMethod, setConfirmedPaymentMethod] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasHandledRatingPrompt, setHasHandledRatingPrompt] = useState(false);
  const [errandStatus, setErrandStatus] = useState<string | null>(initialStatus || null);
  const [errandData, setErrandData] = useState<any | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(!initialStatus);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState<boolean>(false);

  const handleConfirmOrder = async (messageId: string) => {
    if (isReadOnly || isConfirmingOrder) return;
    setIsConfirmingOrder(true);
    try {
      // 1. Call server confirm-order API
      await apiClient.post(`/errands/${errandId}/confirm-order`, {});

      // 2. Update Firebase RTDB message confirmed state
      const msgRef = ref(database, `chats/${errandId}/messages/${messageId}`);
      await update(msgRef, { confirmed: true });

      // 3. Send confirmation text message to chat
      const messagesRef = ref(database, `chats/${errandId}/messages`);
      push(messagesRef, {
        senderId: String(user?.id || 'customer-1'),
        senderName: user?.firstName || 'Customer',
        role: 'customer',
        type: 'text',
        text: '✅ I have reviewed and approved the order breakdown and upfront delivery fee!',
        timestamp: Date.now(),
      });

      Alert.alert('Order Confirmed', 'Thank you! Your order confirmation has been received by the dispatcher.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to confirm order.');
    } finally {
      setIsConfirmingOrder(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (loading) {
      setShowCircularFallback(false);
      timer = setTimeout(() => {
        setShowCircularFallback(true);
      }, 3000);
    } else {
      setShowCircularFallback(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  const flatListRef = useRef<FlatList>(null);

  const latestPinpoints = useMemo<StorePinpoint[]>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === 'pinpoints' && m.pinpoints && m.pinpoints.length > 0) {
        return m.pinpoints;
      }
    }
    return [];
  }, [messages]);

  useEffect(() => {
    const metaRef = ref(database, `chats/${errandId}/meta`);
    const unsubMeta = onValue(metaRef, (snapshot) => {
      const val = snapshot.val();
      if (val && val.dispatcherName) {
        setDispatcherName(val.dispatcherName);
      }
    });

    const messagesRef = ref(database, `chats/${errandId}/messages`);
    const unsubMessages = onValue(
      messagesRef,
      (snapshot) => {
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
        setConnectionError(false);
      },
      (err) => {
        console.warn('[CustomerChat] Firebase RTDB connection error:', err);
        setLoading(false);
        setConnectionError(true);
      }
    );

    return () => {
      unsubMeta();
      unsubMessages();
    };
  }, [errandId]);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get(`/errands/${errandId}/rating`)
      .then((res) => {
        if (!cancelled && res.data) {
          setHasHandledRatingPrompt(true);
        }
      })
      .catch(() => {
        // Expected if not rated yet
      });

    apiClient
      .get(`/errands/${errandId}`)
      .then((res) => {
        if (!cancelled && res.data) {
          setErrandData(res.data);
          if (res.data.status) {
            setErrandStatus(res.data.status);
          }
        }
      })
      .catch((err) => {
        console.warn('[CustomerChat] Error fetching errand status:', err.message);
      })
      .finally(() => {
        if (!cancelled) {
          setStatusLoading(false);
        }
      });

    let detachSocket: (() => void) | undefined;

    const onOrderUpdated = (updatedErrand: { id?: string; status?: string }) => {
      if (cancelled) return;
      const matches = String(updatedErrand.id ?? '') === String(errandId);
      if (!matches) return;

      if (updatedErrand.status) {
        setErrandStatus(updatedErrand.status);
      }

      if (updatedErrand.status === 'DELIVERED') {
        setHasHandledRatingPrompt((already) => {
          if (already) return already;
          setShowRatingModal(true);
          return true;
        });
      }
    };

    void getSocket().then((socket) => {
      socket.on('order:updated', onOrderUpdated);
      detachSocket = () => socket.off('order:updated', onOrderUpdated);
    });

    return () => {
      cancelled = true;
      detachSocket?.();
    };
  }, [errandId]);

  // Read-only once a rider is ASSIGNED, or if DELIVERED / CANCELLED / COMPLETED
  const isReadOnly = ['CANCELLED', 'DELIVERED', 'ASSIGNED', 'COMPLETED'].includes(
    String(errandStatus || '').toUpperCase()
  );

  const handleSendMessage = () => {
    if (isReadOnly || statusLoading) {
      Alert.alert('Read-Only Errand', 'This chat session is archived and read-only. No further messages can be sent.');
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed) return;

    const messagesRef = ref(database, `chats/${errandId}/messages`);
    push(messagesRef, {
      senderId: String(user.id),
      senderName: user.firstName || 'Customer',
      role: 'customer',
      type: 'text',
      text: trimmed,
      timestamp: Date.now(),
    });

    setInputText('');
  };

  const handlePaymentConfirmed = (methodLabel: string) => {
    if (isReadOnly) {
      Alert.alert('Payment Selection Closed', 'This errand is completed or archived. Payment mode selection is closed.');
      return;
    }

    setConfirmedPaymentMethod(methodLabel);
    setShowPaymentModal(false);

    const messagesRef = ref(database, `chats/${errandId}/messages`);
    push(messagesRef, {
      senderId: String(user.id),
      senderName: user.firstName || 'Customer',
      role: 'customer',
      type: 'text',
      text: `✅ Payment mode confirmed: ${methodLabel}`,
      timestamp: Date.now(),
    });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setLoading(true);
    const messagesRef = ref(database, `chats/${errandId}/messages`);
    onValue(
      messagesRef,
      (snapshot) => {
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
        setRefreshing(false);
      },
      { onlyOnce: true }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        {/* 1. MODERN TOP NAV HEADER */}
        <View style={[styles.navHeaderRow, { borderBottomColor: colors.border, backgroundColor: colors.bgApp }]}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CustomerPortal', {
                user,
                initialTab: 'chat',
              })
            }
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
            testID="back-button"
          >
            <ChevronLeft size={22} color={colors.textDark} />
          </TouchableOpacity>

          {/* DISPATCHER AVATAR & INFO */}
          <View style={styles.navTitleCenter}>
            <View style={styles.navHeaderProfile}>
              <View style={[styles.avatarCircle, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3' }]}>
                <Headphones size={16} color={colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={[styles.navTitle, { color: colors.textDark }]} numberOfLines={1}>
                  {dispatcherName || 'Dispatcher'}
                </Text>
                <Text style={[styles.navSubtitle, { color: colors.textGray }]}>
                  #{formatErrandId(errandId)}
                </Text>
              </View>
            </View>
          </View>

          {/* RIGHT ACTION ICONS */}
          <View style={styles.navRightActions}>
            {latestPinpoints.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.actionIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
                onPress={() => setShowMapModal(true)}
              >
                <MapPin size={16} color={colors.primary} />
              </TouchableOpacity>
            )}

            {errandData && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.actionIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}
                onPress={() => setShowDetailsModal(true)}
              >
                <Info size={16} color={colors.textDark} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. CONTEXTUAL ERRAND RIBBON */}
        {errandStatus && (
          <View style={[styles.orderRibbon, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={styles.ribbonLeft}>
              <Package size={13} color={colors.primary} />
              <Text style={[styles.ribbonText, { color: colors.textDark }]} numberOfLines={1}>
                {errandData?.categories ? errandData.categories : `Pabili Errand #${formatErrandId(errandId)}`}
              </Text>
            </View>
            <StatusBadge status={errandStatus} />
          </View>
        )}

        {/* 3. MESSAGES LIST */}
        {connectionError ? (
          <View
            style={[
              styles.errorContainer,
              { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2', borderColor: colors.danger },
            ]}
            testID="chat-connection-error-banner"
          >
            <WifiOff size={30} color={colors.danger} strokeWidth={2} />
            <Text style={[styles.errorTitle, { color: colors.danger }]}>Chat Connection Dropped</Text>
            <Text style={[styles.errorSubtitle, { color: colors.textGray }]}>
              Lost connection to live dispatch server. Tap below to re-connect.
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.refreshBtnDanger, { backgroundColor: colors.danger }]}
              onPress={handleRefresh}
              testID="tap-to-refresh-chat-connection-btn"
            >
              <RotateCw size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.refreshBtnTextWhite}>Tap to Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          showCircularFallback ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textGray }]}>Connecting to live chat...</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.refreshBtn,
                  { backgroundColor: isDark ? colors.card : colors.bgGray, borderColor: colors.border, marginTop: Spacing.md },
                ]}
                onPress={handleRefresh}
              >
                <RotateCw size={14} color={colors.primary} />
                <Text style={[styles.refreshBtnText, { color: colors.primary }]}>Tap to Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ChatMessagesSkeleton />
          )
        ) : messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={[styles.emptyChatCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6' }]}>
              <Headphones size={28} color={colors.textLight} />
            </View>
            <Text style={[styles.emptyText, { color: colors.textDark }]}>Live Dispatcher Connected</Text>
            <Text style={[styles.emptySubtext, { color: colors.textGray }]}>
              Send a message below to clarify items, prices, or store preferences.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => {
              const isCustomer = item.role === 'customer';
              const isPinpoints = item.type === 'pinpoints' && item.pinpoints && item.pinpoints.length > 0;
              const isPaymentPrompt = item.type === 'payment_prompt';
              const isOrderConfirmation = item.type === 'order_confirmation';

              if (isOrderConfirmation) {
                const parsedStoreGroups = parseOrderConfirmationTree(item);

                return (
                  <View style={[styles.messageBubbleContainer, styles.dispatcherBubbleAlign, { maxWidth: '96%', width: '96%' }]}>
                    <Text style={[styles.senderLabel, { color: colors.textGray }]}>
                      {item.senderName || 'Dispatcher'}
                    </Text>

                    <View style={[styles.orderConfirmCard, Shadows.soft]}>
                      {/* HEADER */}
                      <View style={styles.orderConfirmHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <ClipboardCheck size={16} color="#FFFFFF" strokeWidth={2.2} />
                          <View>
                            <Text style={styles.orderConfirmTitle}>ORDER CONFIRMATION CARD</Text>
                            <Text style={styles.orderConfirmSubtitle}>Store Pinpoint & Category Breakdown</Text>
                          </View>
                        </View>
                        {item.confirmed ? (
                          <View style={styles.confirmedPill}>
                            <CheckCircle2 size={11} color="#10B981" strokeWidth={2.5} />
                            <Text style={styles.confirmedPillText}>Approved ✓</Text>
                          </View>
                        ) : (
                          <View style={styles.pendingPill}>
                            <Clock size={11} color="#F59E0B" strokeWidth={2.5} />
                            <Text style={styles.pendingPillText}>Action Required</Text>
                          </View>
                        )}
                      </View>

                      {/* BODY: 4-TIER HIERARCHY */}
                      {/* Store Pinpoints > Merchant Categories > Item(s) > Quantity */}
                      <View style={styles.orderConfirmBody}>
                        {parsedStoreGroups.length === 0 ? (
                          <View style={styles.storeGroupCard}>
                            {(item.items || []).map((it: any, idx: number) => (
                              <View key={idx} style={styles.storeGroupItemRow}>
                                <Text style={styles.storeGroupItemName}>
                                  • {it.itemName} <Text style={{ fontFamily: FontFamily.bold }}>x{it.quantity}</Text>
                                </Text>
                                <Text style={styles.storeGroupItemNote}>Actual store receipt upon purchase</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          parsedStoreGroups.map((storeGroup, sIdx) => (
                            <View key={sIdx} style={styles.storeGroupCard}>
                              {/* Level 1: Store Pinpoint Header */}
                              <View style={styles.storeGroupHeader}>
                                <Store size={13} color="#DC2626" strokeWidth={2.2} />
                                <Text style={styles.storeGroupName}>{storeGroup.storeName}</Text>
                                <View style={styles.storeItemsCountPill}>
                                  <Text style={styles.storeItemsCountText}>
                                    {storeGroup.totalItemsCount} {storeGroup.totalItemsCount === 1 ? 'item' : 'items'}
                                  </Text>
                                </View>
                              </View>

                              {/* Level 2: Merchant Categories */}
                              <View style={{ gap: 6, marginTop: 2 }}>
                                {storeGroup.categories.map((catGroup, cIdx) => (
                                  <View key={cIdx} style={styles.categorySection}>
                                    <View style={styles.categoryHeader}>
                                      <Text style={styles.categoryTitle}>📁 {catGroup.categoryName}</Text>
                                      <Text style={styles.categoryItemCount}>
                                        {catGroup.items.length} {catGroup.items.length === 1 ? 'item' : 'items'}
                                      </Text>
                                    </View>

                                    {/* Level 3 & Level 4: Items & Quantity */}
                                    <View style={styles.storeGroupItemsList}>
                                      {catGroup.items.map((gItem, gIdx) => (
                                        <View key={gIdx} style={styles.storeGroupItemRow}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                                            <Text style={styles.storeGroupItemName}>• {gItem.itemName}</Text>
                                            <View style={styles.quantityBadge}>
                                              <Text style={styles.quantityBadgeText}>x{gItem.quantity}</Text>
                                            </View>
                                          </View>
                                          <Text style={styles.storeGroupItemNote}>
                                            {gItem.priceNote || 'Actual store receipt'}
                                          </Text>
                                        </View>
                                      ))}
                                    </View>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ))
                        )}

                        {/* THE FULL FEE BREAKDOWN, FROM THE SERVER.
                            This used to show a single "Delivery Fee (Upfront
                            Fixed)" line, falling back to ₱50, plus a multi-store
                            surcharge the screen computed itself at a hardcoded
                            ₱30 per extra store. Both went stale the moment the
                            owner edited a rate, and neither showed the handling
                            or online-payment fees at all. */}
                        <View style={[styles.deliveryFeeRow, { flexDirection: 'column', alignItems: 'stretch', gap: 4 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Receipt size={14} color="#1E3A5F" strokeWidth={2.2} />
                            <Text style={styles.deliveryFeeLabel}>Price Breakdown</Text>
                          </View>
                          <FeeBreakdownCard breakdown={(item as any).feeBreakdown ?? null} testIDPrefix={`chat-fee-${item.id}`} />
                          <Text style={{ fontSize: 9.5, color: colors.textGray, fontStyle: 'italic', marginTop: 2 }}>
                            Note: Retail/grocery items are paid based on the actual physical store receipt upon delivery.
                          </Text>
                        </View>

                        {/* CUSTOMER CTA OR CONFIRMED BADGE */}
                        {item.confirmed ? (
                          <View style={styles.confirmedStatusRow}>
                            <CheckCircle2 size={15} color="#10B981" strokeWidth={2.5} />
                            <Text style={styles.confirmedStatusText}>Breakdown Approved by You ✓</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            style={styles.confirmOrderCta}
                            disabled={isReadOnly || isConfirmingOrder}
                            onPress={() => handleConfirmOrder(item.id)}
                          >
                            {isConfirmingOrder ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <CheckCircle2 size={15} color="#FFFFFF" strokeWidth={2.5} />
                                <Text style={styles.confirmOrderCtaText}>Approve & Confirm Order Breakdown ✓</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <Text style={[styles.timeLabel, { color: colors.textLight }]}>{formatTime(item.timestamp)}</Text>
                  </View>
                );
              }

              /* AUTOMATED MESSAGES
                 Rendered as full-width notices rather than chat bubbles.
                 A bubble implies someone said it, and attributing "your errand
                 was cancelled" to a person the customer has never spoken to
                 reads as colder than the plain fact. These are the errand
                 narrating itself, so they sit centred and unattributed, tinted
                 by what they mean: green for accepted, amber for in-progress,
                 red for declined. */
              if (item.type === 'system') {
                const kind = String(item.systemKind || '');
                const tone =
                  kind === 'accepted'
                    ? { bg: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5', border: '#A7F3D0', accent: '#059669', Icon: CheckCircle2 }
                    : kind === 'declined'
                    ? { bg: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2', border: '#FECACA', accent: '#DC2626', Icon: XCircle }
                    : kind === 'under_review'
                    ? { bg: isDark ? 'rgba(217,119,6,0.12)' : '#FFFBEB', border: '#FDE68A', accent: '#D97706', Icon: Clock }
                    : { bg: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', border: colors.border, accent: colors.primary, Icon: ReceiptText };
                const ToneIcon = tone.Icon;

                const heading =
                  kind === 'order_submitted'
                    ? 'Your errand request'
                    : kind === 'under_review'
                    ? 'Under review'
                    : kind === 'accepted'
                    ? 'Errand accepted'
                    : 'Errand cancelled';

                return (
                  <View style={styles.systemNoticeWrapper}>
                    <View
                      style={[
                        styles.systemNoticeCard,
                        { backgroundColor: tone.bg, borderColor: tone.border },
                      ]}
                    >
                      <View style={styles.systemNoticeHeader}>
                        <ToneIcon size={14} color={tone.accent} strokeWidth={2.4} />
                        <Text style={[styles.systemNoticeHeading, { color: tone.accent }]}>
                          {heading}
                        </Text>
                        <Text style={[styles.systemNoticeTime, { color: colors.textLight }]}>
                          {formatTime(item.timestamp)}
                        </Text>
                      </View>
                      <Text style={[styles.systemNoticeBody, { color: colors.textDark }]}>
                        {item.text}
                      </Text>
                    </View>
                  </View>
                );
              }

              if (item.type === 'item_deleted' || (typeof item.text === 'string' && item.text.startsWith('🗑️'))) {
                return (
                  <View style={[styles.messageBubbleContainer, styles.dispatcherBubbleAlign, { maxWidth: '96%', width: '96%' }]}>
                    <View style={styles.itemDeletedCard}>
                      <View style={styles.itemDeletedIconCircle}>
                        <Trash2 size={14} color="#DC2626" strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.itemDeletedHeaderTitle}>Item Removed from Order</Text>
                          <Text style={[styles.timeLabel, { color: '#DC2626', marginHorizontal: 0, marginTop: 0 }]}>
                            {formatTime(item.timestamp)}
                          </Text>
                        </View>
                        <Text style={styles.itemDeletedBodyText}>{item.text}</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View
                  style={[
                    styles.messageBubbleContainer,
                    isCustomer ? styles.customerBubbleAlign : styles.dispatcherBubbleAlign,
                  ]}
                >
                  <Text style={[styles.senderLabel, { color: colors.textGray }]}>
                    {isCustomer ? 'You' : item.senderName || 'Dispatcher'}
                  </Text>

                  <View
                    style={[
                      styles.bubble,
                      isCustomer
                        ? [styles.customerBubble, { backgroundColor: colors.primary }]
                        : [
                            styles.dispatcherBubble,
                            {
                              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                              borderColor: colors.border,
                            },
                          ],
                      Shadows.soft,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        { color: isCustomer ? '#FFFFFF' : colors.textDark },
                      ]}
                    >
                      {item.text}
                    </Text>

                    {/* PINPOINTS ATTACHMENT */}
                    {isPinpoints && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.pinMessageAction,
                          { backgroundColor: isCustomer ? 'rgba(255,255,255,0.2)' : colors.primary },
                        ]}
                        onPress={() => setShowMapModal(true)}
                      >
                        <MapPin size={13} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.pinMessageActionText}>View Store Pins on Map</Text>
                      </TouchableOpacity>
                    )}

                    {/* PAYMENT MODE PROMPT ACTION */}
                    {isPaymentPrompt && (
                      <TouchableOpacity
                        testID="open-payment-modal"
                        activeOpacity={0.8}
                        style={[
                          styles.pinMessageAction,
                          {
                            backgroundColor: isReadOnly || !!confirmedPaymentMethod ? '#6B7280' : colors.primary,
                          },
                        ]}
                        onPress={() => {
                          if (isReadOnly) {
                            Alert.alert(
                              'Payment Selection Closed',
                              'This errand is completed or archived. Payment mode selection is closed.'
                            );
                            return;
                          }
                          setShowPaymentModal(true);
                        }}
                        disabled={isReadOnly || !!confirmedPaymentMethod}
                      >
                        <CreditCard size={13} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.pinMessageActionText}>
                          {confirmedPaymentMethod
                            ? `Confirmed: ${confirmedPaymentMethod}`
                            : isReadOnly
                            ? 'Payment Mode Finalized'
                            : 'Choose Payment Mode'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={[styles.timeLabel, { color: colors.textLight }]}>{formatTime(item.timestamp)}</Text>
                </View>
              );
            }}
          />
        )}

        {/* 4. INPUT BAR OR ARCHIVED NOTICE */}
        {isReadOnly ? (
          <View style={[styles.readOnlyNotice, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <Text style={[styles.readOnlyNoticeText, { color: colors.textGray }]}>
              🔒 This errand session is completed. Chat is read-only.
            </Text>
          </View>
        ) : statusLoading ? (
          <View
            style={[
              styles.readOnlyNotice,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.readOnlyNoticeText, { color: colors.textGray }]}>
              Checking session status...
            </Text>
          </View>
        ) : (
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray,
                  borderColor: colors.border,
                  color: colors.textDark,
                },
              ]}
              placeholder="Type your message or item request..."
              placeholderTextColor={colors.textLight}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity
              testID="send-message-button"
              activeOpacity={0.8}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
                (!inputText.trim() || isReadOnly || statusLoading) && { opacity: 0.4 },
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isReadOnly || statusLoading}
            >
              <Send size={16} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {/* MODALS */}
        <MapPreviewField
          controlled={{ visible: showMapModal, onClose: () => setShowMapModal(false) }}
          center={latestPinpoints[0] ? sanitizeCoordinate(latestPinpoints[0]) : null}
          modalTitle="Dispatcher Store Pinpoints"
          label="Dispatcher Store Pinpoints"
          markers={latestPinpoints.map((p, idx) => ({
            key: String(idx),
            coordinate: sanitizeCoordinate(p),
            title: `Store #${idx + 1}: ${p.storeName || 'Store'}`,
            description: 'Pinpointed by Dispatcher',
            pinColor: 'red',
          }))}
        />

        <ErrandDetailsModal
          visible={showDetailsModal}
          errand={errandData}
          user={user}
          navigation={navigation}
          onClose={() => setShowDetailsModal(false)}
        />

        <PaymentModeSelectionModal
          visible={showPaymentModal}
          errandId={errandId}
          onClose={() => setShowPaymentModal(false)}
          onConfirmed={handlePaymentConfirmed}
        />

        <RatingModal visible={showRatingModal} errandId={errandId} onDone={() => setShowRatingModal(false)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  systemNoticeWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 6,
  },
  systemNoticeCard: {
    width: '94%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  systemNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  systemNoticeHeading: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  systemNoticeTime: {
    fontFamily: FontFamily.regular,
    fontSize: 9.5,
  },
  systemNoticeBody: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    lineHeight: 19,
  },
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
  navTitleCenter: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  navHeaderProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextCol: {
    flex: 1,
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.3),
  },
  navSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(11, 0.3),
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: Spacing.sm,
  },
  ribbonText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyChatCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorContainer: {
    flex: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
  },
  errorSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  refreshBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  refreshBtnTextWhite: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    marginTop: Spacing.sm,
    fontSize: FontSizes.xs,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  refreshBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
  },
  messagesList: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  messageBubbleContainer: {
    marginBottom: Spacing.sm + 2,
    maxWidth: '82%',
  },
  customerBubbleAlign: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  dispatcherBubbleAlign: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    marginBottom: 2,
    marginHorizontal: 4,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
  },
  customerBubble: {
    borderBottomRightRadius: 2,
  },
  dispatcherBubble: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  messageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 1,
    lineHeight: 18,
  },
  pinMessageAction: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    borderRadius: BorderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pinMessageActionText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  timeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    marginTop: 2,
    marginHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  readOnlyNotice: {
    padding: Spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyNoticeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    fontSize: FontSizes.xs + 1,
    minHeight: 38,
    maxHeight: 90,
    textAlignVertical: 'center',
    fontFamily: FontFamily.regular,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderConfirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#1E3A5F',
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
  },
  orderConfirmHeader: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderConfirmTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  orderConfirmSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    color: '#93C5FD',
  },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  confirmedPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#10B981',
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  pendingPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#F59E0B',
  },
  orderConfirmBody: {
    padding: Spacing.sm + 2,
    gap: 8,
  },
  storeGroupCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 6,
  },
  storeGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
  },
  storeGroupName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
    color: '#1E3A5F',
    flex: 1,
  },
  storeItemsCountPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  storeItemsCountText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#1E3A5F',
  },
  categorySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    gap: 4,
    marginTop: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 3,
    marginBottom: 2,
  },
  categoryTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs - 2,
    color: '#1E3A5F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryItemCount: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#64748B',
  },
  quantityBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  quantityBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#1E3A5F',
  },
  storeGroupItemsList: {
    gap: 4,
    paddingLeft: 4,
  },
  storeGroupItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  storeGroupItemName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSizes.xs - 1,
    color: '#334155',
  },
  storeGroupItemNote: {
    fontFamily: FontFamily.regular,
    fontSize: 9,
    fontStyle: 'italic',
    color: '#64748B',
  },
  deliveryFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  deliveryFeeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
    color: '#1E3A5F',
  },
  deliveryFeeValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
    color: '#1E3A5F',
  },
  confirmOrderCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: BorderRadius.sm + 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  confirmOrderCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
  },
  confirmedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    marginTop: 2,
  },
  confirmedStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs,
    color: '#065F46',
  },
  itemDeletedCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 3,
    marginBottom: 3,
  },
  itemDeletedIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  itemDeletedHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs - 1,
    color: '#991B1B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemDeletedBodyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 16,
  },
});
