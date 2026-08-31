import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../services/apiClient';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily } from '../config/theme';
import { RootStackParamList } from '../navigation/types';

interface CustomerNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 25000;

export interface NotificationBellProps {
  user?: any;
  navigation?: any;
  onPress?: () => void;
}

export function NotificationBell({ user, navigation: customNav, onPress }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { colors, isDark } = useThemeColor();
  const defaultNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const nav = customNav || defaultNav;

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get<CustomerNotification[]>('/notifications');
      const list = res.data ?? [];
      const unread = list.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      // Silently catch background poll failures
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (nav) {
      nav.navigate('Notification', { user });
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.iconButton}
      onPress={handlePress}
      testID="customer-notification-bell"
      accessibilityLabel="Notifications"
    >
      {/* Clean Grey Notification Icon */}
      <Bell size={21} color={colors.textGray} strokeWidth={2} />
      {unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 2,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontFamily: FontFamily.bold,
  },
});
