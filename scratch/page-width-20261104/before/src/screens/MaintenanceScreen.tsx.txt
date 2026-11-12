import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Wrench, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../services/apiClient';
import { RETRY_LABEL } from '../services/errorMessages';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, FontFamily, Spacing } from '../config/theme';

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
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>Maintenance</Text>
        </View>

        <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
          Sugo is down for a quick update
        </Text>

        <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.description, { color: colors.textGray }]}>
          We are making Sugo faster. Everything comes back on its own, no need to reinstall.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: colors.bgGray, borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textLight }]} maxFontSizeMultiplier={1.2}>
            Usually back within
          </Text>
          <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.infoValue, { color: colors.textDark }]}>Under 15 minutes</Text>
        </View>

        {isOnline ? (
          <View style={styles.successRow}>
            <CheckCircle2 size={16} color="#065F46" />
            <Text style={styles.successText} maxFontSizeMultiplier={1.2}>Back up. Taking you in...</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleManualCheck}
            disabled={isChecking}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <RefreshCw size={15} color={colors.onPrimary} />
                <Text style={[styles.buttonText, { color: colors.onPrimary }]} maxFontSizeMultiplier={1.15}>{RETRY_LABEL}</Text>
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'),
    color: '#92400E',
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
  },
  title: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.title), 'heading'),
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  description: {
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    fontFamily: FontFamily.medium,
  },
  infoValue: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
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
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    color: '#FFFFFF',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    fontFamily: FontFamily.bold,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  successText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    color: '#065F46',
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    fontFamily: FontFamily.bold,
  },
});

export default MaintenanceScreen;
