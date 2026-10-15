import React, { useEffect, useState, type RefObject } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House,
  ClipboardList,
  Search,
  Route,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react-native';
import { NavigationBar } from 'expo-navigation-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  moderateScale,
  PortalTouchTargets,
  FontFamily,
  PortalFontSizeMultipliers,
} from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { GlassLayers, glassRim } from './glass/LiquidGlass';

/**
 * 'search' is Find stores as a tab (2026-10-14): the bar's Search button opens
 * it here, under the bar, instead of as a screen that covered the bar.
 */
export type PortalTab = 'home' | 'errands' | 'search' | 'track' | 'chat';

interface TabConfig {
  key: string;
  Icon: LucideIcon;
  label: string;
  isCenter?: boolean;
}

// Brand color tokens & Default Gray accents
const COLOR_BLACK = '#010013';
// One step darker in light mode since the bar became liquid glass (2026-10-11):
// slate-800 / slate-500 were lost over store photos showing through it.
const COLOR_ACTIVE_GRAY_LIGHT = '#0F172A';  // Slate-900
const COLOR_ACTIVE_GRAY_DARK = '#F1F5F9';   // Slate-100 default crisp gray
const COLOR_INACTIVE_GRAY_LIGHT = '#334155'; // Slate-700
const COLOR_INACTIVE_GRAY_DARK = '#94A3B8';  // Slate-400 muted gray

const TABS: TabConfig[] = [
  { key: 'home', Icon: House, label: 'Home' },
  { key: 'errands', Icon: ClipboardList, label: 'Errands' },
  { key: 'pabili', Icon: Search, label: 'Search' },
  // A rider's route (2026-10-11): the tab follows the errand on the road. It was
  // a map pin, which reads as "your location", now the header's job.
  { key: 'track', Icon: Route, label: 'Track' },
  { key: 'chat', Icon: MessageCircle, label: 'Chat' },
];

export interface BottomNavProps {
  active: PortalTab;
  onChange: (tab: PortalTab) => void;
  onPabiliPress?: () => void;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  labelsVisible?: boolean;
  onLabelsVisibilityChange?: (visible: boolean) => void;
  /** The tab content under the bar, for its glass to blur on Android (components/glass/LiquidGlass.tsx). */
  blurTarget?: RefObject<View | null>;
}

/**
 * Standard Tab Item with Apple Liquid Glass balance, Pink Fill on Click,
 * and animated hide/show labels on swipe/scroll.
 */
function StandardTabItem({
  tab,
  selected,
  labelsVisible,
  isLight,
  onPress,
}: {
  tab: TabConfig;
  selected: boolean;
  labelsVisible: boolean;
  isLight: boolean;
  onPress: () => void;
}) {
  const labelOpacity = useSharedValue(labelsVisible ? 1 : 0);
  const labelTranslateY = useSharedValue(labelsVisible ? 0 : 5);
  const labelHeight = useSharedValue(labelsVisible ? 13 : 0);
  const iconTranslateY = useSharedValue(labelsVisible ? -1 : 0);

  const showDot = selected && !labelsVisible;
  const dotScale = useSharedValue(showDot ? 1 : 0);
  const dotOpacity = useSharedValue(showDot ? 1 : 0);

  useEffect(() => {
    labelOpacity.value = withTiming(labelsVisible ? 1 : 0, {
      duration: 160,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    labelTranslateY.value = withTiming(labelsVisible ? 0 : 5, {
      duration: 160,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    labelHeight.value = withTiming(labelsVisible ? 13 : 0, {
      duration: 180,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    iconTranslateY.value = withTiming(labelsVisible ? -1 : 0, {
      duration: 160,
    });

    const isShowingDot = selected && !labelsVisible;
    dotScale.value = withSpring(isShowingDot ? 1 : 0, {
      damping: 15,
      stiffness: 220,
    });
    dotOpacity.value = withTiming(isShowingDot ? 1 : 0, {
      duration: 140,
    });
  }, [labelsVisible, selected]);


  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconTranslateY.value }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: labelTranslateY.value }],
    height: labelHeight.value,
  }));

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotOpacity.value,
  }));

  const { Icon, label, key } = tab;

  // Default gray color tokens for active and inactive states
  const activeColor = isLight ? COLOR_ACTIVE_GRAY_LIGHT : COLOR_ACTIVE_GRAY_DARK;
  const inactiveColor = isLight ? COLOR_INACTIVE_GRAY_LIGHT : COLOR_INACTIVE_GRAY_DARK;

  return (
    <Pressable
      onPress={onPress}
      style={styles.standardItem}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={`bottom-nav-${key}`}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      <View style={styles.tabContent}>
        <Animated.View style={animatedIconStyle}>
          {/* Active state in default gray */}
          <Icon
            size={moderateScale(21, 0.3)}
            color={selected ? activeColor : inactiveColor}
            fill={selected ? activeColor : 'none'}
            strokeWidth={selected ? 2.2 : 1.85}
          />
        </Animated.View>

        {/* Balanced Text Label under Icon */}
        <Animated.View style={[styles.labelWrapper, animatedLabelStyle]}>
          <Text
            style={[
              styles.tabLabelText,
              {
                color: selected ? activeColor : inactiveColor,
                fontFamily: selected ? FontFamily.bold : FontFamily.medium,
              },
              // A faint white halo, so a label still reads over a busy photo
              // under the clear glass.
              isLight && styles.labelHalo,
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
            testID={`bottom-nav-label-${key}`}
          >
            {label}
          </Text>
        </Animated.View>

        {/* Sleek Active Dot Indicator in default gray (fallback when labels are collapsed) */}
        <Animated.View
          style={[
            styles.activeDot,
            { backgroundColor: activeColor },
            animatedDotStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}

/**
 * Floating Apple Liquid Glass Bottom Navigation
 * Ultra-clear optical glass, specular rim glint, high-contrast drop shadow on white,
 * balanced icons/text, and Pink fill on selection.
 */
export default function BottomNav({
  active,
  onChange,
  onPabiliPress,
  visible: visibleProp,
  onVisibilityChange,
  labelsVisible: labelsVisibleProp,
  onLabelsVisibilityChange,
  blurTarget,
}: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeColor();
  const isLight = !isDark;
  const bottomMargin = Math.max(insets.bottom, 12);
  // Light mode is liquid glass (2026-10-11): the capsule itself is clear and the
  // glass is drawn inside it (GlassLayers), as on the active errands button.
  const liquid = isLight;

  const [internalVisible, setInternalVisible] = useState(true);
  const isVisibleControlled = visibleProp !== undefined;
  const isNavVisible = isVisibleControlled ? visibleProp : internalVisible;

  const handleToggleVisible = (visible: boolean) => {
    if (!isVisibleControlled) {
      setInternalVisible(visible);
    }
    if (onVisibilityChange) {
      onVisibilityChange(visible);
    }
  };

  const [internalLabelsVisible, setInternalLabelsVisible] = useState(true);
  const isControlled = labelsVisibleProp !== undefined;
  const labelsVisible = isControlled ? labelsVisibleProp : internalLabelsVisible;

  const handleToggleLabels = (visible: boolean) => {
    if (!isControlled) {
      setInternalLabelsVisible(visible);
    }
    if (onLabelsVisibilityChange) {
      onLabelsVisibilityChange(visible);
    }
  };

  // Animation for smooth hide/show of the bottom navigation bar on scroll/swipe.
  // Translating down by 140dp moves the capsule and its drop shadow completely off-screen.
  const HIDE_OFFSET = 140;
  const navTranslateY = useSharedValue(isNavVisible ? 0 : HIDE_OFFSET);

  useEffect(() => {
    navTranslateY.value = withTiming(isNavVisible ? 0 : HIDE_OFFSET, {
      duration: 280,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isNavVisible]);

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navTranslateY.value }],
  }));

  // Apple Liquid Glass dynamic surface styling:
  // In Light Mode, instead of pure white/milky frost, we use high-clarity optical glass with
  // a crisp slate refraction border and deep elevation shadow so it has unmistakable definition on white.
  const capsuleBackground = isLight
    ? 'transparent'
    : 'rgba(20, 20, 22, 0.90)';

  const capsuleBorder = isLight
    ? 'rgba(15, 23, 42, 0.16)'  // Crisp chiseled slate border
    : 'rgba(255, 255, 255, 0.14)';

  const capsuleBorderTop = isLight
    ? 'rgba(255, 255, 255, 0.95)' // Specular top reflection glint
    : 'rgba(255, 255, 255, 0.28)';

  const shadowColor = isLight ? '#0F172A' : '#000000';
  const shadowOpacity = isLight ? 0.16 : 0.45;
  const shadowRadius = 22;
  const elevation = isLight ? 12 : 14;

  return (
    <View style={styles.navWrapper} pointerEvents="box-none">
      {Platform.OS === 'android' && (
        <NavigationBar style={isLight ? 'dark' : 'light'} />
      )}

      {/* FLOATING APPLE LIQUID GLASS CAPSULE */}
      <Animated.View
        testID="bottom-nav-capsule"
        pointerEvents={isNavVisible ? 'auto' : 'none'}
        style={[
          styles.floatingCapsule,
          animatedCapsuleStyle,
          {
            backgroundColor: capsuleBackground,
            borderColor: capsuleBorder,
            borderTopColor: capsuleBorderTop,
            ...(liquid ? glassRim(false, 'liquid') : {}),
            shadowColor,
            shadowOpacity,
            shadowRadius,
            elevation,
            marginBottom: bottomMargin,
          },
        ]}
      >
        {liquid ? (
          <View pointerEvents="none" style={styles.glassClip} testID="bottom-nav-glass">
            <GlassLayers clarity="liquid" blurTarget={blurTarget} testID="bottom-nav-glass" />
          </View>
        ) : null}
        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isCenter = tab.key === 'pabili';
            const selected = isCenter ? active === 'search' : tab.key === active;

            return (
              <StandardTabItem
                key={tab.key}
                tab={tab}
                selected={selected}
                labelsVisible={labelsVisible}
                isLight={isLight}
                onPress={() => {
                  if (isCenter) {
                    // A screen can still take the press itself; otherwise
                    // Search is a tab, and the bar stays (2026-10-14).
                    if (onPabiliPress) {
                      onPabiliPress();
                    } else {
                      onChange('search');
                    }
                  } else {
                    onChange(tab.key as PortalTab);
                  }
                }}
              />
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  floatingCapsule: {
    width: '92%',
    maxWidth: 420,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.2,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
  },
  labelHalo: {
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  // The liquid glass inside the capsule, clipped to its curve.
  glassClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: '100%',
  },
  standardItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: PortalTouchTargets.minTouchTarget,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    width: '90%',
    borderRadius: 20,
    paddingTop: 6,
    paddingBottom: 2,
  },
  labelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    overflow: 'hidden',
  },
  tabLabelText: {
    fontSize: 10.5,
    lineHeight: 12.5,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  activeDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    marginTop: 3,
  },
});

