import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Wrench, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/apiClient';
import { FontSizes, FontFamily, Spacing } from '../config/theme';

interface MaintenanceScreenProps {
  onRestored?: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ onRestored }) => {
  const { colors, isDark } = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let intervalId: any;

    const checkHealth = async () => {
      try {
        const res = await apiClient.get('/health');
        if (res.status === 200) {
          setIsOnline(true);
          setTimeout(() => {
            onRestored?.();
          }, 1500);
        }
      } catch {
        // Still down
      }
    };

    intervalId = setInterval(checkHealth, 10000);
    return () => clearInterval(intervalId);
  }, [onRestored]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const res = await apiClient.get('/health');
      if (res.status === 200) {
        setIsOnline(true);
        setTimeout(() => {
          onRestored?.();
        }, 1000);
      }
    } catch {
      // Still in maintenance
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconBox, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
          <Wrench size={32} color={colors.warning} />
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>HTTP 503 • Maintenance</Text>
        </View>

        <Text style={[styles.title, { color: colors.textDark }]}>System Upgrades in Progress</Text>

        <Text style={[styles.description, { color: colors.textGray }]}>
          We are currently improving server performance and running scheduled maintenance. Services will resume shortly.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: colors.bgGray, borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textLight }]}>Expected Window:</Text>
          <Text style={[styles.infoValue, { color: colors.textDark }]}>Under 15 minutes</Text>
        </View>

        {isOnline ? (
          <View style={styles.successRow}>
            <CheckCircle2 size={16} color="#065F46" />
            <Text style={styles.successText}>Systems restored! Resuming app...</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleManualCheck}
            disabled={isChecking}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <RefreshCw size={15} color="#FFFFFF" />
                <Text style={styles.buttonText}>Check Status Now</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

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
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    color: '#92400E',
    fontSize: 10,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: FontSizes.lg,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBox: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  infoLabel: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.medium,
  },
  infoValue: {
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.bold,
  },
  button: {
    width: '100%',
    height: 46,
    borderRadius: 14,
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
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  successText: {
    color: '#065F46',
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.bold,
  },
});

export default MaintenanceScreen;
