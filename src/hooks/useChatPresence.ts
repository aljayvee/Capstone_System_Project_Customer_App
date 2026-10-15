import { useEffect, useState, useRef, useCallback } from 'react';
import { ref, onValue, set, onDisconnect } from 'firebase/database';
import { database } from '../firebase/config';

export interface ChatPresenceOptions {
  errandId: string;
  userRole?: 'customer' | 'dispatcher';
  userName?: string;
  userId?: string | number;
}

export interface OtherPresenceState {
  online: boolean;
  lastSeen: number | null;
  name: string;
}

export interface OtherTypingState {
  isTyping: boolean;
  name: string;
}

export function useChatPresence({
  errandId,
  userRole = 'customer',
  userName = 'Customer',
  userId = 'user',
}: ChatPresenceOptions) {
  const [otherPresence, setOtherPresence] = useState<OtherPresenceState>({
    online: false,
    lastSeen: null,
    name: userRole === 'customer' ? 'Dispatcher' : 'Customer',
  });

  const [otherTyping, setOtherTyping] = useState<OtherTypingState>({
    isTyping: false,
    name: userRole === 'customer' ? 'Dispatcher' : 'Customer',
  });

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingTimestampRef = useRef<number>(0);

  const oppositeRole = userRole === 'customer' ? 'dispatcher' : 'customer';

  // 1. PRESENCE BROADCAST & LISTENER
  useEffect(() => {
    if (!errandId) return;

    const myPresenceRef = ref(database, `chats/${errandId}/presence/${userRole}`);
    const otherPresenceRef = ref(database, `chats/${errandId}/presence/${oppositeRole}`);
    const connectedRef = ref(database, '.info/connected');

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Set up onDisconnect hook
        try {
          const dc = onDisconnect(myPresenceRef);
          if (dc && typeof dc.set === 'function') {
            void Promise.resolve(
              dc.set({
                online: false,
                lastSeen: Date.now(),
                role: userRole,
                name: userName,
              })
            ).catch(() => {});
          }
        } catch {}

        // Set live presence
        void Promise.resolve(
          set(myPresenceRef, {
            online: true,
            lastSeen: Date.now(),
            role: userRole,
            name: userName,
          })
        ).catch(() => {});
      }
    });

    const unsubOtherPresence = onValue(otherPresenceRef, (snap) => {
      const val = snap.val();
      if (val) {
        setOtherPresence({
          online: Boolean(val.online),
          lastSeen: typeof val.lastSeen === 'number' ? val.lastSeen : null,
          name: val.name || (userRole === 'customer' ? 'Dispatcher' : 'Customer'),
        });
      } else {
        setOtherPresence({
          online: false,
          lastSeen: null,
          name: userRole === 'customer' ? 'Dispatcher' : 'Customer',
        });
      }
    });

    return () => {
      unsubConnected();
      unsubOtherPresence();
      // Set offline on unmount
      void Promise.resolve(
        set(myPresenceRef, {
          online: false,
          lastSeen: Date.now(),
          role: userRole,
          name: userName,
        })
      ).catch(() => {});
    };
  }, [errandId, userRole, userName, oppositeRole]);

  // 2. TYPING BROADCAST & LISTENER
  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (!errandId) return;

      const myTypingRef = ref(database, `chats/${errandId}/typing/${userRole}`);

      if (isTyping) {
        void Promise.resolve(
          set(myTypingRef, {
            isTyping: true,
            name: userName,
            timestamp: Date.now(),
          })
        ).catch(() => {});

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Auto-stop typing after 2.5s of no keystrokes
        typingTimeoutRef.current = setTimeout(() => {
          void Promise.resolve(
            set(myTypingRef, {
              isTyping: false,
              name: userName,
              timestamp: Date.now(),
            })
          ).catch(() => {});
        }, 2500);
      } else {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        void Promise.resolve(
          set(myTypingRef, {
            isTyping: false,
            name: userName,
            timestamp: Date.now(),
          })
        ).catch(() => {});
      }
    },
    [errandId, userRole, userName]
  );

  useEffect(() => {
    if (!errandId) return;

    const otherTypingRef = ref(database, `chats/${errandId}/typing/${oppositeRole}`);

    const unsubOtherTyping = onValue(otherTypingRef, (snap) => {
      const val = snap.val();
      if (val && val.isTyping) {
        lastTypingTimestampRef.current = val.timestamp || Date.now();
        setOtherTyping({
          isTyping: true,
          name: val.name || (userRole === 'customer' ? 'Dispatcher' : 'Customer'),
        });
      } else {
        setOtherTyping({
          isTyping: false,
          name: val?.name || (userRole === 'customer' ? 'Dispatcher' : 'Customer'),
        });
      }
    });

    // Guard against dangling true typing states if opposite party abruptly disconnects
    typingCheckIntervalRef.current = setInterval(() => {
      if (lastTypingTimestampRef.current > 0 && Date.now() - lastTypingTimestampRef.current > 4000) {
        setOtherTyping((prev) => (prev.isTyping ? { ...prev, isTyping: false } : prev));
      }
    }, 1500);

    return () => {
      unsubOtherTyping();
      if (typingCheckIntervalRef.current) {
        clearInterval(typingCheckIntervalRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      const myTypingRef = ref(database, `chats/${errandId}/typing/${userRole}`);
      void Promise.resolve(
        set(myTypingRef, {
          isTyping: false,
          name: userName,
          timestamp: Date.now(),
        })
      ).catch(() => {});
    };
  }, [errandId, userRole, oppositeRole, userName]);

  return {
    otherPresence,
    otherTyping,
    broadcastTyping,
  };
}
