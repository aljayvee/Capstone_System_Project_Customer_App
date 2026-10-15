import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, BorderRadius } from '../config/theme';
import DispatcherAvatar from './DispatcherAvatar';

export interface TypingIndicatorProps {
  name?: string;
  dispatcherId?: string | number | null;
  role?: 'dispatcher' | 'customer';
  showAvatar?: boolean;
}

export default function TypingIndicator({
  name = 'Dispatcher',
  dispatcherId = null,
  role = 'dispatcher',
  showAvatar = true,
}: TypingIndicatorProps) {
  const { colors, isDark } = useThemeColor();

  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounceAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: -4,
            duration: 280,
            easing: Easing.bezier(0.2, 0.0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 280,
            easing: Easing.bezier(0.2, 0.0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 480 - delay)),
        ])
      );
    };

    const anim1 = createBounceAnimation(dot1Anim, 0);
    const anim2 = createBounceAnimation(dot2Anim, 140);
    const anim3 = createBounceAnimation(dot3Anim, 280);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1Anim, dot2Anim, dot3Anim]);

  const dotColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <View style={styles.container} testID="chat-typing-indicator">
      <Text style={[styles.senderLabel, { color: colors.textGray }]}>
        {name} is typing...
      </Text>

      <View style={styles.bubbleRow}>
        {showAvatar && (
          <View style={styles.avatarWrap}>
            <DispatcherAvatar dispatcherId={dispatcherId} size={28} iconSize={13} />
          </View>
        )}

        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isDark ? '#1F2937' : '#F0F2F5',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
            },
          ]}
        >
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: dotColor, transform: [{ translateY: dot1Anim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: dotColor, transform: [{ translateY: dot2Anim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: dotColor, transform: [{ translateY: dot3Anim }] },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    marginTop: 3,
    marginBottom: 6,
    maxWidth: '85%',
  },
  senderLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    marginBottom: 3,
    marginLeft: 34,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  avatarWrap: {
    width: 28,
    height: 28,
    justifyContent: 'flex-end',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
