import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, FileCheck, Store, ShoppingBag, Bike, CheckCircle2 } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { BorderRadius, FontFamily, Spacing, PortalFontSizes, scaledPortalFontSize } from '../config/theme';
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
      <View style={styles.spotlightCard}>
        <View style={[styles.spotlightIconWrapper, { backgroundColor: colors.bgGray }]}>
          <ActiveIcon size={19} color={colors.textGray} strokeWidth={1.8} />
        </View>
        <View style={styles.spotlightTextCol}>
          <Text style={[styles.spotlightTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
            {activeLabel}
          </Text>
          {subLabel ? (
            <Text style={[styles.spotlightSub, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
              {subLabel}
            </Text>
          ) : (
            <Text style={[styles.spotlightSub, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
              {currentIndex === 4 ? 'Your errand has been delivered.' : `Step ${currentIndex + 1} of ${ERRAND_PROGRESS_LABELS.length}`}
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
            ? (isDark ? colors.primary : colors.primaryStrong)
            : colors.bgGray;

          const iconColor = isDone ? colors.onSuccess : isCurrent ? colors.onPrimary : colors.textGray;

          return (
            <React.Fragment key={index}>
              <View
                style={styles.stepNode}
                accessible
                accessibilityLabel={`Step ${index + 1} of ${ERRAND_PROGRESS_LABELS.length}, ${ERRAND_PROGRESS_LABELS[index]}, ${isDone ? 'completed' : isCurrent ? 'current step' : 'upcoming'}`}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: circleBg },
                  ]}
                >
                  {isDone ? (
                    <Check size={14} color={iconColor} strokeWidth={3} />
                  ) : (
                    <StepIcon size={14} color={iconColor} strokeWidth={2.2} />
                  )}
                </View>
                <Text
                  numberOfLines={2}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.85}
                  maxFontSizeMultiplier={1.1}
                  style={[
                    styles.nodeLabel,
                    {
                      color: isCurrent || isDone ? colors.textDark : colors.textGray,
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
                            : colors.border,
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
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  spotlightIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightTextCol: {
    flex: 1,
  },
  spotlightTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: 21,
  },
  spotlightSub: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: 19,
    marginTop: 4,
  },
  trackContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  nodeLabel: {
    minHeight: 32,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: 16,
    textAlign: 'center',
  },
  connectorWrapper: {
    flex: 1,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  connectorLine: {
    height: 2.5,
    width: '100%',
    borderRadius: 2,
  },
});

