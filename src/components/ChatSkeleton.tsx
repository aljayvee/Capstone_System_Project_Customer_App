import React from 'react';
import { StyleSheet, View } from 'react-native';
import ShimmerWave from './ShimmerWave';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, Spacing, Shadows } from '../config/theme';

/**
 * 1. CHANNEL LIST SKELETON (Messages / Active Chats List)
 */
export function ChannelListSkeleton() {
  const { colors } = useThemeColor();

  return (
    <View style={styles.skeletonContainer} testID="channel-list-skeleton">
      {[1, 2, 3, 4].map((key) => (
        <View
          key={key}
          style={[
            styles.channelCardSkeleton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.soft,
          ]}
        >
          {/* Avatar circle placeholder */}
          <ShimmerWave
            width={44}
            height={44}
            borderRadius={22}
            style={{ marginRight: 12 }}
          />

          {/* Text columns placeholder */}
          <View style={styles.textColSkeleton}>
            {/* Top row: Category title + Status badge */}
            <View style={styles.topRowSkeleton}>
              <ShimmerWave width={95} height={14} borderRadius={4} />
              <ShimmerWave width={65} height={20} borderRadius={BorderRadius.full} />
            </View>

            {/* SubMeta row: Errand ID + Dispatcher */}
            <View style={styles.subMetaSkeleton}>
              <ShimmerWave width={75} height={11} borderRadius={3} />
              <ShimmerWave width={80} height={11} borderRadius={3} />
            </View>

            {/* Bottom row: Message snippet + Timestamp */}
            <View style={styles.bottomRowSkeleton}>
              <ShimmerWave width="60%" height={12} borderRadius={3} />
              <ShimmerWave width={45} height={10} borderRadius={3} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 2. CHAT MESSAGES SKELETON (Inside CustomerChatScreen)
 */
export function ChatMessagesSkeleton() {
  const { colors, isDark } = useThemeColor();

  return (
    <View style={styles.messagesSkeletonContainer} testID="chat-messages-skeleton">
      {/* Left bubble (Incoming message) */}
      <View
        style={[
          styles.bubbleLeft,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          Shadows.soft,
        ]}
      >
        <ShimmerWave width="85%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <ShimmerWave width="55%" height={12} borderRadius={3} />
      </View>

      {/* Right bubble (Outgoing message) */}
      <View
        style={[
          styles.bubbleRight,
          {
            backgroundColor: isDark ? 'rgba(246, 36, 89, 0.25)' : '#FFE4EC',
          },
        ]}
      >
        <ShimmerWave width="75%" height={12} borderRadius={3} />
      </View>

      {/* Left bubble (Incoming message) */}
      <View
        style={[
          styles.bubbleLeft,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          Shadows.soft,
        ]}
      >
        <ShimmerWave width="90%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <ShimmerWave width="70%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <ShimmerWave width="40%" height={12} borderRadius={3} />
      </View>

      {/* Right bubble (Outgoing message) */}
      <View
        style={[
          styles.bubbleRight,
          {
            backgroundColor: isDark ? 'rgba(246, 36, 89, 0.25)' : '#FFE4EC',
          },
        ]}
      >
        <ShimmerWave width="65%" height={12} borderRadius={3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: {
    gap: 4,
    marginTop: Spacing.xs,
  },
  channelCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  textColSkeleton: {
    flex: 1,
    gap: 5,
  },
  topRowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subMetaSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  bottomRowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  messagesSkeletonContainer: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
    width: '72%',
    padding: Spacing.md,
    borderRadius: 16,
    borderBottomLeftRadius: 3,
    borderWidth: 1,
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    width: '65%',
    padding: Spacing.md,
    borderRadius: 16,
    borderBottomRightRadius: 3,
  },
});
