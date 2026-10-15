import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wrench, AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius } from '../config/theme';
import type { MaintenanceNoticeState } from '../hooks/useMaintenanceNotice';

interface MaintenanceNoticeBannerProps {
  notice: MaintenanceNoticeState;
}

export const MaintenanceNoticeBanner: React.FC<MaintenanceNoticeBannerProps> = ({ notice }) => {
  const { colors, isDark } = useThemeColor();

  if (!notice.isActive) {
    return null;
  }

  // Theme-scoped styling per maintenance type
  const isEmergency = notice.maintenanceType === 'EMERGENCY' || notice.maintenanceType === 'SECURITY';
  const accentColor = isEmergency ? (isDark ? '#F87171' : '#B91C1C') : (isDark ? '#FBBF24' : '#B45309');
  const bgColor = isEmergency
    ? (isDark ? 'rgba(185, 28, 28, 0.18)' : '#FEF2F2')
    : (isDark ? 'rgba(180, 83, 9, 0.18)' : '#FFFBEB');
  const borderColor = isEmergency
    ? (isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA')
    : (isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A');

  const IconComponent = isEmergency ? ShieldAlert : (notice.maintenanceType === 'UPGRADE' ? Wrench : AlertTriangle);

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`System Notice: ${notice.header}. ${notice.message}`}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
          <IconComponent size={18} color={accentColor} strokeWidth={2.2} />
        </View>

        <View style={styles.headerTextWrap}>
          <View style={styles.typeBadgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.typeBadgeText} maxFontSizeMultiplier={1.15}>
                {notice.maintenanceType || 'MAINTENANCE'}
              </Text>
            </View>
            <Text style={[styles.liveIndicator, { color: accentColor }]} maxFontSizeMultiplier={1.15}>
              • System Notice
            </Text>
          </View>
          <Text
            style={[styles.headerTitle, { color: isDark ? '#F9FAFB' : '#111827' }]}
            maxFontSizeMultiplier={1.2}
          >
            {notice.header}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.messageBody,
          { color: isDark ? '#D1D5DB' : '#374151' },
        ]}
        maxFontSizeMultiplier={1.15}
      >
        {notice.message}
      </Text>

      {notice.supportContact ? (
        <View style={styles.footerRow}>
          <Text
            style={[styles.supportContactText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}
            maxFontSizeMultiplier={1.15}
          >
            Help: {notice.supportContact}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    marginBottom: Spacing.sm + 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm + 2,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerTextWrap: {
    flex: 1,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  liveIndicator: {
    fontSize: 10,
    fontFamily: FontFamily.semibold,
  },
  headerTitle: {
    fontSize: FontSizes.sm + 1,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  messageBody: {
    fontSize: FontSizes.xs + 1,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  footerRow: {
    marginTop: Spacing.xs + 2,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  supportContactText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },
});

export default MaintenanceNoticeBanner;
