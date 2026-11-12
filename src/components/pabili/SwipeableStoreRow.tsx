import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight, ChevronsLeft, Trash2 } from 'lucide-react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  scaledPortalFontSize,
} from '../../config/theme';

/** Swipe left (or tap the right-edge indicator) to reveal Remove; swipe right to open the store's item editor. */
export default function SwipeableStoreRow({
  storeName,
  disabled,
  peekOnMount = false,
  borderBottomColor,
  onOpen,
  onRemove,
  children,
}: {
  storeName: string;
  disabled: boolean;
  peekOnMount?: boolean;
  borderBottomColor?: string;
  onOpen: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useThemeColor();
  const swipeable = useRef<SwipeableMethods>(null);
  const [showRemove, setShowRemove] = useState(false);
  const peekAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!peekOnMount || disabled) return;
    let active = true;
    const animation = Animated.sequence([
      Animated.delay(180),
      Animated.timing(peekAnim, {
        toValue: -24,
        duration: 220,
        easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
        useNativeDriver: true,
      }),
      Animated.timing(peekAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
        useNativeDriver: true,
      }),
    ]);

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((reduceMotion) => {
        if (active && reduceMotion) {
          animation.stop();
          peekAnim.setValue(0);
        }
      })
      .catch(() => {});

    animation.start();
    return () => {
      active = false;
      animation.stop();
      peekAnim.setValue(0);
    };
  }, [peekOnMount, disabled, peekAnim]);

  const toggleRemoveDrawer = () => {
    if (disabled) return;
    if (showRemove) {
      setShowRemove(false);
      swipeable.current?.close?.();
    } else {
      setShowRemove(true);
      swipeable.current?.openRight?.();
    }
  };

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      enabled={!disabled}
      friction={1.5}
      leftThreshold={64}
      rightThreshold={40}
      dragOffsetFromLeftEdge={20}
      dragOffsetFromRightEdge={20}
      overshootLeft={false}
      overshootRight={false}
      testID={`swipe-store-${storeName}`}
      childrenContainerStyle={{ backgroundColor: colors.bgApp }}
      onSwipeableWillOpen={(direction) => {
        if (!disabled) setShowRemove(direction === 'left');
      }}
      onSwipeableWillClose={() => setShowRemove(false)}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') {
          swipeable.current?.reset();
          if (!disabled) onOpen();
        }
      }}
      renderLeftActions={() => (
        <View style={[styles.action, { width: 104, backgroundColor: colors.primary }]} accessible={false} importantForAccessibility="no-hide-descendants">
          <ArrowRight size={20} color={colors.onPrimary} />
          <Text style={[styles.label, { color: colors.onPrimary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Add items</Text>
        </View>
      )}
      renderRightActions={() => (
        <View style={[styles.action, { width: 80, backgroundColor: colors.danger }]}>
          {showRemove && !disabled ? (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={onRemove}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${storeName} from your list`}
              testID={`remove-store-${storeName}`}
            >
              <Trash2 size={20} color="#FFFFFF" />
              <Text style={[styles.label, { color: '#FFFFFF' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    >
      <Animated.View
        style={[
          styles.rowContent,
          {
            borderBottomColor: borderBottomColor ?? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9'),
            transform: [{ translateX: peekAnim }],
          },
        ]}
      >
        <View style={styles.mainSlot}>{children}</View>
        {!disabled ? (
          <TouchableOpacity
            style={[
              styles.indicatorBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.28)' : '#FECACA',
              },
            ]}
            onPress={toggleRemoveDrawer}
            hitSlop={PortalTouchTargets.compactHitSlop}
            accessibilityRole="button"
            accessibilityLabel={showRemove ? `Hide remove button for ${storeName}` : `Show remove button for ${storeName}`}
            accessibilityHint="Slides open the Remove button for this store, or swipe left on the row"
            testID={`remove-indicator-${storeName}`}
          >
            <ChevronsLeft size={14} color={colors.danger} strokeWidth={2.2} />
            <Trash2 size={14} color={colors.danger} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: BorderRadius.md },
  removeButton: { alignSelf: 'stretch', flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
  },
  mainSlot: {
    flex: 1,
  },
  indicatorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 48,
    minHeight: 38,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
