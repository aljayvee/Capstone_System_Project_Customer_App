import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Pressable,
  Animated,
  Easing,
  PanResponder,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface TrueBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showDragHandle?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  backdropOpacity?: number;
  testID?: string;
}

/**
 * TrueBottomSheet
 *
 * Replaces rigid React Native slide modals ("fake drag handle AI-slop") with
 * authentic, gesture-driven bottom drawer physics:
 * - Real thumb drag physics: Grab the drag handle or header to drag down.
 * - Dynamic backdrop dimming that lightens proportionally as you pull down.
 * - Velocity-aware flick-to-dismiss (flick down quickly to dismiss).
 * - Rubber-band spring snapback if the user releases prematurely.
 * - 100% useNativeDriver on the RenderThread / CADisplayLink.
 */
export default function TrueBottomSheet({
  visible,
  onClose,
  children,
  showDragHandle = true,
  contentStyle,
  containerStyle,
  backdropOpacity = 0.54,
  testID,
}: TrueBottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const defaultSheetHeight = Math.min(screenHeight * 0.85, 700);

  const [mounted, setMounted] = useState(visible);

  // Animated values
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const animBackdrop = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // Start entrance animation
  const startEnterAnimation = useCallback(() => {
    isClosingRef.current = false;
    translateY.setValue(screenHeight);
    animBackdrop.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.05, 0.7, 0.1, 1.0), // Material 3 Emphasized Decelerate
        useNativeDriver: true,
      }),
      Animated.timing(animBackdrop, {
        toValue: 1,
        duration: 260,
        easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenHeight, translateY, animBackdrop]);

  // Start exit animation
  const startExitAnimation = useCallback(
    (onComplete?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 220,
          easing: Easing.bezier(0.3, 0.0, 0.8, 0.15), // Material 3 Emphasized Accelerate
          useNativeDriver: true,
        }),
        Animated.timing(animBackdrop, {
          toValue: 0,
          duration: 200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          isClosingRef.current = false;
          onComplete?.();
        }
      });
    },
    [screenHeight, translateY, animBackdrop]
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      startEnterAnimation();
    } else if (mounted && !isClosingRef.current) {
      startExitAnimation();
    }
  }, [visible, mounted, startEnterAnimation, startExitAnimation]);

  const handleDismiss = useCallback(() => {
    startExitAnimation(() => {
      onClose();
    });
  }, [startExitAnimation, onClose]);

  // PanResponder for tactile thumb dragging on header/handle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only claim gesture if user is dragging downwards
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (isClosingRef.current) return;
        // Dampen upward dragging, track 1:1 downward dragging
        const newY = gestureState.dy < 0 ? gestureState.dy * 0.2 : gestureState.dy;
        translateY.setValue(newY);

        // Proportional backdrop dimming
        const progress = Math.max(0, 1 - gestureState.dy / defaultSheetHeight);
        animBackdrop.setValue(progress);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isClosingRef.current) return;

        // Dismiss threshold: dragged > 25% or flicked downwards with high velocity
        if (gestureState.dy > defaultSheetHeight * 0.25 || gestureState.vy > 0.55) {
          handleDismiss();
        } else {
          // Spring snap-back
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              friction: 8,
              tension: 50,
              useNativeDriver: true,
            }),
            Animated.timing(animBackdrop, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  if (!mounted) {
    return null;
  }

  const backdropAnimatedStyle = {
    opacity: animBackdrop.interpolate({
      inputRange: [0, 1],
      outputRange: [0, backdropOpacity],
    }),
  };

  const sheetAnimatedStyle = {
    transform: [{ translateY }],
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      testID={testID}
      statusBarTranslucent
    >
      {/* Keyboard-safe for every sheet at once. Under Android edge-to-edge the
          window no longer shrinks for the keyboard, so a field in a sheet sat
          underneath it. This view spans the whole modal from the top of the
          screen, so its padding is exactly the keyboard's height, and the sheet
          (anchored to the bottom) rides up on it. paddingTop and the sheet's
          flexShrink keep a tall sheet below the status bar instead of pushing
          its header, and any search field in it, off the top. */}
      <KeyboardAvoidingView
        behavior="padding"
        style={[styles.rootContainer, { paddingTop: insets.top }, containerStyle]}
      >
        {/* Soft Backdrop with gesture tap dismissal */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          />
        </Animated.View>

        {/* Gesture-driven bottom sheet container */}
        <Animated.View
          style={[styles.sheet, contentStyle, sheetAnimatedStyle]}
          renderToHardwareTextureAndroid={true}
          needsOffscreenAlphaCompositing={Platform.OS === 'android'}
        >
          {/* Tactile drag zone */}
          <View {...panResponder.panHandlers} style={styles.dragZone}>
            {showDragHandle && (
              <View style={styles.dragHandleContainer}>
                <View style={styles.dragHandleBar} />
              </View>
            )}
          </View>

          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    zIndex: 2,
    flexShrink: 1,
  },
  dragZone: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 16,
  },
  dragHandleBar: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(150, 150, 150, 0.4)',
  },
});
