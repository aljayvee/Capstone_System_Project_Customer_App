import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { database } from '../firebase/config';
import { apiClient } from '../services/apiClient';
import { useAuth } from './AuthContext';
import { useNetworkStatus } from './NetworkContext';
import { getSocket } from '../services/socketClient';
import { getActiveChatErrandId } from '../utils/activeChatTracker';

export interface CustomerNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  customerId?: number;
  errandId?: string;
}

export interface NotificationContextValue {
  notifications: CustomerNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: (isPullRefresh?: boolean) => Promise<void>;
  syncActiveErrands: (errandIds: string[]) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const POLL_INTERVAL_MS = 45000; // 45 seconds resilient safety net (Socket.io provides instant real-time events)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isConnected, reconnectCount } = useNetworkStatus();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // In-memory set of errand IDs that have already fired a proximity alert locally to prevent duplicate alerts
  const alertedProximityErrandIdsRef = useRef<Set<string>>(new Set());

  // Active errand IDs to monitor for real-time dispatcher chats
  const [monitoredErrandIds, setMonitoredErrandIds] = useState<string[]>([]);
  const firebaseChatUnsubsRef = useRef<Map<string, () => void>>(new Map());
  const listenerStartTimesRef = useRef<Map<string, number>>(new Map());
  const alertedMessageIdsRef = useRef<Set<string>>(new Set());

  // A different account on this phone starts from nothing. Without this, the
  // chat listeners and alert history of the customer who signed out carried
  // over, and their dispatcher's messages popped up for the next customer.
  const ownerIdRef = useRef<string | null>(null);
  useEffect(() => {
    const ownerId = user?.id != null ? String(user.id) : null;
    if (ownerIdRef.current === ownerId) return;
    ownerIdRef.current = ownerId;
    firebaseChatUnsubsRef.current.forEach((unsub) => unsub());
    firebaseChatUnsubsRef.current.clear();
    listenerStartTimesRef.current.clear();
    alertedMessageIdsRef.current.clear();
    alertedProximityErrandIdsRef.current.clear();
    setMonitoredErrandIds([]);
    setNotifications([]);
    setUnreadCount(0);
  }, [user?.id]);

  /** Only this customer's own errands: an event about anyone else's is dropped. */
  const isMine = useCallback(
    (order: { customerId?: number | string | null } | null | undefined) =>
      order?.customerId != null && user?.id != null && String(order.customerId) === String(user.id),
    [user?.id]
  );

  const syncActiveErrands = useCallback((errandIds: string[]) => {
    if (!Array.isArray(errandIds)) return;
    const cleanIds = errandIds.map((id) => String(id)).filter(Boolean);
    setMonitoredErrandIds((prev) => {
      const prevSet = new Set(prev);
      const isSame = cleanIds.length === prev.length && cleanIds.every((id) => prevSet.has(id));
      return isSame ? prev : cleanIds;
    });
  }, []);

  const fetchNotifications = useCallback(
    async (isPullRefresh = false) => {
      if (!user?.id) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      if (!isPullRefresh) setLoading(true);

      try {
        const res = await apiClient.get<CustomerNotification[]>('/notifications');
        const list = res.data ?? [];
        setNotifications(list);
        const count = list.filter((n) => !n.isRead).length;
        setUnreadCount(count);
      } catch (err) {
        // Silently swallow background poll errors
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Initial fetch and network reconnect catch-up
  useEffect(() => {
    if (!isConnected || !user?.id) return;
    void fetchNotifications();
  }, [fetchNotifications, isConnected, reconnectCount, user?.id]);

  // Resilient fallback polling (paused when offline or unauthenticated)
  useEffect(() => {
    if (!isConnected || !user?.id) return;
    const interval = setInterval(() => {
      void fetchNotifications(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications, isConnected, user?.id]);

  // Mark single notification as read with optimistic in-memory update
  const markAsRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.warn('[NotificationContext] Failed to mark as read:', err);
    }
  }, []);

  // Mark all notifications as read atomically with instant zero-lag memory update
  const markAllAsRead = useCallback(async () => {
    // Instant UI update: zeroes the badge count immediately so returning to Home has 0 lag
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await apiClient.patch('/notifications/read-all');
    } catch (err) {
      console.warn('[NotificationContext] Failed to mark all as read atomically:', err);
    }
  }, []);

  // Listen for real-time Socket.io events
  useEffect(() => {
    if (!user?.id) return;
    let detach: (() => void) | undefined;

    const onNotificationNew = async (newNotif: any) => {
      if (!newNotif) return;

      setUnreadCount((prev) => prev + 1);
      setNotifications((prev) => {
        if (newNotif.id && prev.some((n) => n.id === newNotif.id)) return prev;
        const normalized: CustomerNotification = {
          id: newNotif.id || Date.now(),
          type: newNotif.type || 'SYSTEM',
          title: newNotif.title || 'New Notification',
          body: newNotif.body || '',
          isRead: false,
          createdAt: newNotif.createdAt || new Date().toISOString(),
          errandId: newNotif.errandId,
        };
        return [normalized, ...prev];
      });

      // Deduplicate against Firebase RTDB listener
      const notifType = String(newNotif.type || '').toUpperCase();
      const errandId = newNotif.errandId ? String(newNotif.errandId) : null;
      const dedupKey = errandId
        ? `${errandId}_socket_${newNotif.body || newNotif.id || ''}`
        : `socket_${Date.now()}`;
      if (alertedMessageIdsRef.current.has(dedupKey)) return;
      alertedMessageIdsRef.current.add(dedupKey);
      if (alertedMessageIdsRef.current.size > 200) {
        const first = alertedMessageIdsRef.current.values().next().value;
        if (first) alertedMessageIdsRef.current.delete(first);
      }

      // If viewing this exact chat, suppress foreground banner and chime
      const activeChatId = getActiveChatErrandId();
      if (
        (notifType.includes('CHAT') || notifType.includes('MESSAGE')) &&
        errandId &&
        activeChatId &&
        errandId === activeChatId
      ) {
        return;
      }

      // Check user notification and sound preferences
      const [soundsVal, chatAlertsVal, errandAlertsVal] = await Promise.all([
        AsyncStorage.getItem('@sugo_customer_sounds_enabled'),
        AsyncStorage.getItem('@sugo_customer_chat_alerts_enabled'),
        AsyncStorage.getItem('@sugo_customer_errand_alerts_enabled'),
      ]);
      const soundsEnabled = soundsVal !== 'false';
      const chatAlerts = chatAlertsVal !== 'false';
      const errandAlerts = errandAlertsVal !== 'false';
      const isChat = notifType.includes('CHAT') || notifType.includes('MESSAGE');
      const isDelivery =
        notifType.includes('ERRAND') ||
        notifType.includes('RIDER') ||
        notifType.includes('DELIVERY') ||
        notifType.includes('PROXIMITY');

      if (isChat && !chatAlerts) return;
      if (isDelivery && !errandAlerts) return;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: newNotif.title || (isChat ? 'New Message' : 'Sugo Notification'),
            body: newNotif.body || '',
            data: { errandId: newNotif.errandId, type: newNotif.type },
            sound: soundsEnabled ? 'default' : undefined,
            ...(Platform.OS === 'android' ? { channelId: isChat ? 'chats' : 'default' } : {}),
          },
          trigger: null, // deliver immediately
        });
      } catch (err) {
        // Silently swallow in dev or headless environments
      }
    };

    const onRiderNearby = async (payload: any) => {
      const errandId = String(payload?.errandId || '');
      if (!errandId || alertedProximityErrandIdsRef.current.has(errandId)) return;
      alertedProximityErrandIdsRef.current.add(errandId);

      // Check user delivery alerts and sound preferences
      const [soundsVal, errandAlertsVal] = await Promise.all([
        AsyncStorage.getItem('@sugo_customer_sounds_enabled'),
        AsyncStorage.getItem('@sugo_customer_errand_alerts_enabled'),
      ]);
      if (errandAlertsVal === 'false') return;
      const soundsEnabled = soundsVal !== 'false';

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Rider is Arriving Soon! 🛵',
            body: payload?.body || 'Your rider is within 500m of your delivery address. Please prepare your payment (COD)!',
            data: { errandId, type: 'RIDER_NEARBY' },
            sound: soundsEnabled ? 'default' : undefined,
            ...(Platform.OS === 'android' ? { channelId: 'delivery-alerts' } : {}),
          },
          trigger: null, // deliver immediately
        });
      } catch (err) {
        console.warn('[NotificationContext] Failed to schedule local proximity notification:', err);
      }
    };

    // The server sends these to the errand's own customer only (2026-10-07);
    // checked here as well, because they decide which chats this phone opens.
    const onOrderNew = (order: any) => {
      if (order?.id && isMine(order)) syncActiveErrands([String(order.id)]);
    };
    const onOrderClaimed = (order: any) => {
      if (order?.id && isMine(order)) syncActiveErrands([String(order.id)]);
    };
    const onOrderUpdated = (order: any) => {
      if (!order?.id || !isMine(order)) return;
      const status = String(order.status || '').toUpperCase();
      if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
        setMonitoredErrandIds((prev) => prev.filter((id) => id !== String(order.id)));
      } else {
        syncActiveErrands([String(order.id)]);
      }
    };

    void getSocket().then((socket) => {
      socket.on('notification:new', onNotificationNew);
      socket.on('errand:rider_nearby', onRiderNearby);
      socket.on('order:new', onOrderNew);
      socket.on('order:claimed', onOrderClaimed);
      socket.on('order:updated', onOrderUpdated);

      detach = () => {
        socket.off('notification:new', onNotificationNew);
        socket.off('errand:rider_nearby', onRiderNearby);
        socket.off('order:new', onOrderNew);
        socket.off('order:claimed', onOrderClaimed);
        socket.off('order:updated', onOrderUpdated);
      };
    });

    return () => {
      detach?.();
    };
  }, [user?.id, syncActiveErrands, isMine]);

  // Real-time Firebase RTDB chat listener for active errands (Messenger-style in-app heads-up alerts)
  useEffect(() => {
    if (!user?.id) {
      firebaseChatUnsubsRef.current.forEach((unsub) => unsub());
      firebaseChatUnsubsRef.current.clear();
      listenerStartTimesRef.current.clear();
      return;
    }

    const currentUnsubs = firebaseChatUnsubsRef.current;
    const activeSet = new Set(monitoredErrandIds);
    const now = Date.now();

    // 1. Tear down listeners for errands that are no longer active
    for (const [id, unsub] of currentUnsubs.entries()) {
      if (!activeSet.has(id)) {
        unsub();
        currentUnsubs.delete(id);
        listenerStartTimesRef.current.delete(id);
      }
    }

    // 2. Attach listeners for newly active errands
    for (const id of monitoredErrandIds) {
      if (currentUnsubs.has(id)) continue;

      listenerStartTimesRef.current.set(id, now);
      const messagesRef = query(ref(database, `chats/${id}/messages`), limitToLast(1));

      const unsub = onValue(
        messagesRef,
        async (snapshot) => {
          const data = snapshot.val();
          if (!data) return;

          const keys = Object.keys(data);
          if (keys.length === 0) return;
          const msgKey = keys[0];
          const msg = data[msgKey];
          if (!msg) return;

          const startTime = listenerStartTimesRef.current.get(id) || now;
          const msgTimestamp = Number(msg.timestamp) || 0;

          // Ignore messages sent before this listener was mounted
          if (msgTimestamp <= startTime) return;

          // Deduplicate against repeat events or Socket.io delivery
          const dedupKey = `${id}_${msgKey}_${msgTimestamp}`;
          if (alertedMessageIdsRef.current.has(dedupKey)) return;
          alertedMessageIdsRef.current.add(dedupKey);

          // Bounded deduplication set
          if (alertedMessageIdsRef.current.size > 200) {
            const first = alertedMessageIdsRef.current.values().next().value;
            if (first) alertedMessageIdsRef.current.delete(first);
          }

          // Only alert for messages from dispatcher / staff
          const isFromOther =
            msg.role === 'dispatcher' ||
            (msg.senderId && String(msg.senderId) !== String(user?.id));
          if (!isFromOther) return;

          // Suppress heads-up banner if customer is already actively looking at this chat screen
          const activeChatId = getActiveChatErrandId();
          if (activeChatId && String(activeChatId) === String(id)) {
            return;
          }

          // Check user notification and sound preferences from Settings
          const [soundsVal, chatAlertsVal] = await Promise.all([
            AsyncStorage.getItem('@sugo_customer_sounds_enabled'),
            AsyncStorage.getItem('@sugo_customer_chat_alerts_enabled'),
          ]);
          const soundsEnabled = soundsVal !== 'false';
          const chatAlertsEnabled = chatAlertsVal !== 'false';

          if (!chatAlertsEnabled) return;

          if (soundsEnabled) {
            try {
              Vibration.vibrate([0, 200, 100, 200]);
            } catch {}
          }

          const notifBody =
            msg.text ||
            (msg.type === 'pinpoints'
              ? '📍 Updated store locations for your order'
              : msg.type === 'revision'
              ? '📋 Sent an order breakdown for your review'
              : msg.type === 'payment_enabled'
              ? '💳 Enabled online payment for your errand'
              : 'Sent an update on your errand');

          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: msg.senderName || 'Dispatcher',
                body: notifBody,
                data: { errandId: id, type: 'CHAT_MESSAGE' },
                sound: soundsEnabled ? 'default' : undefined,
                ...(Platform.OS === 'android' ? { channelId: 'chats' } : {}),
              },
              trigger: null,
            });
          } catch (err) {
            // Silently swallow in headless or dev environments
          }
        },
        (err) => {
          console.warn(`[NotificationContext] Firebase chat listener error for errand ${id}:`, err);
        }
      );

      currentUnsubs.set(id, unsub);
    }
  }, [monitoredErrandIds, user?.id]);

  // Initial fetch of active errands to listen for chats immediately on mount
  useEffect(() => {
    if (!user?.id) return;
    const ACTIVE_STATUSES = ['AVAILABLE', 'PENDING', 'ASSIGNED', 'IN_TRANSIT'];
    apiClient
      .get('/errands/my-errands')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const activeIds = list
          .filter((e: any) => ACTIVE_STATUSES.includes(String(e.status || '').toUpperCase()))
          .map((e: any) => String(e.id));
        if (activeIds.length > 0) {
          syncActiveErrands(activeIds);
        }
      })
      .catch(() => {});
  }, [user?.id, syncActiveErrands]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifications,
        syncActiveErrands,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
