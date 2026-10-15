import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Pressable,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';

export interface TrueNativeModalProps {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  testID?: string;
  backdropDismiss?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  backdropOpacity?: number;
}

/**
 * TrueNativeModal
 *
 * Replaces stock React Native modal fades ("AI-slop popups") with tactile,
 * physical motion:
 * - Entrance: Card rises and settles (+14dp -> 0dp, 0.94x -> 1.0x scale) with
 *   Material 3 Emphasized Deceleration while the backdrop smoothly dims.
 * - Exit: Card gently accelerates downward (+10dp, 0.96x scale) while fading
 *   before unmounting, eliminating abrupt cut-offs.
 * - 100% useNativeDriver execution on RenderThread / CADisplayLink.
 */
export default function TrueNativeModal({
  visible,
  onClose,
  children,
  testID,
  backdropDismiss = true,
  contentStyle,
  containerStyle,
  backdropOpacity = 0.54,
}: TrueNativeModalProps) {
  const [mounted, setMounted] = useState(visible);

  // Animation drivers
  const animProgress = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const startEnterAnimation = useCallback(() => {
    isClosingRef.current = false;
    animProgress.setValue(0);
    Animated.parallel([
      Animated.timing(animProgress, {
        toValue: 1,
        duration: 250,
        easing: Easing.bezier(0.05, 0.7, 0.1, 1.0), // Material 3 Emphasized Decelerate
        useNativeDriver: true,
      }),
    ]).start();
  }, [animProgress]);

  const startExitAnimation = useCallback((onComplete?: () => void) => {
    isClosingRef.current = true;
    Animated.timing(animProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.bezier(0.3, 0.0, 0.8, 0.15), // Material 3 Emphasized Accelerate
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        isClosingRef.current = false;
        onComplete?.();
      }
    });
  }, [animProgress]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      startEnterAnimation();
    } else if (mounted && !isClosingRef.current) {
      startExitAnimation();
    }
  }, [visible, mounted, startEnterAnimation, startExitAnimation]);

  const handleBackdropPress = () => {
    if (!backdropDismiss || isClosingRef.current) return;
    if (onClose) {
      startExitAnimation(() => {
        onClose();
      });
    }
  };

  const handleRequestClose = () => {
    if (isClosingRef.current) return;
    if (onClose) {
      startExitAnimation(() => {
        onClose();
      });
    }
  };

  if (!mounted) {
    return null;
  }

  const backdropAnimatedStyle = {
    opacity: animProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, backdropOpacity],
    }),
  };

  const cardAnimatedStyle = {
    opacity: animProgress.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0, 0.85, 1],
    }),
    transform: [
      {
        scale: animProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1.0],
        }),
      },
      {
        translateY: animProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
      testID={testID}
      statusBarTranslucent
    >
      <View style={[styles.modalRoot, containerStyle]}>
        {/* Soft Dim Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="Close dialog"
          />
        </Animated.View>

        {/* Tactile Elevating Card */}
        <Animated.View
          style={[styles.cardContainer, contentStyle, cardAnimatedStyle]}
          renderToHardwareTextureAndroid={true}
          needsOffscreenAlphaCompositing={Platform.OS === 'android'}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  cardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
