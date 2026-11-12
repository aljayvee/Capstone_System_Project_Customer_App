import { usePageLayout } from '../hooks/usePageLayout';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import ShimmerWave from './ShimmerWave';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, Spacing } from '../config/theme';

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
              borderBottomColor: colors.border,
            },
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
            {/* Store title */}
            <View style={styles.topRowSkeleton}>
              <ShimmerWave width="80%" height={15} borderRadius={4} />
            </View>

            {/* Dispatcher */}
            <View style={styles.subMetaSkeleton}>
              <ShimmerWave width="60%" height={12} borderRadius={3} />
            </View>

            {/* Order reference and status */}
            <View style={styles.bottomRowSkeleton}>
              <ShimmerWave width="85%" height={11} borderRadius={3} />
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
  const pageLayout = usePageLayout({ horizontalSafeAreaApplied: true, tabletGutter: 18 });
  const { colors, isDark } = useThemeColor();

  return (
    <View style={[styles.messagesSkeletonContainer, pageLayout.gutterStyle]} testID="chat-messages-skeleton">
      {/* Left bubble (Incoming message) */}
      <View
        style={[
          styles.bubbleLeft,
          {
            backgroundColor: colors.bgGray,
          },
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
            backgroundColor: isDark ? colors.bgGray : colors.primarySurface,
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
            backgroundColor: colors.bgGray,
          },
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
            backgroundColor: isDark ? colors.bgGray : colors.primarySurface,
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
    gap: 0,
  },
  channelCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 96,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textColSkeleton: {
    flex: 1,
    gap: 6,
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
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
    width: '72%',
    padding: Spacing.md,
    borderRadius: 14,
    borderBottomLeftRadius: 3,
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    width: '65%',
    padding: Spacing.md,
    borderRadius: 14,
    borderBottomRightRadius: 3,
  },
});
