import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff, CheckCircle2 } from 'lucide-react-native';
import { FontSizes, FontFamily, Spacing } from '../config/theme';

interface NetworkStatusPillProps {
  isOffline: boolean;
  justReconnected?: boolean;
  queuedCount?: number;
}

export const NetworkStatusPill: React.FC<NetworkStatusPillProps> = ({
  isOffline,
  justReconnected = false,
  queuedCount = 0,
}) => {
  if (!isOffline && !justReconnected) return null;

  if (justReconnected) {
    return (
      <View style={[styles.container, styles.reconnected]}>
        <CheckCircle2 size={13} color="#FFFFFF" />
        <Text style={styles.text}>Connected • Changes Synced</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.offline]}>
      <WifiOff size={13} color="#FBBF24" />
      <Text style={styles.text}>
        Working Offline {queuedCount > 0 ? `(${queuedCount} queued)` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    gap: 6,
    zIndex: 999,
  },
  offline: {
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
  },
  reconnected: {
    backgroundColor: '#065F46',
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSizes.xs,
    fontFamily: FontFamily.semibold,
  },
});

export default NetworkStatusPill;
