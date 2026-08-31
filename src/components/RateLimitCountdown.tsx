import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, ShieldAlert } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { FontSizes, FontFamily, Spacing } from '../config/theme';

interface RateLimitCountdownProps {
  seconds: number;
  message?: string;
  onComplete?: () => void;
  style?: object;
}

export const RateLimitCountdown: React.FC<RateLimitCountdownProps> = ({
  seconds,
  message = 'Too many requests. Temporary security cooldown active.',
  onComplete,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    setTimeLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  if (timeLeft <= 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <ShieldAlert size={14} color="#D97706" />
          <Text style={styles.badgeText}>Cooldown Active</Text>
        </View>
        <View style={[styles.timerPill, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
          <Clock size={12} color="#D97706" />
          <Text style={styles.timerText}>{timeLeft}s</Text>
        </View>
      </View>

      <Text style={[styles.message, { color: isDark ? '#FDE68A' : '#92400E' }]}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    color: '#D97706',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timerText: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.bold,
    color: '#D97706',
  },
  message: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
  },
});

export default RateLimitCountdown;
