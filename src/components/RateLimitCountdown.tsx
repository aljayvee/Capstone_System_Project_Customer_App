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

function formatRemaining(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export const RateLimitCountdown: React.FC<RateLimitCountdownProps> = ({
  seconds,
  message = 'Too many tries. You can try again shortly.',
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
          backgroundColor: colors.warningBg,
          borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : colors.warning + '33',
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <ShieldAlert size={14} color={colors.warning} />
          <Text style={[styles.badgeText, { color: colors.warning }]} maxFontSizeMultiplier={1.2}>
            Please wait
          </Text>
        </View>
        <View style={[styles.timerPill, { backgroundColor: colors.card }]}>
          <Clock size={12} color={colors.warning} />
          <Text style={[styles.timerText, { color: colors.warning }]} maxFontSizeMultiplier={1.2}>
            {formatRemaining(timeLeft)}
          </Text>
        </View>
      </View>

      <Text style={[styles.message, { color: colors.warning }]} maxFontSizeMultiplier={1.2}>
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
  },
  message: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
  },
});

export default RateLimitCountdown;
