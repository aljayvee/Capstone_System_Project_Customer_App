import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Moon,
  Sun,
  Monitor,
  ShieldCheck,
  Bell,
  MessageSquare,
  Trash2,
  Check,
  Smartphone,
  MapPin,
} from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows } from '../config/theme';
import SettingsRow from '../components/SettingsRow';
import SettingsSection from '../components/SettingsSection';

export default function SettingsScreen({ route, navigation }: RootStackScreenProps<'Settings'>) {
  const { user } = route.params;
  const { themeMode, setThemeMode, colors, isDark } = useThemeColor();

  // Notification Toggles State
  const [errandAlerts, setErrandAlerts] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);

  const handleClearCache = () => {
    setClearingCache(true);
    setTimeout(() => {
      setClearingCache(false);
      Alert.alert(
        'Cache Cleared',
        '2.4 MB of temporary merchant image files and preview cache cleared successfully.'
      );
    }, 400);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      {/* 1. TOP NAV HEADER */}
      <View style={[styles.navHeaderRow, { borderBottomColor: colors.border, backgroundColor: colors.bgApp }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]}>App Settings</Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. THEME & APPEARANCE (3-CARD VISUAL SELECTOR) */}
        <SettingsSection title="Appearance & Display">
          <View style={styles.themeCardsGrid}>
            {/* LIGHT THEME CARD */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: themeMode === 'light' ? colors.primary : colors.border,
                  borderWidth: themeMode === 'light' ? 2 : 1,
                },
                themeMode === 'light' && Shadows.soft,
              ]}
              onPress={() => setThemeMode('light')}
              testID="theme-card-light"
            >
              <View style={[styles.themeIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
                <Sun size={20} color={themeMode === 'light' ? colors.primary : colors.textMedium} />
              </View>
              <Text style={[styles.themeCardTitle, { color: colors.textDark }]}>Light</Text>
              <Text style={[styles.themeCardSub, { color: colors.textLight }]}>Crisp & bright</Text>
              {themeMode === 'light' && (
                <View style={[styles.activeThemeBadge, { backgroundColor: colors.primary }]}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {/* DARK THEME CARD */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: themeMode === 'dark' ? colors.primary : colors.border,
                  borderWidth: themeMode === 'dark' ? 2 : 1,
                },
                themeMode === 'dark' && Shadows.soft,
              ]}
              onPress={() => setThemeMode('dark')}
              testID="theme-card-dark"
            >
              <View style={[styles.themeIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
                <Moon size={20} color={themeMode === 'dark' ? colors.primary : colors.textMedium} />
              </View>
              <Text style={[styles.themeCardTitle, { color: colors.textDark }]}>Dark</Text>
              <Text style={[styles.themeCardSub, { color: colors.textLight }]}>Easy on eyes</Text>
              {themeMode === 'dark' && (
                <View style={[styles.activeThemeBadge, { backgroundColor: colors.primary }]}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {/* SYSTEM AUTO CARD */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.themeCard,
                {
                  backgroundColor: colors.card,
                  borderColor: themeMode === 'system' ? colors.primary : colors.border,
                  borderWidth: themeMode === 'system' ? 2 : 1,
                },
                themeMode === 'system' && Shadows.soft,
              ]}
              onPress={() => setThemeMode('system')}
              testID="theme-card-system"
            >
              <View style={[styles.themeIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
                <Monitor size={20} color={themeMode === 'system' ? colors.primary : colors.textMedium} />
              </View>
              <Text style={[styles.themeCardTitle, { color: colors.textDark }]}>System</Text>
              <Text style={[styles.themeCardSub, { color: colors.textLight }]}>Device auto</Text>
              {themeMode === 'system' && (
                <View style={[styles.activeThemeBadge, { backgroundColor: colors.primary }]}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* 3. NOTIFICATIONS & ALERTS (VALUE-FRAMED GRANULAR CONTROLS) */}
        <SettingsSection title="Notifications & Alerts">
          <SettingsRow
            icon={Bell}
            label="Live Delivery Updates"
            subtitle="Rider assigned, store pickup & arrival alerts"
            trailing={
              <Switch
                value={errandAlerts}
                onValueChange={setErrandAlerts}
                trackColor={{ false: '#D1D5DB', true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingsRow
            icon={MessageSquare}
            label="Dispatcher & Rider Messages"
            subtitle="Chime for order coordination & receipt updates"
            trailing={
              <Switch
                value={chatAlerts}
                onValueChange={setChatAlerts}
                trackColor={{ false: '#D1D5DB', true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </SettingsSection>

        {/* 4. STORAGE & PERFORMANCE OPTIMIZATION */}
        <SettingsSection title="Data & Storage">
          <SettingsRow
            icon={Trash2}
            label="Clear Temporary Cache"
            subtitle="Frees up space from cached store photos (~2.4 MB)"
            onPress={handleClearCache}
            accessibilityLabel="Clear temporary cache"
          />
        </SettingsSection>

        {/* 5. SECURITY & DEVICE PROTECTION */}
        <SettingsSection title="Security & Protection">
          <SettingsRow
            icon={ShieldCheck}
            label="Protected Connection"
            subtitle="Device security & brute-force defense active"
            trailing={<ShieldCheck size={18} color="#10B981" />}
          />
        </SettingsSection>

        {/* 6. SYSTEM & LEGAL INFORMATION */}
        <SettingsSection title="About & Operations">
          <SettingsRow
            icon={Smartphone}
            label="Application Version"
            subtitle="Sugo Customer App v1.0.0 (Build 57)"
          />
          <SettingsRow
            icon={MapPin}
            label="Operations Hub"
            subtitle="Tacurong City, Sultan Kudarat"
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
  },
  navHeaderRightPlaceholder: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl * 2,
  },
  themeCardsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  themeCard: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  themeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  themeCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.xs + 1,
    marginBottom: 2,
  },
  themeCardSub: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
  },
  activeThemeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
