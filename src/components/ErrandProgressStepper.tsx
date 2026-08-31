import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, FileCheck, Store, ShoppingBag, Bike, CheckCircle2 } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, FontFamily, FontSizes, Spacing, Shadows, scaledFontSize, moderateScale } from '../config/theme';
import { ERRAND_PROGRESS_LABELS } from '../utils/errandProgress';

export interface ErrandProgressStepperProps {
  currentIndex: number;
  subLabel?: string;
}

const STAGE_ICONS = [FileCheck, Store, ShoppingBag, Bike, CheckCircle2];
const SHORT_LABELS = ['Received', 'To Store', 'Buying', 'In Route', 'Delivered'];

export default function ErrandProgressStepper({ currentIndex, subLabel }: ErrandProgressStepperProps) {
  const { colors, isDark } = useThemeColor();

  const activeLabel = ERRAND_PROGRESS_LABELS[currentIndex] || 'Processing Errand';
  const ActiveIcon = STAGE_ICONS[currentIndex] || Bike;

  return (
    <View style={styles.container}>
      {/* Active Stage Spotlight Banner */}
      <View
        style={[
          styles.spotlightCard,
          {
            backgroundColor: isDark ? 'rgba(255, 77, 121, 0.12)' : '#FFF0F5',
            borderColor: isDark ? 'rgba(255, 77, 121, 0.25)' : '#FCE7F0',
          },
        ]}
      >
        <View style={[styles.spotlightIconWrapper, { backgroundColor: colors.primary }]}>
          <ActiveIcon size={18} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        <View style={styles.spotlightTextCol}>
          <Text style={[styles.spotlightTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
            {activeLabel}
          </Text>
          {subLabel ? (
            <Text style={[styles.spotlightSub, { color: colors.primary }]} maxFontSizeMultiplier={1.15}>
              {subLabel}
            </Text>
          ) : (
            <Text style={[styles.spotlightSub, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
              {currentIndex === 4 ? 'Mission completed successfully' : 'Live progress updating...'}
            </Text>
          )}
        </View>
      </View>

      {/* Horizontal Multi-Stage Icon Track */}
      <View style={styles.trackContainer}>
        {ERRAND_PROGRESS_LABELS.map((_, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const StepIcon = STAGE_ICONS[index];

          const circleBg = isDone
            ? colors.success
            : isCurrent
            ? colors.primary
            : isDark
            ? 'rgba(255,255,255,0.06)'
            : '#F3F4F6';

          const iconColor = isDone || isCurrent ? '#FFFFFF' : colors.textLight;

          return (
            <React.Fragment key={index}>
              <View style={styles.stepNode}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: circleBg },
                    isCurrent && styles.currentGlow,
                    isCurrent && { borderColor: isDark ? '#FFFFFF' : colors.primaryLight },
                  ]}
                >
                  {isDone ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <StepIcon size={12} color={iconColor} strokeWidth={2.4} />
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                  maxFontSizeMultiplier={1.1}
                  style={[
                    styles.nodeLabel,
                    {
                      color: isCurrent
                        ? colors.primary
                        : isDone
                        ? colors.textDark
                        : colors.textLight,
                      fontFamily: isCurrent ? FontFamily.bold : FontFamily.medium,
                    },
                  ]}
                >
                  {SHORT_LABELS[index]}
                </Text>
              </View>

              {index < ERRAND_PROGRESS_LABELS.length - 1 && (
                <View style={styles.connectorWrapper}>
                  <View
                    style={[
                      styles.connectorLine,
                      {
                        backgroundColor:
                          index < currentIndex
                            ? colors.success
                            : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : '#E5E7EB',
                      },
                    ]}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  spotlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  spotlightIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.soft,
  },
  spotlightTextCol: {
    flex: 1,
  },
  spotlightTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm + 1, 0.2),
    letterSpacing: -0.2,
  },
  spotlightSub: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(10, 0.2),
    marginTop: 2,
  },
  trackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  stepNode: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 58,
    minWidth: 44,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  currentGlow: {
    borderWidth: 2,
    transform: [{ scale: 1.12 }],
  },
  nodeLabel: {
    fontSize: scaledFontSize(9, 0.2),
    textAlign: 'center',
  },
  connectorWrapper: {
    flex: 1,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  connectorLine: {
    height: 2.5,
    width: '100%',
    borderRadius: 2,
  },
});

