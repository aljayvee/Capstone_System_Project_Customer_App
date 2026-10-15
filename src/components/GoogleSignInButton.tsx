import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  AuthFontSizeMultipliers,
  scaledFontSize,
} from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  loadingText?: string | null;
  disabled?: boolean;
  text?: string;
  testID?: string;
}

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {/* Red */}
      <Path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
      />
      {/* Blue */}
      <Path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      {/* Yellow */}
      <Path
        fill="#FBBC05"
        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
      />
      {/* Green */}
      <Path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"
      />
    </Svg>
  );
}

export default function GoogleSignInButton({
  onPress,
  loading = false,
  loadingText,
  disabled = false,
  text = 'Continue with Google',
  testID = 'google-signin-button',
}: GoogleSignInButtonProps) {
  const { colors, isDark } = useThemeColor();

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.button,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#FFFFFF',
          shadowOpacity: isDark ? 0.25 : 0.06,
        },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={loading && loadingText ? loadingText : text}
    >
      {loading ? (
        <View style={styles.contentRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          {loadingText ? (
            <Text
              style={[
                styles.text,
                { color: isDark ? '#F8FAFC' : '#1E293B' },
              ]}
              maxFontSizeMultiplier={AuthFontSizeMultipliers.button}
            >
              {loadingText}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.contentRow}>
          <GoogleLogo />
          <Text
            style={[
              styles.text,
              { color: isDark ? '#F8FAFC' : '#1E293B' },
            ]}
            maxFontSizeMultiplier={AuthFontSizeMultipliers.button}
          >
            {text}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.2,
    borderTopWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  text: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(15, 0.2),
    letterSpacing: 0.1,
  },
  disabled: {
    opacity: 0.6,
  },
});
