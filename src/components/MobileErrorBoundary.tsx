import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { FontSizes, FontFamily, Spacing } from '../config/theme';

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
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <AlertTriangle size={32} color="#DC2626" />
            </View>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>Runtime Protection</Text>
            </View>

            <Text style={styles.title}>
              {this.props.fallbackTitle || 'Something went wrong'}
            </Text>

            <Text style={styles.description}>
              {this.props.fallbackDescription ||
                'A component encountered an unexpected error. Your saved data and session remain secure.'}
            </Text>

            <View style={styles.incidentRow}>
              <Text style={styles.incidentLabel}>Incident Ref:</Text>
              <Text style={styles.incidentCode}>#{this.state.incidentId}</Text>
            </View>

            <TouchableOpacity onPress={this.handleReload} style={styles.button}>
              <RefreshCw size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  badgeText: {
    color: '#F87171',
    fontSize: 10,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: FontSizes.lg,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  description: {
    color: '#94A3B8',
    fontSize: FontSizes.xs,
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
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: Spacing.xs,
  },
  incidentLabel: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },
  incidentCode: {
    color: '#FBBF24',
    fontSize: 11,
    fontFamily: FontFamily.monoBold,
  },
  button: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xs,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.bold,
  },
});

export default MobileErrorBoundary;
