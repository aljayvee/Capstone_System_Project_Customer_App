import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotifications } from '../context/NotificationContext';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily } from '../config/theme';
import { RootStackParamList } from '../navigation/types';

export interface NotificationBellProps {
  user?: any;
  navigation?: any;
  onPress?: () => void;
}

export function NotificationBell({ user, navigation: customNav, onPress }: NotificationBellProps) {
  const { unreadCount } = useNotifications();
  const { colors } = useThemeColor();
  const defaultNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const nav = customNav || defaultNav;

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
        <View style={[styles.badge, { backgroundColor: colors.primary }]} testID="notification-bell-badge">
          <Text style={styles.badgeText} testID="notification-bell-count">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
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
