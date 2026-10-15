import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { onValue, ref } from 'firebase/database';
import { ChevronRight, ShieldCheck } from 'lucide-react-native';
import { database } from '../firebase/config';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  FontSizes,
  Spacing,
  FontFamily,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import { formatErrandId } from '../utils/formatErrandId';
import { extractMerchantCategories } from '../utils/merchantCategories';
import StatusBadge from './StatusBadge';
import DispatcherAvatar from './DispatcherAvatar';
import type { ErrandSummary } from '../hooks/useActiveErrands';

export interface ErrandChannelRowProps {
  errand: ErrandSummary;
  onSelect: (id: string, status?: string) => void;
}

/**
 * Each errand's last chat meta and dispatcher presence, kept for the session
 * (2026-10-14). The rows are remade on every visit to Messages & Support, and
 * each used to start as "Dispatcher", offline, with no store line, until
 * Firebase answered again, so the list visibly redrew. They start from here.
 */
const rowMemory = new Map<string, { meta: any; online: boolean }>();

export default function ErrandChannelRow({ errand, onSelect }: ErrandChannelRowProps) {
  const { colors, isDark } = useThemeColor();
  const remembered = rowMemory.get(errand.id);
  const [dispatcherName, setDispatcherName] = useState(remembered?.meta?.dispatcherName || 'Dispatcher');
  const [dispatcherId, setDispatcherId] = useState<string | number | null>(remembered?.meta?.dispatcherId ?? null);
  const [isDispatcherOnline, setIsDispatcherOnline] = useState(remembered?.online ?? false);
  const [chatMeta, setChatMeta] = useState<any>(remembered?.meta ?? null);

  useEffect(() => {
    const metaRef = ref(database, `chats/${errand.id}/meta`);
    const unsubMeta = onValue(metaRef, (snap) => {
      const meta = snap.val();
      rowMemory.set(errand.id, { meta, online: rowMemory.get(errand.id)?.online ?? false });
      setChatMeta(meta);
      if (meta?.dispatcherName) setDispatcherName(meta.dispatcherName);
      if (meta?.dispatcherId) setDispatcherId(meta.dispatcherId);
    });

    const presenceRef = ref(database, `chats/${errand.id}/presence/dispatcher`);
    const unsubPresence = onValue(presenceRef, (snap) => {
      const val = snap.val();
      const online = Boolean(val?.online);
      rowMemory.set(errand.id, { meta: rowMemory.get(errand.id)?.meta ?? null, online });
      setIsDispatcherOnline(online);
    });

    return () => {
      unsubMeta();
      unsubPresence();
    };
  }, [errand.id]);

  const displayCategory = extractMerchantCategories(errand, chatMeta);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.rowContainer,
        {
          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
        },
      ]}
      onPress={() => onSelect(errand.id, errand.status)}
      testID={`chat-channel-row-${errand.id}`}
    >
      {/* AVATAR WITH LIVE ONLINE / OFFLINE BADGE */}
      <View style={styles.avatarWrapper}>
        <DispatcherAvatar dispatcherId={dispatcherId} size={44} />
        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: isDispatcherOnline ? '#10B981' : '#9CA3AF',
              borderColor: isDark ? colors.bgApp : '#FFFFFF',
            },
          ]}
          testID={`channel-presence-dot-${errand.id}`}
        />
      </View>

      {/* CHANNEL CONTENT */}
      <View style={styles.textBodyCol}>
        {/* Top Line: Category / Store Lead & Status Badge */}
        <View style={styles.topLine}>
          <Text
            style={[styles.categoryPreview, { color: colors.textDark }]}
            numberOfLines={1}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.card}
          >
            {displayCategory}
          </Text>
          <StatusBadge status={errand.status} />
        </View>

        {/* Subtitle Row: Order ID & Dispatcher Tag */}
        <View style={styles.subMetaRow}>
          <Text
            style={[styles.errandId, { color: colors.textGray }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.card}
          >
            {formatErrandId(errand.id)}
          </Text>
          <Text style={[styles.dotDivider, { color: colors.textLight }]}>·</Text>
          <View style={styles.dispatcherBadge}>
            <ShieldCheck size={12} color="#10B981" />
            <Text
              style={[styles.dispatcherText, { color: colors.textGray }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.card}
            >
              {dispatcherName}
            </Text>
          </View>
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
    minHeight: 64,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
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
    marginBottom: 4,
  },
  categoryPreview: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 1.25),
    flex: 1,
    marginRight: 6,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  errandId: {
    fontFamily: FontFamily.mono,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.2),
  },
  dotDivider: {
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  dispatcherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dispatcherText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.2),
  },
  chevron: {
    marginLeft: 2,
  },
});
