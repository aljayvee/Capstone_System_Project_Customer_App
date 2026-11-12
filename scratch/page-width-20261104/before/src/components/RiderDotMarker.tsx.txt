import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Bike } from 'lucide-react-native';

/**
 * Custom Rider Live Location Marker for react-native-maps.
 * Features the official system logo icon (`Bike`) inside a circular badge
 * with an animated pulsing radar aura ring. Bounding containers are explicitly transparent
 * to ensure zero square background box artifacts on Android/iOS map view layers.
 */
export default function RiderDotMarker() {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const ringScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });

  return (
    <View style={styles.container}>
      {/* Animated pulsing outer radar aura ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      {/* Circular pin badge containing Official System Logo Icon */}
      <View style={styles.circleBadge}>
        <Bike size={16} color="#FFFFFF" strokeWidth={2.5} />
      </View>
    </View>
  );
}

const BADGE_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ring: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: 'rgba(246, 36, 89, 0.35)',
  },
  circleBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#F62459',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
