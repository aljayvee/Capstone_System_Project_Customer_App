import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { limitToLast, onValue, query, ref } from 'firebase/database';
import { ChevronRight, Headphones, ShieldCheck, Store } from 'lucide-react-native';
import { database } from '../firebase/config';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontSizes, Spacing, BorderRadius, FontFamily, Shadows } from '../config/theme';
import { formatErrandId } from '../utils/formatErrandId';
import StatusBadge from './StatusBadge';
import type { ErrandSummary } from '../hooks/useActiveErrands';

export interface ErrandChannelRowProps {
  errand: ErrandSummary;
  onSelect: (id: string, status?: string) => void;
}

export default function ErrandChannelRow({ errand, onSelect }: ErrandChannelRowProps) {
  const { colors, isDark } = useThemeColor();
  const [dispatcherName, setDispatcherName] = useState('Dispatcher');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null);

  useEffect(() => {
    const metaRef = ref(database, `chats/${errand.id}/meta`);
    const unsubMeta = onValue(metaRef, (snap) => {
      const meta = snap.val();
      if (meta?.dispatcherName) setDispatcherName(meta.dispatcherName);
    });

    const lastMsgQuery = query(ref(database, `chats/${errand.id}/messages`), limitToLast(1));
    const unsubMsg = onValue(lastMsgQuery, (snap) => {
      const val = snap.val();
      if (!val) return;
      const last = Object.values(val)[0] as { text?: string; timestamp?: number } | undefined;
      if (last?.text) setLastMessage(last.text);
      if (last?.timestamp) setLastMessageTime(last.timestamp);
    });

    return () => {
      unsubMeta();
      unsubMsg();
    };
  }, [errand.id]);

  const formattedTime = lastMessageTime
    ? new Date(lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const displayCategory = errand.category || 'Pabili Errand';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.rowContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        Shadows.soft,
      ]}
      onPress={() => onSelect(errand.id, errand.status)}
      testID={`chat-channel-row-${errand.id}`}
    >
      {/* AVATAR WITH ONLINE PULSE INDICATOR */}
      <View style={styles.avatarWrapper}>
        <View
          style={[
            styles.avatarCircle,
            {
              backgroundColor: isDark ? 'rgba(246, 36, 89, 0.15)' : '#FFEEF3',
            },
          ]}
        >
          <Headphones size={20} color={colors.primary} />
        </View>
        <View style={[styles.onlineDot, { backgroundColor: '#10B981', borderColor: colors.card }]} />
      </View>

      {/* CHANNEL CONTENT */}
      <View style={styles.textBodyCol}>
        {/* Top Line: Category / Store Lead & Status Badge */}
        <View style={styles.topLine}>
          <Text style={[styles.categoryPreview, { color: colors.textDark }]} numberOfLines={1}>
            {displayCategory}
          </Text>
          <StatusBadge status={errand.status} />
        </View>

        {/* Subtitle Row: Order ID & Dispatcher Tag */}
        <View style={styles.subMetaRow}>
          <Text style={[styles.errandId, { color: colors.textGray }]}>
            #{formatErrandId(errand.id)}
          </Text>
          <Text style={[styles.dotDivider, { color: colors.textLight }]}>·</Text>
          <View style={styles.dispatcherBadge}>
            <ShieldCheck size={11} color="#10B981" />
            <Text style={[styles.dispatcherText, { color: colors.textGray }]}>{dispatcherName}</Text>
          </View>
        </View>

        {/* Bottom Snippet & Relative Timestamp */}
        <View style={styles.bottomSnippetRow}>
          <Text style={[styles.messageSnippet, { color: colors.textMedium }]} numberOfLines={1}>
            {lastMessage ? lastMessage : `Tap to coordinate with ${dispatcherName}`}
          </Text>
          {formattedTime && (
            <Text style={[styles.timeText, { color: colors.textLight }]}>
              {formattedTime}
            </Text>
          )}
        </View>
      </View>

      {/* RIGHT CHEVRON */}
      <ChevronRight size={15} color={colors.textLight} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  textBodyCol: {
    flex: 1,
    marginRight: 6,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  categoryPreview: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
    flex: 1,
    marginRight: 6,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  errandId: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.sm,
  },
  dotDivider: {
    fontSize: 11,
  },
  dispatcherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dispatcherText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },
  bottomSnippetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  messageSnippet: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    flex: 1,
  },
  timeText: {
    fontFamily: FontFamily.regular,
    fontSize: 10.5,
  },
  chevron: {
    marginLeft: 2,
  },
});
