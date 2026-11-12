import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { onValue, ref } from 'firebase/database';
import { ChevronRight } from 'lucide-react-native';
import { database } from '../firebase/config';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  Spacing,
  FontFamily,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalFontSizeMultipliers,
} from '../config/theme';
import { formatErrandId } from '../utils/formatErrandId';
import { extractMerchantCategories } from '../utils/merchantCategories';
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

  const displayCategory = (errand.pinpoints || [])
    .map((pin) => String(pin.storeName || '').trim())
    .filter(Boolean)
    .join(' & ') || extractMerchantCategories(errand, chatMeta);
  const statusLabels: Record<string, string> = {
    AVAILABLE: 'Awaiting assignment',
    PENDING: 'Awaiting assignment',
    ASSIGNED: 'Rider assigned',
    IN_TRANSIT: 'Out for delivery',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  const status = String(errand.status || '').toUpperCase();
  const statusLabel = statusLabels[status] || 'Awaiting update';
  const statusColor = status === 'PENDING' || status === 'AVAILABLE' ? colors.warning
    : status === 'ASSIGNED' ? colors.info
    : status === 'IN_TRANSIT' ? (isDark ? colors.primary : colors.primaryStrong)
    : status === 'DELIVERED' || status === 'COMPLETED' ? colors.success
    : status === 'CANCELLED' ? colors.danger : colors.textGray;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.rowContainer,
        {
          borderBottomColor: colors.border,
        },
      ]}
      onPress={() => onSelect(errand.id, errand.status)}
      testID={`chat-channel-row-${errand.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${displayCategory}, ${dispatcherName}, ${statusLabel}. Open conversation.`}
    >
      {/* AVATAR WITH LIVE ONLINE / OFFLINE BADGE */}
      <View style={styles.avatarWrapper}>
        <DispatcherAvatar dispatcherId={dispatcherId} size={44} neutral />
        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: isDispatcherOnline ? colors.successAccent : colors.textLight,
              borderColor: colors.card,
            },
          ]}
          testID={`channel-presence-dot-${errand.id}`}
        />
      </View>

      {/* CHANNEL CONTENT */}
      <View style={styles.textBodyCol}>
        {/* Store identity leads; dispatcher and order context sit below. */}
        <View style={styles.topLine}>
          <Text
            style={[styles.categoryPreview, { color: colors.textDark }]}
            numberOfLines={2}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.card}
          >
            {displayCategory}
          </Text>
        </View>
        <Text
          style={[styles.dispatcherText, { color: colors.textDark }]}
          numberOfLines={1}
          maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
        >
          {dispatcherName}
        </Text>
        {/* The reference and current status can wrap on compact devices. */}
        <View style={styles.subMetaRow}>
          <Text
            style={[styles.errandId, { color: colors.detailBlue }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          >
            {formatErrandId(errand.id, errand.referenceNo)}
          </Text>
          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.dotDivider, { color: colors.textLight }]}>·</Text>
          <Text style={[styles.statusText, { color: statusColor }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            {statusLabel}
          </Text>
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
    minHeight: 96,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    marginBottom: Spacing.xs,
  },
  categoryPreview: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'heading'),
  },
  subMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 5,
    rowGap: 2,
    marginTop: 6,
  },
  errandId: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
  },
  dotDivider: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  statusText: {
    flexShrink: 1,
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
  },
  dispatcherText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
  chevron: {
    marginLeft: 2,
  },
});
