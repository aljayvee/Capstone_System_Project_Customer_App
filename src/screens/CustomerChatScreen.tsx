import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Expo SDK 54+ forces edge-to-edge on Android, which makes the manifest's
// windowSoftInputMode="adjustResize" inert: the window no longer shrinks when the
// keyboard opens, so React Native's own KeyboardAvoidingView has nothing to react
// to and the composer stays underneath the keyboard. This one is driven by the
// real IME frame reported by KeyboardProvider (mounted in AppNavigator), which is
// what makes the composer ride the keyboard the way Messenger's does.
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ref, push, onValue, update } from 'firebase/database';
import { getSocket, subscribeToErrand, unsubscribeFromErrand } from '../services/socketClient';
import { showAppAlert } from '../services/alertModal';
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
  Store,
  Receipt,
  CheckCircle2,
  Clock,
  Trash2,
  XCircle,
  ReceiptText,
  ArrowDown,
  X,
  Pencil,
  ChevronDown,
  ChevronUp,
  FolderOpen,
} from 'lucide-react-native';
import { ChatMessagesSkeleton } from '../components/ChatSkeleton';
import { database } from '../firebase/config';
import { ensureRealtimeSession, renewRealtimeSession } from '../firebase/realtimeSession';
import { useNetworkStatus } from '../context/NetworkContext';
import { RootStackScreenProps } from '../navigation/types';
import MapPreviewField from '../components/MapPreviewField';
import ErrandDetailsModal from '../components/ErrandDetailsModal';
import DispatcherAvatar from '../components/DispatcherAvatar';
import { PaymentModeSelectionModal } from '../components/PaymentModeSelectionModal';
import { labelForMode } from '../services/paymentMethodStrategy';
import { RatingModal } from '../components/RatingModal';
import StatusBadge from '../components/StatusBadge';
import TypingIndicator from '../components/TypingIndicator';
import { useChatPresence } from '../hooks/useChatPresence';
import { setActiveChatErrandId } from '../utils/activeChatTracker';
import { apiClient } from '../services/apiClient';
import { toUserMessage, RETRY_LABEL } from '../services/errorMessages';
import { sanitizeCoordinate } from '../utils/coords';
import { useThemeColor } from '../hooks/useThemeColor';
import { formatErrandId } from '../utils/formatErrandId';
import { extractMerchantCategories } from '../utils/merchantCategories';
import FeeBreakdownCard from '../components/FeeBreakdownCard';
import PaymentProofUpload from '../components/PaymentProofUpload';
import {
  FontFamily,
  FontSizes,
  Spacing,
  BorderRadius,
  Shadows,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';

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
  type?:
    | 'text'
    | 'pinpoints'
    | 'payment_prompt'
    | 'order_confirmation'
    | 'item_deleted'
    | 'system'
    // The dispatcher asking for the 50%, and showing where the receipt goes.
    | 'half_payment_request'
    | 'payment_proof_request';
  /** Set on `system` messages. `item_revision` is the one you can answer. */
  systemKind?: string;
  text: string;
  pinpoints?: StorePinpoint[];
  items?: Array<{ itemName: string; storeCategory?: string; quantity: number }>;
  groupedItems?: any;
  storeGroups?: any[];
  deliveryFee?: number;
  totalCost?: number;
  confirmed?: boolean;
  /**
   * Stamped on the order summary by this app once a way to pay is chosen
   * (2026-10-15). The dispatcher's screen reads it as the cue to fetch the
   * choice from the server; it is never the record itself.
   */
  paymentMethod?: string;
  paymentChosenAt?: number;
  revisionId?: string;
  revision?: {
    items: Array<{
      itemName: string;
      storeCategory?: string;
      quantity: number;
      previousQuantity?: number;
      available: boolean;
      note?: string;
    }>;
  };
  status?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
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
        categories.push({
          categoryName: 'General Items',
          items: storeVal.map((it: any) => ({
            itemName: it.itemName || 'Item',
            quantity: Math.max(1, Number(it.quantity) || 1),
            priceNote: it.priceNote || '',
          })),
        });
      } else if (storeVal && typeof storeVal === 'object') {
        Object.keys(storeVal).forEach((catKey) => {
          const catVal = storeVal[catKey];
          const itemList: any[] = Array.isArray(catVal) ? catVal : [];
          categories.push({
            categoryName: catKey,
            items: itemList.map((it: any) => ({
              itemName: it.itemName || 'Item',
              quantity: Math.max(1, Number(it.quantity) || 1),
              priceNote: it.priceNote || '',
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
              priceNote: it.priceNote || '',
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
            priceNote: it.priceNote || '',
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

const REVISION_DECLINE_PRESETS = [
  'Skip unavailable items',
  'Suggest another brand/size',
  'Reduce the quantity',
  'Cancel the errand order',
];

const extractRevisionNote = (item: ChatMessage): string | null => {
  if ((item.revision as any)?.note) {
    const n = String((item.revision as any).note).trim();
    if (n) return n;
  }
  if (typeof item.text === 'string' && item.text) {
    const rawLines = item.text.split('\n').map((l) => l.trim()).filter(Boolean);
    const customLines = rawLines.filter((line) => {
      if (line === 'ITEM CHECK') return false;
      if (line.startsWith('Not available:')) return false;
      if (line.startsWith('Still going ahead:')) return false;
      if (line.startsWith('•')) return false;
      if (line.startsWith('Approve this and I will carry on')) return false;
      return true;
    });
    if (customLines.length > 0) {
      return customLines.join('\n');
    }
  }
  return null;
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
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCircularFallback, setShowCircularFallback] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  // Bumped by "Try again" to tear the chat listeners down and open them afresh.
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  // Whether the listener now open came from a renewed Firebase session. A
  // refusal after one is shown; a refusal before one is renewed silently first.
  const renewedRef = useRef(false);
  const { isConnected, reconnectCount } = useNetworkStatus();
  const [dispatcherName, setDispatcherName] = useState<string>('Dispatcher');
  const [dispatcherId, setDispatcherId] = useState<string | number | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [confirmedPaymentMethod, setConfirmedPaymentMethod] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasHandledRatingPrompt, setHasHandledRatingPrompt] = useState(false);
  const [errandStatus, setErrandStatus] = useState<string | null>(initialStatus || null);
  const [errandData, setErrandData] = useState<any | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(!initialStatus);
  const [isConfirmingOrder, setIsConfirmingOrder] = useState<boolean>(false);
  const [respondingRevisionId, setRespondingRevisionId] = useState<string | null>(null);
  const [selectedRevisionForDecline, setSelectedRevisionForDecline] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState<string>('');
  const declineReasonTextRef = useRef<string>('');
  const [isSubmittingDecline, setIsSubmittingDecline] = useState<boolean>(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isOrderSummaryExpanded, setIsOrderSummaryExpanded] = useState<boolean>(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Suppress foreground notifications/banners for this active chat while the customer is on this screen
  useEffect(() => {
    if (errandId) {
      setActiveChatErrandId(errandId);
    }
    return () => {
      setActiveChatErrandId(null);
    };
  }, [errandId]);

  const updateDeclineReason = (text: string) => {
    declineReasonTextRef.current = text;
    setDeclineReasonText(text);
  };

  // REAL-TIME PRESENCE & TYPING HOOK
  const customerDisplayName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Customer';
  const { otherPresence, otherTyping, broadcastTyping } = useChatPresence({
    errandId,
    userRole: 'customer',
    userName: customerDisplayName,
    userId: user?.id,
  });

  const flatListRef = useRef<FlatList>(null);
  const [unreadNewCount, setUnreadNewCount] = useState<number>(0);
  const isScrolledUpRef = useRef<boolean>(false);
  const previousMessageCountRef = useRef<number>(0);
  const isInitialMountRef = useRef<boolean>(true);

  // Opening the keyboard shrinks the list's viewport without changing its
  // content, so onContentSizeChange never fires and the newest bubble is left
  // sitting behind the composer. Re-anchor once per keyboard show instead of on
  // every layout pass: scrollToEnd itself triggers a layout, so keying this off
  // onLayout feeds back into itself. Honours the same "unless the user scrolled
  // up to read history" rule the content-size handler uses.
  useEffect(() => {
    if (!keyboardVisible || isScrolledUpRef.current) return;
    // Lets the keyboard's open animation apply its padding before we measure.
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [keyboardVisible]);

  const scrollToLatest = () => {
    setUnreadNewCount(0);
    isScrolledUpRef.current = false;
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 70;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    isScrolledUpRef.current = !isAtBottom;
    if (isAtBottom && unreadNewCount > 0) {
      setUnreadNewCount(0);
    }
  };

  const handleRespondToRevision = async (
    messageId: string,
    decision: 'approved' | 'rejected',
    reason?: string
  ) => {
    if (isOrderLocked || respondingRevisionId) return;
    setRespondingRevisionId(messageId);
    try {
      const msgRef = ref(database, `chats/${errandId}/messages/${messageId}`);
      await update(msgRef, {
        status: decision,
        rejectionReason: decision === 'rejected' ? (reason ?? null) : null,
      });

      await push(ref(database, `chats/${errandId}/messages`), {
        senderId: String(user?.id || 'customer-1'),
        senderName: user?.firstName || 'Customer',
        role: 'customer',
        type: 'text',
        text:
          decision === 'approved'
            ? '✅ Yes, go ahead with those changes.'
            : `❌ I have declined these changes.${reason ? ` Note: "${reason}"` : ''}`,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      showAppAlert("Answer not sent", toUserMessage(err, 'chat'));
    } finally {
      setRespondingRevisionId(null);
    }
  };

  const promptRejectRevision = (messageId: string) => {
    setSelectedRevisionForDecline(messageId);
    updateDeclineReason('');
  };

  const handleConfirmDeclineRevision = async () => {
    if (!selectedRevisionForDecline || isSubmittingDecline) return;
    const reasonToSend = (declineReasonTextRef.current || declineReasonText || '').trim();
    setIsSubmittingDecline(true);
    try {
      await handleRespondToRevision(selectedRevisionForDecline, 'rejected', reasonToSend || undefined);
      setSelectedRevisionForDecline(null);
      updateDeclineReason('');
    } catch (err) {
      console.warn('[CustomerChat] Error declining revision:', err);
    } finally {
      setIsSubmittingDecline(false);
    }
  };

  const handleConfirmOrder = async (messageId: string) => {
    if (isOrderLocked || isConfirmingOrder) return;
    setIsConfirmingOrder(true);
    try {
      await apiClient.post(`/errands/${errandId}/confirm-order`, {});

      const msgRef = ref(database, `chats/${errandId}/messages/${messageId}`);
      await update(msgRef, { confirmed: true });

      const messagesRef = ref(database, `chats/${errandId}/messages`);
      push(messagesRef, {
        senderId: String(user?.id || 'customer-1'),
        senderName: user?.firstName || 'Customer',
        role: 'customer',
        type: 'text',
        text: '✅ I have reviewed and approved the order breakdown and upfront delivery fee!',
        timestamp: Date.now(),
      });

      // Approving leads straight to choosing how to pay (2026-10-15). There
      // is no separate payment card in the chat any more. Approving again
      // after a changed list does not ask twice.
      if (chosenPaymentMethod) {
        showAppAlert({
          title: 'Order Confirmed',
          message: 'Thank you! Your order confirmation has been received by the dispatcher.',
          variant: 'success',
        });
      } else {
        setShowPaymentModal(true);
      }
    } catch (err: any) {
      showAppAlert("Confirmation not sent", toUserMessage(err, 'errand'));
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
    let cancelled = false;
    let unsubMeta: (() => void) | undefined;
    let unsubMessages: (() => void) | undefined;

    // A listener opened before the Firebase session exists is refused and stays
    // refused for the life of the screen (see realtimeSession.ts), so the
    // session is settled first. Subscribed whatever the outcome: if there is
    // still no session, the refusal below is what raises the banner, and "Try
    // again" comes back through here to mint one.
    void ensureRealtimeSession().then(() => {
      if (cancelled) return;

      const metaRef = ref(database, `chats/${errandId}/meta`);
      unsubMeta = onValue(metaRef, (snapshot) => {
        const val = snapshot.val();
        if (val && val.dispatcherName) {
          setDispatcherName(val.dispatcherName);
        }
        if (val && val.dispatcherId) {
          setDispatcherId(val.dispatcherId);
        }
      });

      const messagesRef = ref(database, `chats/${errandId}/messages`);
      unsubMessages = onValue(
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
          setConnectionError(false);
          renewedRef.current = false;
        },
        (err) => {
          console.warn('[CustomerChat] Firebase RTDB connection error:', err);
          if (cancelled) return;
          // A refusal, never the network: offline, RTDB waits and resyncs
          // without calling this. The identity it refused is usually one whose
          // ID token expired while the phone slept, still reported as signed
          // in, so the first refusal renews it and reopens the chat unseen.
          if (!renewedRef.current) {
            renewedRef.current = true;
            void renewRealtimeSession().then(() => {
              if (!cancelled) setSubscriptionAttempt((attempt) => attempt + 1);
            });
            return;
          }
          setLoading(false);
          setRefreshing(false);
          setConnectionError(true);
        }
      );
    });

    return () => {
      cancelled = true;
      unsubMeta?.();
      unsubMessages?.();
    };
  }, [errandId, subscriptionAttempt]);

  // Track incoming messages: auto-scroll if at bottom, or increment unreadNewCount if scrolled up
  useEffect(() => {
    if (messages.length === 0) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousMessageCountRef.current = messages.length;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 120);
      return;
    }

    const newMessagesAdded = messages.length - previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (newMessagesAdded > 0) {
      const latestMsg = messages[messages.length - 1];
      const isFromOther =
        latestMsg &&
        (latestMsg.role === 'dispatcher' ||
          (latestMsg.senderId && String(latestMsg.senderId) !== String(user?.id)));

      if (isFromOther) {
        // Haptic feedback for tactile alert
        try {
          Vibration.vibrate([0, 150, 100, 150]);
        } catch {
          // Fallback if vibration unavailable
        }

        // Audible chime via local notification
        Promise.all([
          AsyncStorage.getItem('@sugo_customer_sounds_enabled'),
          AsyncStorage.getItem('@sugo_customer_chat_alerts_enabled'),
        ])
          .then(([storedSounds, storedChats]) => {
            const soundsEnabled = storedSounds !== 'false';
            const chatAlertsEnabled = storedChats !== 'false';
            if (soundsEnabled && chatAlertsEnabled) {
              void Notifications.scheduleNotificationAsync({
                content: {
                  title: latestMsg.senderName || 'Dispatcher',
                  body: latestMsg.text || 'New message received',
                  sound: 'default',
                  data: { errandId, type: 'CHAT_MESSAGE' },
                  ...(Platform.OS === 'android' ? { channelId: 'chats' } : {}),
                },
                trigger: null,
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      if (isScrolledUpRef.current) {
        setUnreadNewCount((prev) => prev + newMessagesAdded);
      } else {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    }
  }, [messages, user?.id, errandId]);

  useEffect(() => {
    let cancelled = false;

    if (typeof subscribeToErrand === 'function') {
      void subscribeToErrand(errandId);
    }

    // Concurrently fetch rating check and errand status
    Promise.all([
      apiClient.get(`/errands/${errandId}/rating`).catch(() => ({ data: null })),
      apiClient.get(`/errands/${errandId}`).catch((err) => {
        console.warn('[CustomerChat] Error fetching errand status:', err.message);
        return null;
      }),
    ])
      .then(([ratingRes, errandRes]) => {
        if (cancelled) return;
        const existingRating = ratingRes?.data;
        if (existingRating) {
          setHasHandledRatingPrompt(true);
        }

        if (errandRes?.data) {
          setErrandData(errandRes.data);
          const status = String(errandRes.data.status || '').toUpperCase();
          if (status) {
            setErrandStatus(status);
          }
          if (status === 'DELIVERED' && !existingRating) {
            setHasHandledRatingPrompt((already) => {
              if (already) return already;
              setShowRatingModal(true);
              return true;
            });
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatusLoading(false);
        }
      });

    let detachSocket: (() => void) | undefined;

    // The errand, payment plan included, fetched again. This screen used to
    // load it once on open: the plan the dispatcher confirmed, or the rider's
    // request for the half, never reached it until the chat was reopened.
    const reloadErrand = () => {
      apiClient
        .get(`/errands/${errandId}`)
        .then((res) => {
          if (cancelled || !res?.data) return;
          setErrandData(res.data);
          const status = String(res.data.status || '').toUpperCase();
          if (status) setErrandStatus(status);
        })
        .catch(() => {
          // A missed refresh leaves the last good copy on screen; the next
          // event or reopen brings it current.
        });
    };

    const onPaymentEvent = (payload: { errandId?: string } | undefined) => {
      if (cancelled || String(payload?.errandId ?? '') !== String(errandId)) return;
      reloadErrand();
    };

    const onOrderUpdated = (updatedErrand: { id?: string; status?: string }) => {
      if (cancelled) return;
      const matches =
        String(updatedErrand.id ?? '') === String(errandId) ||
        formatErrandId(updatedErrand.id) === formatErrandId(errandId);
      if (!matches) return;
      reloadErrand();

      const newStatus = String(updatedErrand.status ?? '').toUpperCase();
      if (newStatus) {
        setErrandStatus(newStatus);
      }

      if (newStatus === 'DELIVERED') {
        setHasHandledRatingPrompt((already) => {
          if (already) return already;
          setShowRatingModal(true);
          return true;
        });
      }
    };

    void getSocket().then((socket) => {
      socket.on('order:updated', onOrderUpdated);
      socket.on('errand:payment_updated', onPaymentEvent);
      socket.on('errand:half_payment_requested', onPaymentEvent);
      socket.on('payment:selected', onPaymentEvent);
      detachSocket = () => {
        socket.off('order:updated', onOrderUpdated);
        socket.off('errand:payment_updated', onPaymentEvent);
        socket.off('errand:half_payment_requested', onPaymentEvent);
        socket.off('payment:selected', onPaymentEvent);
      };
    });

    return () => {
      cancelled = true;
      detachSocket?.();
      if (typeof unsubscribeFromErrand === 'function') {
        void unsubscribeFromErrand(errandId);
      }
    };
  }, [errandId]);

  // While ASSIGNED and IN_TRANSIT keep the conversation open for live delivery coordination,
  // once the errand reaches DELIVERED (or COMPLETED / CANCELLED), the conversation is archived
  // into read-only mode and all actions are locked except the map view.
  const errandStatusUpper = String(errandStatus || '').toUpperCase();

  /** The order itself is fixed: no item revisions, no re-confirmation, no payment-mode change. */
  const isOrderLocked = ['CANCELLED', 'DELIVERED', 'ASSIGNED', 'COMPLETED'].includes(
    errandStatusUpper
  );

  /** The conversation is archived. Once the errand is delivered, completed, or cancelled. */
  const isChatClosed = ['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(errandStatusUpper);

  /**
   * The way to pay on record: chosen on this screen, or the server's, which is
   * how a restart still knows. Null until one is chosen. `paymentMethod` is the
   * flat copy older servers' responses lack; never "PENDING", which is the
   * errand list's placeholder, not a choice.
   */
  const recordedPaymentName: string | null =
    (errandData as any)?.paymentSelection?.paymentMode?.name ??
    (typeof (errandData as any)?.paymentMethod === 'string' &&
    (errandData as any).paymentMethod.toUpperCase() !== 'PENDING'
      ? (errandData as any).paymentMethod
      : null);
  const chosenPaymentMethod: string | null =
    confirmedPaymentMethod ?? (recordedPaymentName ? labelForMode(recordedPaymentName) : null);

  // The choice cannot be dismissed, but a cancelled or assigned errand ends it.
  useEffect(() => {
    if (isOrderLocked || isChatClosed) setShowPaymentModal(false);
  }, [isOrderLocked, isChatClosed]);

  /**
   * Whether there's money still owed on this errand's ledger right now — the
   * upfront half, or (once that's confirmed) the remaining balance.
   *
   * Drives the composer's persistent receipt-upload button. The upload itself
   * used to be reachable only from inside the one "order confirmation" chat
   * card, and only in the single AWAITING_UPFRONT state — so once that card
   * scrolled out of view, or the plan moved on to owing a balance instead,
   * there was no way to upload a receipt at all.
   */
  const paymentPlan = (errandData as any)?.paymentPlan ?? null;
  const ledgerState: string | null = paymentPlan?.hasLedger ? paymentPlan.state : null;
  /**
   * The half is owed only once the rider has bought everything and asked for
   * it: it is half of what they actually paid, so before that there is nothing
   * to send, and the server refuses a receipt.
   */
  const isHalfPaymentDue = ledgerState === 'AWAITING_UPFRONT' && Boolean(paymentPlan?.halfPaymentRequestedAt);
  // Not AWAITING_BALANCE since 2026-10-08: the customer never uploads a receipt
  // now. They show the transfer to the rider, who photographs it at the door,
  // and the server refuses a customer's upload. The 50% plan is retired too, so
  // the server never reports AWAITING_UPFRONT and this stays false.
  const hasOutstandingLedger = isHalfPaymentDue;
  /** The half is in: anything past waiting for it on a ledger errand. */
  const isHalfPaid =
    ledgerState === 'AWAITING_BALANCE' || ledgerState === 'SETTLED' || ledgerState === 'OVERAGE_PENDING';

  // The dispatcher's "here is where to send the receipt" opens the upload
  // itself, once per request. Keyed on the message, so closing it does not
  // reopen it on the next render, but a fresh request from the dispatcher does.
  const openedProofRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasOutstandingLedger || isChatClosed) return;
    let latest: ChatMessage | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'payment_proof_request') {
        latest = messages[i];
        break;
      }
    }
    if (!latest || openedProofRequestRef.current === latest.id) return;
    openedProofRequestRef.current = latest.id;
    setShowPaymentProofModal(true);
  }, [messages, hasOutstandingLedger, isChatClosed]);

  /**
   * Says it in the thread too, since that is where the dispatcher asked. Their
   * panel updates from the server's own event; this is the part a person reads.
   * The upload card stays open on its confirmed state for the customer to see.
   */
  const handleReceiptUploaded = (proof: {
    amount: number | null;
    referenceNo: string | null;
    autoConfirmed?: boolean;
  }) => {
    if (!user) return;
    const amount = proof.amount != null ? `₱${Number(proof.amount).toFixed(2)}` : 'my payment';
    const ref_ = proof.referenceNo ? ` (ref ${proof.referenceNo})` : '';
    push(ref(database, `chats/${errandId}/messages`), {
      senderId: String(user.id),
      senderName: user.firstName || 'Customer',
      role: 'customer',
      type: 'text',
      text: proof.autoConfirmed
        ? `I sent my receipt for ${amount}${ref_}. It was confirmed automatically.`
        : `I sent my receipt for ${amount}${ref_}. Please check it.`,
      timestamp: Date.now(),
    }).catch((err) => console.warn('[CustomerChat] Receipt message not posted:', err));
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!isChatClosed && !statusLoading) {
      broadcastTyping(Boolean(text.trim().length > 0));
    }
  };

  const handleSendMessage = () => {
    if (isChatClosed || statusLoading) {
      showAppAlert({
        title: 'Read-Only Errand',
        message: 'This chat session is archived and read-only. No further messages can be sent.',
        variant: 'info',
      });
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed) return;

    broadcastTyping(false);

    const messagesRef = ref(database, `chats/${errandId}/messages`);
    push(messagesRef, {
      senderId: String(user.id),
      senderName: user.firstName || 'Customer',
      role: 'customer',
      type: 'text',
      text: trimmed,
      timestamp: Date.now(),
    });

    // Notify dispatcher in real-time
    apiClient
      .post(`/errands/${errandId}/customer-chat-notify`, {
        text: trimmed,
        senderName: user?.firstName || 'Customer',
      })
      .catch((err) => {
        console.warn('[CustomerChat] Dispatcher chat notify error:', err);
      });

    setInputText('');
    setUnreadNewCount(0);
    isScrolledUpRef.current = false;
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handlePaymentConfirmed = (methodLabel: string, opts?: { wasAlreadyChosen?: boolean }) => {
    setConfirmedPaymentMethod(methodLabel);
    setShowPaymentModal(false);

    // The order summary carries the choice, so the dispatcher's screen hears
    // it over the same channel as the approval and moves on to the rider.
    // Merged in, never replacing the card. A failed stamp only costs that
    // screen its quickest cue; the server's own event still reaches it.
    let orderCardId: string | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'order_confirmation') {
        orderCardId = messages[i].id;
        break;
      }
    }
    if (orderCardId) {
      update(ref(database, `chats/${errandId}/messages/${orderCardId}`), {
        paymentMethod: methodLabel,
        paymentChosenAt: Date.now(),
      }).catch((err) => console.warn('[CustomerChat] Order summary not stamped:', err));
    }

    // On record before this opened (a restart, another phone): already said.
    if (opts?.wasAlreadyChosen) return;

    const messagesRef = ref(database, `chats/${errandId}/messages`);
    push(messagesRef, {
      senderId: String(user.id),
      senderName: user.firstName || 'Customer',
      role: 'customer',
      type: 'text',
      text: `✅ Payment mode confirmed: ${methodLabel}`,
      timestamp: Date.now(),
    });

    showAppAlert({
      title: 'Order Confirmed',
      message: `You'll pay by ${methodLabel}. Your dispatcher is assigning a rider next.`,
      variant: 'success',
    });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Reopens the listeners rather than reading once alongside them. The one-off
  // read this replaces never cleared the banner, even when it succeeded, and it
  // reused the same refused session, so it could not fix anything. After a
  // refusal the session is renewed first; reopening under the identity just
  // refused would only be refused again.
  const handleRefresh = () => {
    const wasRefused = connectionError;
    setRefreshing(true);
    setLoading(true);
    setConnectionError(false);
    if (!wasRefused) {
      setSubscriptionAttempt((attempt) => attempt + 1);
      return;
    }
    renewedRef.current = true;
    void renewRealtimeSession().finally(() => setSubscriptionAttempt((attempt) => attempt + 1));
  };

  // Back online with the chat refused (the renewal needs the network too):
  // try once more without waiting for a tap.
  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;
  useEffect(() => {
    if (reconnectCount > 0 && connectionError) handleRefreshRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectCount]);

  // Pre-calculate message grouping for Messenger bubble styling
  const messageClusters = useMemo(() => {
    // The payment card is not shown (2026-10-15): choosing how to pay follows
    // Approve on the order summary. Chats from before still hold one.
    const shown = messages.filter((m) => m.type !== 'payment_prompt');
    return shown.map((m, idx) => {
      const prev = shown[idx - 1];
      const next = shown[idx + 1];

      const isSameSenderAsPrev =
        prev &&
        prev.role === m.role &&
        !prev.type?.includes('order_confirmation') &&
        !m.type?.includes('order_confirmation') &&
        m.timestamp - prev.timestamp < 120000;

      const isSameSenderAsNext =
        next &&
        next.role === m.role &&
        !next.type?.includes('order_confirmation') &&
        !m.type?.includes('order_confirmation') &&
        next.timestamp - m.timestamp < 120000;

      return {
        ...m,
        isFirstInGroup: !isSameSenderAsPrev,
        isLastInGroup: !isSameSenderAsNext,
      };
    });
  }, [messages]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // "padding" on both platforms: this component reads the IME frame itself
        // rather than waiting for a window resize, so it needs no per-platform
        // behaviour and no magic offset. The padding shrinks the list as well as
        // lifting the composer, so the newest bubble stays on screen.
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* 1. MESSENGER-INSPIRED TOP NAVIGATION HEADER */}
        <View
          style={[
            styles.navHeaderRow,
            {
              borderBottomColor: colors.border,
              backgroundColor: colors.bgApp,
            },
          ]}
        >
          {/* Back Action */}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CustomerPortal', {
                user,
                initialTab: 'chat',
              })
            }
            hitSlop={PortalTouchTargets.compactHitSlop}
            style={styles.backBtn}
            testID="back-button"
            accessibilityLabel="Back to messages"
          >
            <ChevronLeft size={22} color={colors.textDark} />
          </TouchableOpacity>

          {/* Messenger Avatar & Live Presence Hierarchy */}
          <View style={styles.navTitleCenter}>
            <View style={styles.navHeaderProfile}>
              <View style={styles.avatarPresenceWrapper}>
                <DispatcherAvatar dispatcherId={dispatcherId} size={36} iconSize={17} />
                <View
                  style={[
                    styles.onlineBadgeDot,
                    {
                      backgroundColor: otherPresence.online ? '#10B981' : '#9CA3AF',
                      borderColor: isDark ? colors.bgApp : '#FFFFFF',
                    },
                  ]}
                  testID="chat-header-presence-dot"
                />
              </View>

              <View style={styles.navTextCol}>
                <Text
                  style={[styles.navTitle, { color: colors.textDark }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}
                >
                  {dispatcherName || 'Dispatcher'}
                </Text>

                {/* Subtitle: Live Presence Status + Errand ID */}
                <View style={styles.presenceRow}>
                  {otherPresence.online ? (
                    <View style={styles.activePill}>
                      <View style={styles.activeGreenPulse} />
                      <Text
                        style={styles.activeText}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                      >
                        Active now
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[styles.offlineText, { color: colors.textGray }]}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                    >
                      Offline
                    </Text>
                  )}
                  <Text style={[styles.metaDivider, { color: colors.textLight }]}>•</Text>
                  <Text
                    style={[styles.errandPillText, { color: colors.textGray }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                  >
                    {formatErrandId(errandId)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Action Icons */}
          <View style={styles.navRightActions}>
            {latestPinpoints.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.75}
                hitSlop={PortalTouchTargets.compactHitSlop}
                style={styles.actionIconBtn}
                onPress={() => setShowMapModal(true)}
                accessibilityLabel="View store pins on map"
                testID="header-view-map-button"
              >
                <MapPin size={16} color={colors.primary} />
              </TouchableOpacity>
            )}

            {errandData && (
              <TouchableOpacity
                activeOpacity={0.75}
                hitSlop={PortalTouchTargets.compactHitSlop}
                style={[
                  styles.actionIconBtn,
                  isChatClosed && { opacity: 0.4 },
                ]}
                onPress={() => !isChatClosed && setShowDetailsModal(true)}
                disabled={isChatClosed}
                accessibilityLabel="View errand details"
                testID="header-view-details-button"
              >
                <Info size={16} color={colors.textDark} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 2. BENTO ORDER CAPSULE BAR & EXPANDABLE DRAWER */}
        {errandStatus && (
          <View style={styles.bentoCapsuleContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsOrderSummaryExpanded((prev) => !prev)}
              style={[
                styles.bentoCapsuleBar,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle order summary"
              testID="bento-order-capsule-toggle"
            >
              <View style={styles.bentoCapsuleLeft}>
                <Store size={14} color={colors.primary} strokeWidth={2.2} />
                <Text style={[styles.bentoCapsuleOrderCode, { color: colors.textDark }]} numberOfLines={1}>
                  #{formatErrandId(errandData?.id || errandId)}
                </Text>
                <Text style={[styles.bentoCapsuleStoreText, { color: colors.textGray }]} numberOfLines={1}>
                  • {extractMerchantCategories(errandData, null, true)}
                </Text>
              </View>

              <View style={styles.bentoCapsuleRight}>
                <StatusBadge status={errandStatus} />
                {isOrderSummaryExpanded ? (
                  <ChevronUp size={15} color={colors.textGray} strokeWidth={2.2} />
                ) : (
                  <ChevronDown size={15} color={colors.textGray} strokeWidth={2.2} />
                )}
              </View>
            </TouchableOpacity>

            {/* EXPANDED ITINERARY & ACTIONS DRAWER */}
            {isOrderSummaryExpanded && (
              <View
                style={[
                  styles.bentoDrawer,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                  },
                ]}
              >
                {/* Store Pinpoints / Route chips */}
                {latestPinpoints.length > 0 ? (
                  <View style={styles.bentoDrawerSection}>
                    <Text style={[styles.bentoDrawerSectionTitle, { color: colors.textGray }]}>
                      STOPS & ITINERARY ({latestPinpoints.length})
                    </Text>
                    <View style={styles.bentoDrawerRow}>
                      {latestPinpoints.map((pt, pIdx) => (
                        <View
                          key={pIdx}
                          style={[
                            styles.bentoStoreChip,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                            },
                          ]}
                        >
                          <MapPin size={11} color={colors.primary} />
                          <Text style={[styles.bentoStoreChipText, { color: colors.textDark }]} numberOfLines={1}>
                            {pt.storeName || `Stop ${pIdx + 1}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Quick actions inside drawer */}
                <View style={styles.bentoDrawerActions}>
                  {latestPinpoints.length > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[
                        styles.bentoDrawerActionBtn,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                        },
                      ]}
                      onPress={() => setShowMapModal(true)}
                    >
                      <MapPin size={13} color={colors.primary} />
                      <Text style={[styles.bentoDrawerActionBtnText, { color: colors.textDark }]}>
                        View Route Map
                      </Text>
                    </TouchableOpacity>
                  )}

                  {errandData && (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[
                        styles.bentoDrawerActionBtn,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                        },
                      ]}
                      onPress={() => setShowDetailsModal(true)}
                    >
                      <Info size={13} color={colors.textDark} />
                      <Text style={[styles.bentoDrawerActionBtnText, { color: colors.textDark }]}>
                        Full Errand Info
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Persistent Half-Payment Banner (Guarantees testID and accessible reminder) */}
            {isHalfPaymentDue && !isChatClosed && (
              <View
                style={[
                  styles.collapsedHalfStrip,
                  {
                    backgroundColor: isDark ? 'rgba(246,36,89,0.14)' : '#FFF1F4',
                    borderBottomColor: isDark ? 'rgba(246,36,89,0.3)' : '#FBCFDA',
                  },
                ]}
                testID="half-payment-banner"
              >
                <View style={styles.ribbonLeft}>
                  <ReceiptText size={13} color={colors.primary} />
                  <Text style={[styles.ribbonText, { color: colors.textDark }]} numberOfLines={2}>
                    {`Half-payment needed: ₱${Number(paymentPlan?.dueUpFront ?? 0).toFixed(2)}, half of the ₱${Number(paymentPlan?.goodsTotal ?? 0).toFixed(2)} your rider paid`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPaymentProofModal(true)}
                  accessibilityRole="button"
                  testID="half-payment-banner-action"
                >
                  <Text style={{ color: colors.primary, fontFamily: FontFamily.bold, fontSize: 12 }}>
                    Send receipt
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* 3. MESSAGES FEED */}
        {connectionError ? (
          <View
            style={[
              styles.errorContainer,
              { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2', borderColor: colors.danger },
            ]}
            testID="chat-connection-error-banner"
          >
            <WifiOff size={30} color={colors.danger} strokeWidth={2} />
            {/* Only blames the network when the phone really is offline. The
                banner itself means the chat refused this device's sign-in, and
                "check your Wi-Fi" sent connected customers hunting for a fault
                they did not have. */}
            <Text style={[styles.errorTitle, { color: colors.danger }]} maxFontSizeMultiplier={1.2}>
              {isConnected ? "This chat didn't open" : "You're offline"}
            </Text>
            <Text style={[styles.errorSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
              {isConnected
                ? 'Tap Try again to reopen it. Nothing you sent is lost.'
                : 'The chat reopens when you are back online. Nothing you sent is lost.'}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.refreshBtnDanger, { backgroundColor: colors.danger }]}
              onPress={handleRefresh}
              testID="tap-to-refresh-chat-connection-btn"
            >
              <RotateCw size={14} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.refreshBtnTextWhite} maxFontSizeMultiplier={1.15}>{RETRY_LABEL}</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          showCircularFallback ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
                Slow connection. Still opening this chat...
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.refreshBtn,
                  { backgroundColor: isDark ? colors.card : colors.bgGray, borderColor: colors.border, marginTop: Spacing.md },
                ]}
                onPress={handleRefresh}
              >
                <RotateCw size={14} color={colors.primary} />
                <Text style={[styles.refreshBtnText, { color: colors.primary }]} maxFontSizeMultiplier={1.15}>
                  {RETRY_LABEL}
                </Text>
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
            testID="chat-messages-flatlist"
            data={messageClusters}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.messagesList}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => {
              if (!isScrolledUpRef.current) {
                flatListRef.current?.scrollToEnd({ animated: true });
              }
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListFooterComponent={
              otherTyping.isTyping ? (
                <TypingIndicator
                  name={otherTyping.name || dispatcherName}
                  dispatcherId={dispatcherId}
                  role="dispatcher"
                  showAvatar={true}
                />
              ) : null
            }
            renderItem={({ item }) => {
              const isCustomer = item.role === 'customer';
              const isPinpoints = item.type === 'pinpoints' && item.pinpoints && item.pinpoints.length > 0;
              const isHalfPaymentCard =
                item.type === 'half_payment_request' || item.type === 'payment_proof_request';
              const isOrderConfirmation = item.type === 'order_confirmation';
              const isItemRevision = item.systemKind === 'item_revision';

              // 3.1 ITEM REVISION PROMPT CARD
              if (isItemRevision) {
                const revisedItems: NonNullable<ChatMessage['revision']>['items'] =
                  item.revision?.items || [];
                const dropped = revisedItems.filter((i) => !i.available || i.quantity === 0);
                const keeping = revisedItems.filter((i) => i.available && i.quantity > 0);
                const answered = item.status === 'approved' || item.status === 'rejected';
                const busy = respondingRevisionId === item.id;
                const hasStructuredItems = dropped.length > 0 || keeping.length > 0;
                const customNote = extractRevisionNote(item);

                return (
                  <View
                    style={[
                      styles.messageBubbleContainer,
                      styles.dispatcherBubbleAlign,
                      { maxWidth: '96%', width: '96%' },
                    ]}
                  >
                    <Text style={[styles.senderLabel, { color: colors.textGray }]}>
                      {item.senderName || 'Dispatcher'}
                    </Text>

                    <View
                      style={[
                        styles.orderConfirmCard,
                        Shadows.soft,
                        {
                          backgroundColor: colors.card,
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      {/* CARD HEADER */}
                      <View style={[styles.orderConfirmHeader, { backgroundColor: isDark ? '#1E293B' : '#1E3A5F' }]}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 7,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <ReceiptText size={16} color="#FFFFFF" strokeWidth={2.2} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.orderConfirmTitle} numberOfLines={1}>
                              ITEM CHECK
                            </Text>
                            <Text style={[styles.orderConfirmSubtitle, { color: isDark ? '#94A3B8' : '#93C5FD' }]} numberOfLines={1}>
                              Store availability review
                            </Text>
                          </View>
                        </View>

                        {answered ? (
                          <View
                            style={[
                              styles.confirmedPill,
                              item.status === 'rejected' && {
                                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                borderColor: 'rgba(239, 68, 68, 0.4)',
                              },
                            ]}
                          >
                            {item.status === 'approved' ? (
                              <>
                                <CheckCircle2 size={11} color="#10B981" strokeWidth={2.4} />
                                <Text style={styles.confirmedPillText}>You Approved</Text>
                              </>
                            ) : (
                              <>
                                <XCircle size={11} color="#EF4444" strokeWidth={2.4} />
                                <Text style={[styles.confirmedPillText, { color: '#EF4444' }]}>
                                  You Declined
                                </Text>
                              </>
                            )}
                          </View>
                        ) : (
                          <View style={styles.pendingPill}>
                            <Clock size={11} color="#F59E0B" strokeWidth={2.4} />
                            <Text style={styles.pendingPillText}>Action Needed</Text>
                          </View>
                        )}
                      </View>

                      {/* CARD BODY */}
                      <View style={[styles.orderConfirmBody, { padding: 12, gap: 10 }]}>
                        {hasStructuredItems ? (
                          <Text style={{ fontFamily: FontFamily.regular, fontSize: PortalFontSizes.caption, color: isDark ? colors.textDark : '#334155', lineHeight: 18 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                            The dispatcher checked store availability and updated your order items. Please review below:
                          </Text>
                        ) : (
                          <Text style={{ fontFamily: FontFamily.regular, fontSize: PortalFontSizes.caption, color: isDark ? colors.textDark : '#334155', lineHeight: 18 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                            {item.text || 'The dispatcher checked your order and requested adjustments. Please review below.'}
                          </Text>
                        )}

                        {/* DISPATCHER CUSTOM NOTE (IF ANY) */}
                        {customNote ? (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              gap: 8,
                              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                              borderRadius: BorderRadius.sm,
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#BFDBFE',
                              padding: 9,
                            }}
                          >
                            <Info size={14} color={isDark ? '#93C5FD' : '#2563EB'} strokeWidth={2.2} style={{ marginTop: 2 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: FontFamily.bold, fontSize: PortalFontSizes.micro, color: isDark ? '#93C5FD' : '#1E40AF', marginBottom: 2 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                Dispatcher Note
                              </Text>
                              <Text style={{ fontFamily: FontFamily.regular, fontSize: PortalFontSizes.caption, color: isDark ? colors.textDark : '#1E3A5F', lineHeight: 18 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                {customNote}
                              </Text>
                            </View>
                          </View>
                        ) : null}

                        {/* UNAVAILABLE / DROPPED ITEMS */}
                        {dropped.length > 0 && (
                          <View
                            style={{
                              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                              borderRadius: BorderRadius.sm + 2,
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FECACA',
                              padding: 10,
                              gap: 6,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2', paddingBottom: 5 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <XCircle size={13} color="#DC2626" strokeWidth={2.4} />
                                <Text style={{ fontFamily: FontFamily.bold, fontSize: PortalFontSizes.micro, color: isDark ? '#FCA5A5' : '#991B1B', letterSpacing: 0.3, textTransform: 'uppercase' }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                  Unavailable / Skipped
                                </Text>
                              </View>
                              <Text style={{ fontFamily: FontFamily.semibold, fontSize: PortalFontSizes.micro, color: isDark ? '#FCA5A5' : '#DC2626' }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                {dropped.length} {dropped.length === 1 ? 'item' : 'items'}
                              </Text>
                            </View>

                            {dropped.map((it, idx) => (
                              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                                <Text style={{ fontFamily: FontFamily.medium, fontSize: PortalFontSizes.caption, color: isDark ? colors.textDark : '#7F1D1D', flex: 1 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                  • {it.itemName}
                                </Text>
                                {it.note ? (
                                  <Text style={{ fontFamily: FontFamily.regular, fontSize: PortalFontSizes.micro, fontStyle: 'italic', color: isDark ? '#FCA5A5' : '#B91C1C', marginLeft: 6 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                    ({it.note})
                                  </Text>
                                ) : null}
                              </View>
                            ))}
                          </View>
                        )}

                        {/* CONFIRMED TO BUY ITEMS */}
                        {keeping.length > 0 && (
                          <View
                            style={{
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4',
                              borderRadius: BorderRadius.sm + 2,
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#BBF7D0',
                              padding: 10,
                              gap: 6,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#DCFCE7', paddingBottom: 5 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <CheckCircle2 size={13} color="#059669" strokeWidth={2.4} />
                                <Text style={{ fontFamily: FontFamily.bold, fontSize: PortalFontSizes.micro, color: isDark ? '#6EE7B7' : '#166534', letterSpacing: 0.3, textTransform: 'uppercase' }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                  Confirmed to Buy
                                </Text>
                              </View>
                              <Text style={{ fontFamily: FontFamily.semibold, fontSize: PortalFontSizes.micro, color: isDark ? '#6EE7B7' : '#059669' }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                {keeping.length} {keeping.length === 1 ? 'item' : 'items'}
                              </Text>
                            </View>

                            {keeping.map((it, idx) => {
                              const qtyChanged = it.previousQuantity !== undefined && it.previousQuantity !== it.quantity;
                              return (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                                  <Text style={{ fontFamily: FontFamily.medium, fontSize: PortalFontSizes.caption, color: isDark ? colors.textDark : '#14532D', flex: 1 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                    • {it.itemName}
                                  </Text>
                                  <View
                                    style={{
                                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
                                      paddingHorizontal: 7,
                                      paddingVertical: 2,
                                      borderRadius: 6,
                                      borderWidth: 1,
                                      borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#86EFAC',
                                      marginLeft: 8,
                                    }}
                                  >
                                    {qtyChanged ? (
                                      <Text style={{ fontFamily: FontFamily.bold, fontSize: PortalFontSizes.micro, color: isDark ? '#6EE7B7' : '#166534' }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                        {it.previousQuantity} → x{it.quantity}
                                      </Text>
                                    ) : (
                                      <Text style={{ fontFamily: FontFamily.bold, fontSize: PortalFontSizes.micro, color: isDark ? '#6EE7B7' : '#166534' }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                        x{it.quantity}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* ANSWERED CONFIRMATION STATUS */}
                        {answered ? (
                          item.status === 'approved' ? (
                            <View
                              style={[
                                styles.confirmedStatusRow,
                                {
                                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
                                  paddingVertical: 10,
                                  gap: 6,
                                  marginTop: 2,
                                },
                              ]}
                            >
                              <CheckCircle2 size={15} color="#10B981" strokeWidth={2.5} />
                              <Text style={[styles.confirmedStatusText, { color: isDark ? '#34D399' : '#065F46' }]}>
                                You approved these item changes ✓
                              </Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.confirmedStatusRow,
                                {
                                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                                  paddingVertical: 8,
                                  paddingHorizontal: 10,
                                  gap: 6,
                                  marginTop: 2,
                                },
                              ]}
                            >
                              <Clock size={14} color="#DC2626" strokeWidth={2.4} />
                              <Text style={[styles.confirmedStatusText, { color: isDark ? '#FCA5A5' : '#DC2626' }]} numberOfLines={1}>
                                Adjustment Requested
                              </Text>
                            </View>
                          )
                        ) : (
                          /* ASYMMETRIC CONTRAST ACTION BUTTONS */
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                            {/* Secondary Action: Modify / Adjust */}
                            <TouchableOpacity
                              activeOpacity={0.8}
                              style={[
                                styles.revisionAction,
                                {
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1',
                                  borderWidth: 1,
                                  flex: 1,
                                  minHeight: PortalTouchTargets.buttonHeight,
                                  borderRadius: BorderRadius.md,
                                },
                                (isOrderLocked || isChatClosed || busy) && { opacity: 0.5 },
                              ]}
                              disabled={isOrderLocked || isChatClosed || busy}
                              onPress={() => promptRejectRevision(item.id)}
                            >
                              <Pencil size={14} color={isDark ? colors.textDark : '#475569'} strokeWidth={2.2} />
                              <Text style={[styles.revisionActionText, { color: isDark ? colors.textDark : '#334155' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                                Decline / Adjust
                              </Text>
                            </TouchableOpacity>

                            {/* Primary Action: Proceed with Changes */}
                            <TouchableOpacity
                              activeOpacity={0.85}
                              style={[
                                styles.revisionAction,
                                {
                                  backgroundColor: '#10B981',
                                  flex: 1.35,
                                  minHeight: PortalTouchTargets.buttonHeight,
                                  borderRadius: BorderRadius.md,
                                },
                                (isOrderLocked || isChatClosed || busy) && { opacity: 0.5 },
                              ]}
                              disabled={isOrderLocked || isChatClosed || busy}
                              onPress={() => void handleRespondToRevision(item.id, 'approved')}
                            >
                              {busy ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <CheckCircle2 size={15} color="#FFFFFF" strokeWidth={2.4} />
                                  <Text style={[styles.revisionActionText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                                    Proceed with Changes ✓
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={[styles.timeLabel, { color: colors.textLight }]}>{formatTime(item.timestamp)}</Text>
                  </View>
                );
              }

              // 3.2 ORDER CONFIRMATION SUMMARY CARD
              if (isOrderConfirmation) {
                const parsedStoreGroups = parseOrderConfirmationTree(item);

                return (
                  <View
                    style={[
                      styles.messageBubbleContainer,
                      styles.dispatcherBubbleAlign,
                      { maxWidth: '96%', width: '96%' },
                    ]}
                  >
                    <Text style={[styles.senderLabel, { color: colors.textGray }]}>
                      {item.senderName || 'Dispatcher'}
                    </Text>

                    <View style={[styles.orderConfirmCard, Shadows.soft, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#1E3A5F' }]}>
                      <View style={[styles.orderConfirmHeader, { backgroundColor: isDark ? '#1E293B' : '#0B132B' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ReceiptText size={16} color="#FFFFFF" strokeWidth={2.2} />
                          <View>
                            <Text style={styles.orderConfirmTitle}>
                              ORDER QUOTE #{formatErrandId(errandData?.id || errandId)}
                            </Text>
                          </View>
                        </View>

                        {item.confirmed ? (
                          <View style={styles.confirmedPill}>
                            <CheckCircle2 size={11} color="#10B981" strokeWidth={2.4} />
                            <Text style={styles.confirmedPillText}>Approved</Text>
                          </View>
                        ) : (
                          <View style={styles.pendingPill}>
                            <Clock size={11} color="#F59E0B" strokeWidth={2.4} />
                            <Text style={styles.pendingPillText}>Action Needed</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.orderConfirmBody}>
                        {parsedStoreGroups.length === 0 ? (
                          <View style={[styles.storeGroupCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                            {(item.items || []).map((it: any, idx: number) => (
                              <View key={idx} style={styles.storeGroupItemRow}>
                                <Text style={[styles.storeGroupItemName, { color: isDark ? colors.textDark : '#334155' }]} numberOfLines={1}>
                                  {it.itemName}
                                </Text>
                                <View style={[styles.quantityBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE' }]}>
                                  <Text style={[styles.quantityBadgeText, { color: isDark ? '#93C5FD' : '#1E3A5F' }]}>
                                    {it.quantity}×
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          parsedStoreGroups.map((storeGroup, sIdx) => (
                            <View key={sIdx} style={[styles.storeGroupCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                              <View style={[styles.storeGroupHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                                <Store size={13} color="#DC2626" strokeWidth={2.2} />
                                <Text style={[styles.storeGroupName, { color: isDark ? colors.textDark : '#1E3A5F' }]}>{storeGroup.storeName}</Text>
                                <View style={[styles.storeItemsCountPill, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE' }]}>
                                  <Text style={[styles.storeItemsCountText, { color: isDark ? '#93C5FD' : '#1E3A5F' }]}>
                                    {storeGroup.totalItemsCount} {storeGroup.totalItemsCount === 1 ? 'item' : 'items'}
                                  </Text>
                                </View>
                              </View>

                              <View style={{ gap: Spacing.md - 2 }}>
                                {storeGroup.categories.map((catGroup, cIdx) => (
                                  <View key={cIdx} style={styles.categorySection} testID={`order-category-${sIdx}-${cIdx}`}>
                                    {catGroup.categoryName !== 'General Items' && (
                                      <View style={[styles.categoryHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                          <FolderOpen size={12} color={isDark ? '#93C5FD' : '#1E3A5F'} />
                                          <Text style={[styles.categoryTitle, { color: isDark ? colors.textDark : '#1E3A5F' }]}>
                                            {catGroup.categoryName}
                                          </Text>
                                        </View>
                                        <Text style={[styles.categoryItemCount, { color: colors.textGray }]}>
                                          {catGroup.items.length} {catGroup.items.length === 1 ? 'item' : 'items'}
                                        </Text>
                                      </View>
                                    )}

                                    <View style={styles.storeGroupItemsList} testID={`order-items-${sIdx}-${cIdx}`}>
                                      {catGroup.items.map((gItem, gIdx) => (
                                        <View key={gIdx} style={styles.storeGroupItemRow}>
                                          <Text style={[styles.storeGroupItemName, { color: isDark ? colors.textDark : '#334155' }]} numberOfLines={1}>
                                            {gItem.itemName}
                                          </Text>
                                          <View style={[styles.quantityBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE' }]}>
                                            <Text style={[styles.quantityBadgeText, { color: isDark ? '#93C5FD' : '#1E3A5F' }]}>
                                              {gItem.quantity}×
                                            </Text>
                                          </View>
                                        </View>
                                      ))}
                                    </View>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ))
                        )}

                        {/* ESTIMATED FEES & PRICE BREAKDOWN */}
                        <View style={[styles.deliveryFeeRow, { flexDirection: 'column', alignItems: 'stretch', gap: 6, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF', borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#BFDBFE' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Receipt size={15} color={isDark ? '#93C5FD' : '#1E3A5F'} strokeWidth={2.2} />
                              <Text style={[styles.deliveryFeeLabel, { color: isDark ? '#93C5FD' : '#1E3A5F' }]}>Estimated Delivery Fee</Text>
                            </View>
                            <Text style={{ fontFamily: FontFamily.bold, fontSize: 13, color: isDark ? '#93C5FD' : '#1E3A5F' }}>
                              ₱{Number(item.deliveryFee ?? errandData?.deliveryFee ?? 50).toFixed(2)}
                            </Text>
                          </View>

                          {(item as any).feeBreakdown ? (
                            <FeeBreakdownCard
                              breakdown={(item as any).feeBreakdown}
                              paymentPlan={(errandData as any)?.paymentPlan ?? null}
                              testIDPrefix={`chat-fee-${item.id}`}
                            />
                          ) : (
                            <View style={{ gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(30,58,95,0.08)' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: PortalFontSizes.caption, color: colors.textGray }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>Base & Distance Delivery Fee</Text>
                                <Text style={{ fontSize: PortalFontSizes.caption, fontFamily: FontFamily.bold, color: colors.textDark }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                  ₱{Number(item.deliveryFee ?? errandData?.deliveryFee ?? 50).toFixed(2)}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: PortalFontSizes.caption, color: colors.textGray }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>Purchased Items Subtotal</Text>
                                <Text style={{ fontSize: PortalFontSizes.caption, color: colors.textGray, fontStyle: 'italic' }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                                  Per store receipts (COD)
                                </Text>
                              </View>
                            </View>
                          )}

                          <Text style={{ fontSize: PortalFontSizes.micro, color: colors.textGray, fontStyle: 'italic', marginTop: 2 }} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                            Purchased items verified by physical merchant receipts upon delivery (COD)
                          </Text>

                          {isHalfPaymentDue && (
                            <View style={{ paddingTop: 8 }}>
                              <PaymentProofUpload
                                errandId={String(errandData?.id ?? errandId)}
                                amountDue={(errandData as any).paymentPlan.dueUpFront}
                                context="upfront"
                              />
                            </View>
                          )}
                        </View>

                        {/* APPROVAL & MODIFICATION ACTIONS */}
                        {(item.confirmed || item.status === 'approved') &&
                        !chosenPaymentMethod &&
                        !item.paymentMethod &&
                        errandData &&
                        !isOrderLocked &&
                        !isChatClosed ? (
                          // Approved, no way to pay yet: the app was closed on
                          // the choice. Approve's place goes to finishing it.
                          <TouchableOpacity
                            testID="order-choose-payment"
                            activeOpacity={0.8}
                            style={[
                              styles.revisionAction,
                              {
                                backgroundColor: colors.primary,
                                marginTop: 4,
                                minHeight: PortalTouchTargets.buttonHeight,
                                borderRadius: BorderRadius.md,
                              },
                            ]}
                            onPress={() => setShowPaymentModal(true)}
                          >
                            <CreditCard size={14} color="#FFFFFF" strokeWidth={2.5} />
                            <Text style={[styles.revisionActionText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                              Choose payment method
                            </Text>
                          </TouchableOpacity>
                        ) : item.confirmed || item.status === 'approved' ? (
                          <View style={[styles.confirmedStatusRow, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0' }]}>
                            <CheckCircle2 size={15} color="#10B981" strokeWidth={2.5} />
                            <View style={{ flexShrink: 1 }}>
                              <Text style={[styles.confirmedStatusText, { color: isDark ? '#34D399' : '#065F46' }]}>Order & Estimated Fees Approved</Text>
                              {(chosenPaymentMethod || item.paymentMethod) && (
                                <Text
                                  testID="order-paying-by"
                                  style={{ fontSize: PortalFontSizes.caption, color: isDark ? '#34D399' : '#065F46', marginTop: 2 }}
                                  maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                                >
                                  {`Paying by ${chosenPaymentMethod || item.paymentMethod}`}
                                </Text>
                              )}
                            </View>
                          </View>
                        ) : item.status === 'rejected' || item.status === 'modification_requested' ? (
                          <View style={[styles.confirmedStatusRow, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA', paddingHorizontal: 10 }]}>
                            <Clock size={14} color="#DC2626" strokeWidth={2.4} />
                            <Text style={[styles.confirmedStatusText, { color: isDark ? '#FCA5A5' : '#DC2626' }]} numberOfLines={1}>
                              Adjustment Requested
                            </Text>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              style={[
                                styles.revisionAction,
                                {
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                                  borderColor: colors.border,
                                  borderWidth: 1,
                                  flex: 1,
                                  minHeight: PortalTouchTargets.buttonHeight,
                                  borderRadius: BorderRadius.md,
                                },
                                (isOrderLocked || isChatClosed || isConfirmingOrder) && { opacity: 0.5 },
                              ]}
                              disabled={isOrderLocked || isChatClosed || isConfirmingOrder}
                              onPress={() => promptRejectRevision(item.id)}
                            >
                              <Pencil size={13} color={colors.textDark} strokeWidth={2.4} />
                              <Text style={[styles.revisionActionText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                                Modify / Adjust
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.8}
                              style={[
                                styles.revisionAction,
                                {
                                  backgroundColor: '#10B981',
                                  flex: 1.4,
                                  minHeight: PortalTouchTargets.buttonHeight,
                                  borderRadius: BorderRadius.md,
                                },
                                (isOrderLocked || isChatClosed || isConfirmingOrder) && { opacity: 0.5 },
                              ]}
                              disabled={isOrderLocked || isChatClosed || isConfirmingOrder}
                              onPress={() => handleConfirmOrder(item.id)}
                            >
                              {isConfirmingOrder ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <CheckCircle2 size={14} color="#FFFFFF" strokeWidth={2.5} />
                                  <Text style={[styles.revisionActionText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
                                    Approve Order (₱{Number(item.deliveryFee ?? errandData?.deliveryFee ?? 50).toFixed(2)})
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={[styles.timeLabel, { color: colors.textLight }]}>{formatTime(item.timestamp)}</Text>
                  </View>
                );
              }

              // 3.3 SYSTEM NOTICES
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

              // 3.4 ITEM DELETED NOTICE
              if (item.type === 'item_deleted' || (typeof item.text === 'string' && item.text.startsWith('🗑️'))) {
                return (
                  <View style={[styles.messageBubbleContainer, styles.dispatcherBubbleAlign, { maxWidth: '96%', width: '96%' }]}>
                    <View style={[styles.itemDeletedCard, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA' }]}>
                      <View style={[styles.itemDeletedIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                        <Trash2 size={14} color="#DC2626" strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.itemDeletedHeaderTitle, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>Item Removed from Order</Text>
                          <Text style={[styles.timeLabel, { color: isDark ? '#F87171' : '#DC2626', marginHorizontal: 0, marginTop: 0 }]}>
                            {formatTime(item.timestamp)}
                          </Text>
                        </View>
                        <Text style={[styles.itemDeletedBodyText, { color: isDark ? colors.textDark : '#7F1D1D' }]}>{item.text}</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              // 3.5 MESSENGER-STYLE CONVERSATIONAL BUBBLES
              return (
                <View
                  style={[
                    styles.messageBubbleContainer,
                    isCustomer ? styles.customerBubbleAlign : styles.dispatcherBubbleAlign,
                  ]}
                >
                  {/* Sender name shown only on first message in cluster for dispatcher */}
                  {!isCustomer && item.isFirstInGroup && (
                    <Text style={[styles.senderLabel, { color: colors.textGray }]}>
                      {item.senderName || 'Dispatcher'}
                    </Text>
                  )}

                  <View
                    style={{
                      flexDirection: isCustomer ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: 6,
                    }}
                  >
                    {/* Incoming Dispatcher Avatar: Show beside the last bubble in cluster */}
                    {!isCustomer && (
                      <View style={{ width: 28, height: 28, justifyContent: 'flex-end' }}>
                        {item.isLastInGroup ? (
                          <DispatcherAvatar dispatcherId={dispatcherId} size={28} iconSize={13} />
                        ) : null}
                      </View>
                    )}

                    <View
                      style={[
                        styles.bubble,
                        isCustomer
                          ? [
                              styles.customerBubble,
                              {
                                backgroundColor: colors.primary,
                                borderTopRightRadius: item.isFirstInGroup ? 18 : 6,
                                borderBottomRightRadius: item.isLastInGroup ? 4 : 6,
                              },
                            ]
                          : [
                              styles.dispatcherBubble,
                              {
                                backgroundColor: isDark ? '#1F2937' : '#F0F2F5',
                                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                                borderTopLeftRadius: item.isFirstInGroup ? 18 : 6,
                                borderBottomLeftRadius: item.isLastInGroup ? 4 : 6,
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

                      {/* Pinpoints Quick Attachment Action */}
                      {isPinpoints && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={[
                            styles.pinMessageAction,
                            { backgroundColor: isCustomer ? 'rgba(255,255,255,0.2)' : colors.primary },
                          ]}
                          onPress={() => setShowMapModal(true)}
                          testID="chat-view-map-button"
                        >
                          <MapPin size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.pinMessageActionText}>View Store Pins on Map</Text>
                        </TouchableOpacity>
                      )}

                      {/* The half-payment: the dispatcher asked for it, or
                          showed where the receipt goes. Either way the next
                          thing is the receipt, so both carry the same action,
                          and both go quiet once it is paid. */}
                      {isHalfPaymentCard && (
                        <TouchableOpacity
                          testID="chat-half-payment-action"
                          activeOpacity={0.8}
                          style={[
                            styles.pinMessageAction,
                            {
                              backgroundColor:
                                isHalfPaymentDue && !isChatClosed ? colors.primary : '#6B7280',
                            },
                          ]}
                          onPress={() => setShowPaymentProofModal(true)}
                          disabled={!isHalfPaymentDue || isChatClosed}
                        >
                          <ReceiptText size={13} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.pinMessageActionText}>
                            {isHalfPaymentDue
                              ? 'Send my receipt'
                              : isHalfPaid
                              ? 'Half-payment received'
                              : 'Nothing to send yet'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Micro timestamp shown only on last message in cluster */}
                  {item.isLastInGroup && (
                    <Text
                      style={[
                        styles.timeLabel,
                        {
                          color: colors.textLight,
                          alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                          marginLeft: isCustomer ? 0 : 34,
                        },
                      ]}
                    >
                      {formatTime(item.timestamp)}
                    </Text>
                  )}
                </View>
              );
            }}
          />
        )}

        {/* FLOATING "NEW MESSAGE [N]" PILL BUTTON */}
        {unreadNewCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.88}
            style={[
              styles.newMessagesPill,
              Shadows.soft,
              { backgroundColor: colors.primary },
            ]}
            onPress={scrollToLatest}
            testID="new-messages-pill"
            accessibilityLabel={`Scroll to latest view. New message ${unreadNewCount}`}
          >
            <ArrowDown size={13} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.newMessagesPillText}>
              New Message [{unreadNewCount}]
            </Text>
          </TouchableOpacity>
        )}

        {/* 4. BOTTOM MESSAGE INPUT BAR OR READ-ONLY BANNER */}
        {isChatClosed ? (
          <View
            style={[
              styles.readOnlyNotice,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <Text style={[styles.readOnlyNoticeText, { color: colors.textGray }]}>
              {errandStatusUpper === 'CANCELLED'
                ? 'This errand was cancelled. Conversation is archived.'
                : errandStatusUpper === 'DELIVERED'
                ? 'This errand was delivered. Conversation is archived.'
                : 'This errand is completed. Conversation is archived.'}
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
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.readOnlyNoticeText, { color: colors.textGray }]}>
              Checking session status...
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8),
              },
            ]}
          >
            <View
              style={[
                styles.inputWrapperPill,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.28)' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  shadowOpacity: isDark ? 0.25 : 0.08,
                },
              ]}
              testID="chat-input-wrapper-pill"
            >
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: colors.textDark,
                  },
                ]}
                placeholder="Message..."
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={inputText}
                onChangeText={handleInputChange}
                onBlur={() => broadcastTyping(false)}
                multiline={true}
                blurOnSubmit={false}
                scrollEnabled={true}
                testID="chat-text-input"
              />
            </View>

            {hasOutstandingLedger && (
              <TouchableOpacity
                testID="chat-payment-proof-button"
                activeOpacity={0.8}
                style={[
                  styles.sendBtn,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray },
                ]}
                onPress={() => setShowPaymentProofModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Upload your payment receipt"
              >
                <ReceiptText size={16} color={isDark ? colors.textDark : colors.primary} strokeWidth={2.5} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              testID="send-message-button"
              activeOpacity={0.8}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
                (!inputText.trim() || isChatClosed || statusLoading) && { opacity: 0.4 },
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isChatClosed || statusLoading}
              accessibilityLabel="Send message"
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
          visible={showPaymentModal && !isOrderLocked && !isChatClosed}
          errandId={errandId}
          onConfirmed={handlePaymentConfirmed}
        />

        {/* Reachable from the composer at any time there's an outstanding
            balance — not just while the one order-confirmation card with the
            embedded uploader happens to be on screen. */}
        <Modal
          visible={showPaymentProofModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPaymentProofModal(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.declineModalBackdrop}>
              <View
                style={[
                  styles.declineModalCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  Shadows.liftedUp,
                ]}
              >
                <View style={[styles.declineModalHeader, { justifyContent: 'space-between' }]}>
                  <Text style={[styles.declineModalTitle, { color: colors.textDark }]}>
                    Payment receipt
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowPaymentProofModal(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <X size={20} color={colors.textGray} />
                  </TouchableOpacity>
                </View>

                {paymentPlan && hasOutstandingLedger ? (
                  <PaymentProofUpload
                    errandId={String(errandData?.id ?? errandId)}
                    amountDue={paymentPlan.dueUpFront}
                    context="upfront"
                    onUploaded={handleReceiptUploaded}
                  />
                ) : (
                  <Text style={{ color: colors.textGray }}>
                    Nothing is currently due on this errand.
                  </Text>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <RatingModal
          visible={showRatingModal}
          errandId={errandId}
          onDone={() => {
            setShowRatingModal(false);
            setHasHandledRatingPrompt(true);
          }}
        />

        {/* CROSS-PLATFORM DECLINE / ADJUST REVISION MODAL */}
        <Modal
          visible={Boolean(selectedRevisionForDecline)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedRevisionForDecline(null)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.declineModalBackdrop}>
              {/* Stays on React Native's own component: this one lives inside an
                  RN Modal, which is a separate window that KeyboardProvider's
                  context does not reach. Left exactly as it was. */}
              <RNKeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ width: '100%', alignItems: 'center' }}
              >
                <View
                  style={[
                    styles.declineModalCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    Shadows.liftedUp,
                  ]}
                >
                  <View style={styles.declineModalHeader}>
                    <View style={styles.declineModalIconBox}>
                      <XCircle size={20} color="#EF4444" strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.declineModalTitle, { color: colors.textDark }]}>
                        Decline or Request Adjustment
                      </Text>
                      <Text style={[styles.declineModalSubtitle, { color: colors.textGray }]}>
                        Specify brand, quantity, or replacement preference.
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedRevisionForDecline(null)}
                      hitSlop={PortalTouchTargets.compactHitSlop}
                      style={styles.declineModalCloseBtn}
                    >
                      <X size={18} color={colors.textGray} />
                    </TouchableOpacity>
                  </View>

                  {/* Preset Chips */}
                  <View style={styles.declineChipsRow}>
                    {REVISION_DECLINE_PRESETS.map((preset, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.7}
                        onPress={() => updateDeclineReason(preset)}
                        style={[
                          styles.declineChip,
                          {
                            backgroundColor:
                              declineReasonText === preset
                                ? (isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2')
                                : (isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray),
                            borderColor:
                              declineReasonText === preset
                                ? '#EF4444'
                                : (isDark ? 'rgba(255,255,255,0.1)' : colors.border),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.declineChipText,
                            {
                              color:
                                declineReasonText === preset
                                  ? '#DC2626'
                                  : colors.textDark,
                            },
                          ]}
                        >
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Text Input */}
                  <TextInput
                    value={declineReasonText}
                    onChangeText={updateDeclineReason}
                    placeholder="Type specific instructions (e.g. get brand X, cancel item)..."
                    placeholderTextColor={colors.textLight}
                    multiline
                    numberOfLines={3}
                    style={[
                      styles.declineModalInput,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        borderColor: colors.border,
                        color: colors.textDark,
                      },
                    ]}
                  />

                  {/* Actions */}
                  <View style={styles.declineModalActions}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setSelectedRevisionForDecline(null)}
                      style={[
                        styles.declineModalCancelBtn,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.declineModalCancelText, { color: colors.textDark }]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={isSubmittingDecline}
                      onPress={handleConfirmDeclineRevision}
                      style={[
                        styles.declineModalSubmitBtn,
                        isSubmittingDecline && { opacity: 0.6 },
                      ]}
                    >
                      {isSubmittingDecline ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.declineModalSubmitText}>
                          Send Response
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </RNKeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 0,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
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
    gap: 10,
  },
  avatarPresenceWrapper: {
    position: 'relative',
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  navTextCol: {
    flex: 1,
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeGreenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.micro,
    color: '#10B981',
  },
  offlineText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
  },
  metaDivider: {
    fontSize: PortalFontSizes.micro,
  },
  errandPillText: {
    fontFamily: FontFamily.mono,
    fontSize: PortalFontSizes.micro,
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  bentoCapsuleContainer: {
    width: '100%',
    zIndex: 10,
  },
  bentoCapsuleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    minHeight: 46,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  bentoCapsuleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: Spacing.sm,
  },
  bentoCapsuleOrderCode: {
    fontFamily: FontFamily.mono,
    fontSize: PortalFontSizes.caption,
    fontWeight: '700',
  },
  bentoCapsuleStoreText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
    flex: 1,
  },
  bentoCapsuleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bentoDrawer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  bentoDrawerSection: {
    gap: 4,
  },
  bentoDrawerSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bentoDrawerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  bentoStoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    maxWidth: '100%',
  },
  bentoStoreChipText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.micro,
  },
  bentoDrawerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  bentoDrawerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    minHeight: 34,
  },
  bentoDrawerActionBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.caption,
  },
  bentoHalfPaymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  collapsedHalfStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: Spacing.sm,
  },
  ribbonText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
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
    fontSize: PortalFontSizes.subheading,
    marginBottom: 4,
  },
  emptySubtext: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
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
    fontSize: PortalFontSizes.subheading,
    marginTop: Spacing.xs,
  },
  errorSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  refreshBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    minHeight: PortalTouchTargets.pillHeight,
    borderRadius: BorderRadius.md,
  },
  refreshBtnTextWhite: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    color: '#FFFFFF',
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    marginTop: Spacing.sm,
    fontSize: PortalFontSizes.caption,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    minHeight: PortalTouchTargets.pillHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  refreshBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
  },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  messageBubbleContainer: {
    marginBottom: 3,
    maxWidth: '85%',
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
    fontSize: PortalFontSizes.micro,
    marginBottom: 3,
    marginLeft: 36,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    maxWidth: '100%',
  },
  customerBubble: {
    borderBottomRightRadius: 4,
  },
  dispatcherBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.body,
    lineHeight: 21,
  },
  pinMessageAction: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 38,
    gap: 5,
    marginTop: 6,
    borderRadius: BorderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pinMessageActionText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: PortalFontSizes.caption,
  },
  timeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
    marginTop: 2,
    marginHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  inputWrapperPill: {
    flex: 1,
    minHeight: 48,
    maxHeight: 124,
    borderRadius: 22,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  textInput: {
    maxHeight: 100,
    textAlignVertical: 'top',
    fontSize: PortalFontSizes.body,
    lineHeight: 21,
    fontFamily: FontFamily.regular,
    paddingTop: Platform.OS === 'ios' ? 6 : 4,
    paddingBottom: Platform.OS === 'ios' ? 6 : 4,
    margin: 0,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  readOnlyNotice: {
    padding: Spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyNoticeText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
  },
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
    fontSize: PortalFontSizes.caption,
    letterSpacing: 0.2,
  },
  systemNoticeTime: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
  },
  systemNoticeBody: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    lineHeight: 19,
  },
  orderConfirmCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
    alignSelf: 'stretch',
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
    fontSize: PortalFontSizes.caption,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  orderConfirmSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
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
    fontSize: PortalFontSizes.micro,
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
    fontSize: PortalFontSizes.micro,
    color: '#F59E0B',
  },
  revisionAction: {
    flex: 1,
    minHeight: PortalTouchTargets.buttonHeight,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  revisionActionText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    textAlign: 'center',
  },
  // The order summary's spacing (2026-10-14): three boxes used to nest here,
  // order > store > category, with 10, 8 and 6 dp inside them and 4 dp between
  // item lines. The category box is gone (a heading and a hairline remain) and
  // the two boxes left have room, so the list reads as a list, not a grid.
  orderConfirmBody: {
    padding: Spacing.md - 2,
    gap: Spacing.md - 2,
  },
  storeGroupCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md - 2,
    gap: Spacing.sm + 2,
  },
  storeGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: Spacing.sm,
  },
  storeGroupName: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    color: '#1E3A5F',
    flex: 1,
  },
  storeItemsCountPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  storeItemsCountText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
    color: '#1E3A5F',
  },
  // Unboxed: a heading over its items inside the store's card.
  categorySection: {
    gap: Spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: Spacing.xs + 2,
  },
  categoryTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
    color: '#1E3A5F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryItemCount: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
    color: '#64748B',
  },
  quantityBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: Spacing.sm,
  },
  quantityBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.micro,
    color: '#1E3A5F',
  },
  storeGroupItemsList: {
    gap: Spacing.sm,
    paddingLeft: 2,
  },
  storeGroupItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  storeGroupItemName: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
    color: '#334155',
  },
  storeGroupItemNote: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.micro,
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
    fontSize: PortalFontSizes.caption,
    color: '#1E3A5F',
  },
  confirmOrderCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: BorderRadius.md,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  confirmOrderCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
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
    paddingHorizontal: 12,
    minHeight: 38,
    marginTop: 2,
  },
  confirmedStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.caption,
    color: '#065F46',
    textAlign: 'center',
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
    fontSize: PortalFontSizes.micro,
    color: '#991B1B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemDeletedBodyText: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 18,
  },
  declineModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  declineModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: 12,
  },
  declineModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  declineModalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  declineModalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.title,
    letterSpacing: -0.2,
  },
  declineModalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.caption,
    marginTop: 2,
    lineHeight: 18,
  },
  declineModalCloseBtn: {
    padding: 4,
  },
  declineChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  declineChip: {
    minHeight: PortalTouchTargets.pillHeight,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineChipText: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.caption,
  },
  declineModalInput: {
    width: '100%',
    minHeight: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FontFamily.regular,
    fontSize: PortalFontSizes.body,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  declineModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  declineModalCancelBtn: {
    minHeight: PortalTouchTargets.buttonHeight,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineModalCancelText: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.subheading,
  },
  declineModalSubmitBtn: {
    minHeight: PortalTouchTargets.buttonHeight,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.md,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineModalSubmitText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.subheading,
    color: '#FFFFFF',
  },
  newMessagesPill: {
    position: 'absolute',
    bottom: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    zIndex: 99,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  newMessagesPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: PortalFontSizes.caption,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
