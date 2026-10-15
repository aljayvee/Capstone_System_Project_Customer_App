import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapPin, ArrowRight } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { resolveCoordinateToAddress } from '../../hooks/useReverseGeocodedAddress';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  PortalFontSizes,
  PortalFontSizeMultipliers,
  MAX_CONTENT_WIDTH,
  useResponsive,
} from '../../config/theme';

export default function OnboardingLocationScreen({ navigation }: any) {
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const [detecting, setDetecting] = useState(false);

  // Requirement: Newly installed (onCreate) does not appear the splash screen.
  // Immediately dismiss the native system splash screen on mount.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleContinue = async () => {
    if (detecting) return;
    setDetecting(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        let coords: { latitude: number; longitude: number } | null = null;
        try {
          const loc = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('GPS timeout')), 6000)
            ),
          ]);
          coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        } catch {
          // Fallback to last known position if current position times out
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown) {
              coords = {
                latitude: lastKnown.coords.latitude,
                longitude: lastKnown.coords.longitude,
              };
            }
          } catch {}
        }

        if (coords) {
          const address = await resolveCoordinateToAddress(coords);
          const detectedLocation = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            address,
          };

          try {
            await AsyncStorage.setItem(
              '@sugo_onboarding_location_draft',
              JSON.stringify(detectedLocation)
            );
          } catch {}

          navigation.navigate('OnboardingAuthChoice', { detectedLocation });
          return;
        }
      }

      // Permission denied or coordinates unavailable: clear draft & proceed with undefined detectedLocation
      await AsyncStorage.removeItem('@sugo_onboarding_location_draft').catch(() => {});
      navigation.navigate('OnboardingAuthChoice', { detectedLocation: undefined });
    } catch {
      // Defensive error handling: never block user progression
      await AsyncStorage.removeItem('@sugo_onboarding_location_draft').catch(() => {});
      navigation.navigate('OnboardingAuthChoice', { detectedLocation: undefined });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bgApp }]}
      edges={['top', 'bottom']}
    >
      <View style={[styles.container, isTablet && styles.tabletContainer]}>
        {/* Top & Hero Section */}
        <View style={styles.contentSection}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark
                  ? 'rgba(246, 36, 89, 0.12)'
                  : 'rgba(246, 36, 89, 0.08)',
                borderColor: isDark
                  ? 'rgba(246, 36, 89, 0.25)'
                  : 'rgba(246, 36, 89, 0.18)',
              },
            ]}
          >
            <MapPin size={38} color={colors.primary} strokeWidth={2.2} />
          </View>

          <Text
            style={[styles.headline, { color: colors.textDark }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
          >
            Set your delivery location
          </Text>

          <Text
            style={[styles.leadLabel, { color: colors.textMedium }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
          >
            Allow location access for:
          </Text>

          {/* Explanation Points - Clean typography, no cards, no Store/Clock icons */}
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitRow}>
              <View
                style={[
                  styles.bulletDot,
                  { backgroundColor: colors.primary },
                ]}
              />
              <Text
                style={[styles.benefitText, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                Searching the best shops near you.
              </Text>
            </View>

            <View style={styles.benefitRow}>
              <View
                style={[
                  styles.bulletDot,
                  { backgroundColor: colors.primary },
                ]}
              />
              <Text
                style={[styles.benefitText, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
              >
                Receiving more accurate and faster delivery.
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom CTA Dock */}
        <View style={styles.bottomDock}>
          <TouchableOpacity
            testID="onboarding-location-continue-btn"
            style={[
              styles.continueButton,
              {
                backgroundColor: colors.primary,
                borderColor: 'rgba(255, 255, 255, 0.22)',
                borderTopColor: 'rgba(255, 255, 255, 0.40)',
              },
              detecting && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            activeOpacity={0.88}
            disabled={detecting}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            {detecting ? (
              <View style={styles.buttonInnerRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text
                  style={styles.continueButtonText}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                >
                  Finding your location...
                </Text>
              </View>
            ) : (
              <View style={styles.buttonInnerRow}>
                <Text
                  style={styles.continueButtonText}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
                >
                  Continue
                </Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
  },
  tabletContainer: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  contentSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  headline: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  leadLabel: {
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.body,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  benefitsContainer: {
    width: '100%',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs + 2,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: Spacing.sm + 2,
  },
  benefitText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: PortalFontSizes.body,
    lineHeight: 22,
  },
  bottomDock: {
    paddingVertical: Spacing.lg,
    width: '100%',
  },
  continueButton: {
    height: 54,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  continueButtonDisabled: {
    opacity: 0.75,
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  continueButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: PortalFontSizes.body,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
