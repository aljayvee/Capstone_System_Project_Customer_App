import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { FontSizes, FontFamily, Spacing, BorderRadius, scaledFontSize } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { RETRY_LABEL } from '../services/errorMessages';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  incidentId: string;
}

interface FallbackProps {
  title: string;
  description: string;
  incidentId: string;
  onReset: () => void;
}

/**
 * Split out of the class so it can read the theme.
 *
 * It used to hardcode a slate palette (#0F172A / #1E293B / #3B82F6) that
 * ignored both the tokens and the customer's light/dark choice, which meant the
 * one screen shown when everything else has failed was also the one screen that
 * did not look like Sugo. palette.test.ts governs these colors now.
 */
const CrashFallback: React.FC<FallbackProps> = ({ title, description, incidentId, onReset }) => {
  const { colors, isDark } = useThemeColor();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]} testID="crash-fallback">
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: isDark ? 'rgba(252,165,165,0.12)' : colors.dangerBg,
            },
          ]}
        >
          <AlertTriangle size={30} color={colors.danger} strokeWidth={2} />
        </View>

        <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>

        <Text style={[styles.description, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
          {description}
        </Text>

        <View style={[styles.incidentRow, { backgroundColor: colors.bgGray }]}>
          <Text
            style={[styles.incidentLabel, { color: colors.textGray }]}
            maxFontSizeMultiplier={1.2}
          >
            Reference
          </Text>
          <Text
            style={[styles.incidentCode, { color: colors.textMedium }]}
            maxFontSizeMultiplier={1.2}
          >
            {incidentId}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onReset}
          style={[styles.button, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={RETRY_LABEL}
          testID="crash-retry"
        >
          <RefreshCw size={16} color="#FFFFFF" />
          <Text style={styles.buttonText} maxFontSizeMultiplier={1.15}>
            {RETRY_LABEL}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export class MobileErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    incidentId: '',
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const generatedId = `APP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return { hasError: true, error, incidentId: generatedId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error('[MobileErrorBoundary Caught]', error, errorInfo);
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <CrashFallback
          // "Runtime Protection" and "A component encountered an unexpected
          // error" named the implementation rather than what happened. Nobody
          // has ever wanted a component to succeed; they wanted their errand.
          title={this.props.fallbackTitle || 'This screen stopped working'}
          description={
            this.props.fallbackDescription ||
            'Sugo hit a problem it could not recover from. Your account and anything you saved are safe.'
          }
          incidentId={this.state.incidentId}
          onReset={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: scaledFontSize(FontSizes.lg, 0.2),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  description: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.xs,
  },
  incidentLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },
  incidentCode: {
    fontSize: 11,
    fontFamily: FontFamily.monoBold,
  },
  button: {
    width: '100%',
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xs,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: scaledFontSize(FontSizes.md, 0.2),
    fontFamily: FontFamily.semibold,
  },
});

export default MobileErrorBoundary;
