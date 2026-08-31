import React, { useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  House,
  ClipboardList,
  Plus,
  MapPin,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react-native';
import { NavigationBar } from 'expo-navigation-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, moderateScale, scaledFontSize } from '../config/theme';

export type PortalTab = 'home' | 'errands' | 'track' | 'chat';

interface TabConfig {
  key: string;
  Icon: LucideIcon;
  label: string;
  isCenter?: boolean;
}

const TABS: TabConfig[] = [
  { key: 'home', Icon: House, label: 'Home' },
  { key: 'errands', Icon: ClipboardList, label: 'My Errand' },
  { key: 'pabili', Icon: Plus, label: 'Pabili', isCenter: true },
  { key: 'track', Icon: MapPin, label: 'Track' },
  { key: 'chat', Icon: MessageCircle, label: 'Chat' },
];

export interface BottomNavProps {
  active: PortalTab;
  onChange: (tab: PortalTab) => void;
  onPabiliPress?: () => void;
}

const DOME_HEIGHT = 16;
const BAR_BODY_HEIGHT = 56;

/**
 * Generates smooth SVG cubic Bezier path for the upward scooped wave contour
 */
function getCurvedPath(width: number, totalHeight: number) {
  const cx = width / 2;
  const spread = 40; // Half-width spread of the upward wave
  const yBase = DOME_HEIGHT; // Baseline of the horizontal flat bar
  const yApex = 2; // Peak height of the upward dome

  // Enclosed background fill path
  const fillPath = [
    `M 0 ${yBase}`,
    `L ${cx - spread} ${yBase}`,
    `C ${cx - 20} ${yBase}, ${cx - 20} ${yApex}, ${cx} ${yApex}`,
    `C ${cx + 20} ${yApex}, ${cx + 20} ${yBase}, ${cx + spread} ${yBase}`,
    `L ${width} ${yBase}`,
    `L ${width} ${totalHeight}`,
    `L 0 ${totalHeight}`,
    'Z',
  ].join(' ');

  // Subtle top border contour path
  const borderPath = [
    `M 0 ${yBase}`,
    `L ${cx - spread} ${yBase}`,
    `C ${cx - 20} ${yBase}, ${cx - 20} ${yApex}, ${cx} ${yApex}`,
    `C ${cx + 20} ${yApex}, ${cx + 20} ${yBase}, ${cx + spread} ${yBase}`,
    `L ${width} ${yBase}`,
  ].join(' ');

  return { fillPath, borderPath };
}

/**
 * Standard Side Tab Item with Liquid Floating Dynamics
 */
function StandardTabItem({
  tab,
  selected,
  onPress,
  colors,
}: {
  tab: TabConfig;
  selected: boolean;
  onPress: () => void;
  colors: any;
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const iconBloom = useSharedValue(selected ? 1.06 : 1.0);

  useEffect(() => {
    translateY.value = withSpring(selected ? -3 : 0, {
      damping: 14,
      stiffness: 180,
      mass: 0.8,
    });
    iconBloom.value = withSpring(selected ? 1.06 : 1.0, {
      damping: 14,
      stiffness: 190,
    });
  }, [selected]);

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * iconBloom.value },
      { translateY: translateY.value },
    ],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.90, { duration: 60, easing: Easing.out(Easing.quad) });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 220 });
  };

  const { Icon, label, key } = tab;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.standardItem}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={`bottom-nav-${key}`}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      <Animated.View
        style={[styles.tabContent, animatedContentStyle]}
        renderToHardwareTextureAndroid={true}
      >
        <View style={styles.iconBox}>
          <Icon
            size={moderateScale(21, 0.3)}
            color={selected ? colors.primary : colors.textGray}
            strokeWidth={selected ? 2.4 : 1.8}
          />
        </View>
        <Text
          style={[
            styles.label,
            { color: selected ? colors.primary : colors.textGray },
            selected && styles.labelActive,
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.15}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Concentric Elevated Center Dome Action Button with Liquid Bloom Ripple ("(+) Pabili")
 */
function CenterPabiliTabItem({
  tab,
  onPress,
  colors,
}: {
  tab: TabConfig;
  onPress: () => void;
  colors: any;
}) {
  const scale = useSharedValue(1);
  const iconRotate = useSharedValue(0);
  const rippleScale = useSharedValue(0.8);
  const rippleOpacity = useSharedValue(0);

  const domeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotate.value}deg` }],
  }));

  const rippleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.88, { duration: 60 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 220 });
  };

  const handlePress = () => {
    // Liquid ripple wave bloom
    rippleScale.value = 0.8;
    rippleOpacity.value = 0.55;
    rippleScale.value = withTiming(1.5, { duration: 360, easing: Easing.out(Easing.cubic) });
    rippleOpacity.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.quad) });

    // Micro rotation & elastic bloom on '+' icon
    iconRotate.value = withSequence(
      withTiming(-16, { duration: 50 }),
      withTiming(16, { duration: 80 }),
      withSpring(0, { damping: 10, stiffness: 220 })
    );

    scale.value = withSequence(
      withTiming(0.86, { duration: 60 }),
      withSpring(1.08, { damping: 8, stiffness: 240 }),
      withSpring(1.0, { damping: 12, stiffness: 200 })
    );

    onPress();
  };

  const { Icon, label, key } = tab;

  return (
    <View style={styles.centerSlot}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.centerPressable}
        accessibilityRole="button"
        accessibilityLabel="Start New Pabili Errand"
        testID={`bottom-nav-${key}`}
        hitSlop={{ top: 10, bottom: 6, left: 8, right: 8 }}
      >
        <Animated.View
          style={[styles.domeContainer, domeAnimatedStyle]}
          renderToHardwareTextureAndroid={true}
        >
          {/* Liquid Ripple Bloom Ring */}
          <Animated.View
            style={[
              styles.liquidRipple,
              { backgroundColor: colors.primary },
              rippleAnimatedStyle,
            ]}
            pointerEvents="none"
          />

          {/* Inner Concentric Floating Button */}
          <View
            style={[
              styles.innerPabiliCore,
              {
                backgroundColor: colors.primary,
              },
              styles.pabiliShadow,
            ]}
          >
            <Animated.View style={iconAnimatedStyle}>
              <Icon size={moderateScale(20, 0.3)} color="#FFFFFF" strokeWidth={2.6} />
            </Animated.View>
          </View>

          {/* Center Label */}
          <Text
            style={[
              styles.centerLabel,
              {
                color: colors.primary,
                fontFamily: FontFamily.bold,
              },
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.15}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

export default function BottomNav({ active, onChange, onPabiliPress }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColor();
  const { width: screenWidth } = useWindowDimensions();

  const bottomInset = Math.max(insets.bottom, 6);
  const totalNavHeight = DOME_HEIGHT + BAR_BODY_HEIGHT + bottomInset;

  const { fillPath, borderPath } = useMemo(
    () => getCurvedPath(screenWidth, totalNavHeight),
    [screenWidth, totalNavHeight]
  );

  return (
    <View style={[styles.navContainer, { height: totalNavHeight }]}>
      {Platform.OS === 'android' && <NavigationBar style={isDark ? 'dark' : 'light'} />}

      {/* 1. SVG CURVED BACKGROUND SURFACE WITH TOP BORDER */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={screenWidth} height={totalNavHeight}>
          {/* Main Background Fill */}
          <Path
            d={fillPath}
            fill={colors.card}
          />
          {/* Subtle Continuous Top Edge Stroke */}
          <Path
            d={borderPath}
            fill="none"
            stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'}
            strokeWidth={1.2}
          />
        </Svg>
      </View>

      {/* 2. TAB ITEMS ROW */}
      <View
        style={[
          styles.tabRow,
          {
            paddingTop: DOME_HEIGHT + 4,
            paddingBottom: bottomInset,
          },
        ]}
      >
        {TABS.map((tab) => {
          if (tab.isCenter) {
            return (
              <CenterPabiliTabItem
                key={tab.key}
                tab={tab}
                onPress={() => {
                  if (onPabiliPress) {
                    onPabiliPress();
                  } else {
                    onChange('home');
                  }
                }}
                colors={colors}
              />
            );
          }

          const selected = tab.key === active;

          return (
            <StandardTabItem
              key={tab.key}
              tab={tab}
              selected={selected}
              onPress={() => onChange(tab.key as PortalTab)}
              colors={colors}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    width: '100%',
  },
  standardItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: 44,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(10, 0.3),
    marginTop: 2,
  },
  labelActive: {
    fontFamily: FontFamily.bold,
  },
  centerSlot: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: -DOME_HEIGHT - 4,
  },
  centerPressable: {
    alignItems: 'center',
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
  },
  domeContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  liquidRipple: {
    position: 'absolute',
    top: 0,
    width: moderateScale(42, 0.3),
    height: moderateScale(42, 0.3),
    borderRadius: moderateScale(21, 0.3),
  },
  innerPabiliCore: {
    width: moderateScale(42, 0.3),
    height: moderateScale(42, 0.3),
    borderRadius: moderateScale(21, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pabiliShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2.5 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 5,
  },
  centerLabel: {
    fontSize: scaledFontSize(10, 0.3),
    marginTop: 2,
  },
});
