import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Sparkles,
  Wrench,
  FileText,
  Download,
  CheckCircle2,
  ArrowUpCircle,
  RefreshCw,
  Cpu,
  HardDrive,
  Calendar,
  Check,
} from 'lucide-react-native';
import TrueNativeModal from './transitions/TrueNativeModal';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  BorderRadius,
  FontSizes,
  Spacing,
  FontFamily,
  Shadows,
  useResponsive,
  MAX_CONTENT_WIDTH,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import {
  AppUpdateCheckResult,
  openDirectApkDownload,
} from '../services/appUpdateService';

export interface AppUpdatesModalProps {
  visible: boolean;
  updateStatus: AppUpdateCheckResult | null;
  checking?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  testID?: string;
}

export default function AppUpdatesModal({
  visible,
  updateStatus,
  checking = false,
  onRefresh,
  onClose,
  testID = 'app-updates-modal',
}: AppUpdatesModalProps) {
  const { colors, isDark } = useThemeColor();
  const { width: windowWidth } = useResponsive();
  const [downloading, setDownloading] = useState(false);

  const release = updateStatus?.release;
  const installedVersion = updateStatus?.installedVersion || '1.0.0';
  const latestVersion = updateStatus?.latestVersion || installedVersion;
  const isUpdateAvailable = Boolean(updateStatus?.isUpdateAvailable);
  const isSameVersion = installedVersion === latestVersion || !isUpdateAvailable;

  const features = release?.features || release?.whatsNew || [];
  const fixes = release?.fixes || [];
  const logs = release?.logs || [];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await openDirectApkDownload(release?.downloadUrl);
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  const cardWidth = Math.min(windowWidth - Spacing.md * 2, MAX_CONTENT_WIDTH);

  return (
    <TrueNativeModal
      visible={visible}
      onClose={onClose}
      testID={testID}
      contentStyle={[
        styles.modalCard,
        {
          backgroundColor: isDark ? '#0B132B' : colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          width: cardWidth,
        },
        Shadows.soft,
      ]}
    >
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
        <View style={styles.headerTitleContainer}>
          <Text
            style={[styles.modalTitle, { color: colors.textDark }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
          >
            Application Updates
          </Text>
          <Text
            style={[styles.modalSubtitle, { color: colors.textGray }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          >
            Sugo Express Distribution & Release Ledger
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.bgGray }]}
          onPress={onClose}
          hitSlop={PortalTouchTargets.compactHitSlop}
          accessibilityRole="button"
          accessibilityLabel="Close Updates"
        >
          <X size={18} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Version Hero Banner */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
            },
          ]}
        >
          {/* Status Headline & Pill Header */}
          <View style={styles.heroHeaderRow}>
            <Text
              style={[
                styles.heroStatusHeadline,
                {
                  color: isSameVersion
                    ? (isDark ? '#34D399' : '#059669')
                    : (isDark ? '#F87171' : '#DC2626'),
                },
              ]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
            >
              {isSameVersion ? 'You are on the latest version' : 'App needs an update'}
            </Text>

            <View style={styles.statusPillContainer}>
              {isSameVersion ? (
                <View style={[styles.statusPill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <CheckCircle2 size={13} color="#059669" />
                  <Text style={[styles.statusPillText, { color: '#065F46' }]}>Up to Date</Text>
                </View>
              ) : (
                <View style={[styles.statusPill, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                  <ArrowUpCircle size={13} color="#DC2626" />
                  <Text style={[styles.statusPillText, { color: '#991B1B' }]}>Update Ready</Text>
                </View>
              )}
            </View>
          </View>

          {/* Version Indicators */}
          {isSameVersion ? (
            <View style={styles.singleVersionRow}>
              <Text style={[styles.heroLabel, { color: colors.textGray }]}>Current Version</Text>
              <Text style={[styles.heroVersionSingle, { color: colors.textDark }]}>v{installedVersion}</Text>
            </View>
          ) : (
            <View style={styles.heroRow}>
              <View>
                <Text style={[styles.heroLabel, { color: colors.textGray }]}>Current Installed</Text>
                <Text style={[styles.heroVersion, { color: colors.textDark }]}>v{installedVersion}</Text>
              </View>

              <View style={styles.arrowSeparator}>
                <Text style={{ color: colors.textLight, fontSize: 16 }}>➔</Text>
              </View>

              <View>
                <Text style={[styles.heroLabel, { color: colors.textGray }]}>Latest Available</Text>
                <Text style={[styles.heroVersion, { color: colors.primary }]}>v{latestVersion}</Text>
              </View>
            </View>
          )}

          {/* Technical Spec Chips */}
          {release && (
            <View style={styles.specsRow}>
              <View style={styles.specItem}>
                <HardDrive size={12} color={colors.textLight} />
                <Text style={[styles.specText, { color: colors.textGray }]}>{release.fileSize || '125 MB'}</Text>
              </View>
              <View style={styles.specDivider} />
              <View style={styles.specItem}>
                <Cpu size={12} color={colors.textLight} />
                <Text style={[styles.specText, { color: colors.textGray }]}>{release.minAndroid || 'Android 8.0+'}</Text>
              </View>
              {release.updatedAt && (
                <>
                  <View style={styles.specDivider} />
                  <View style={styles.specItem}>
                    <Calendar size={12} color={colors.textLight} />
                    <Text style={[styles.specText, { color: colors.textGray }]}>
                      {new Date(release.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* 1. Features Added Section */}
        {features.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Sparkles size={15} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Features Added</Text>
              <Text style={[styles.sectionCount, { color: colors.textLight }]}>({features.length})</Text>
            </View>
            <View style={styles.itemsList}>
              {features.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={[styles.checkDot, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
                    <Check size={11} color="#059669" />
                  </View>
                  <Text style={[styles.itemText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 2. Bug Fixes Section */}
        {fixes.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Wrench size={15} color="#3B82F6" />
              <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Fixes & Stability</Text>
              <Text style={[styles.sectionCount, { color: colors.textLight }]}>({fixes.length})</Text>
            </View>
            <View style={styles.itemsList}>
              {fixes.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={[styles.itemText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 3. Detailed Logs Section */}
        {logs.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <FileText size={15} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Release Logs & Engine</Text>
              <Text style={[styles.sectionCount, { color: colors.textLight }]}>({logs.length})</Text>
            </View>
            <View style={styles.itemsList}>
              {logs.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={[styles.bulletDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.itemText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Footer (Thumb Zone) */}
      <View style={[styles.footerBar, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
        {/* Primary CTA */}
        {isSameVersion ? (
          <View
            style={[
              styles.upToDateBanner,
              {
                backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : '#ECFDF5',
                borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#A7F3D0',
              },
            ]}
          >
            <CheckCircle2 size={18} color="#059669" />
            <Text style={[styles.upToDateBannerText, { color: isDark ? '#34D399' : '#065F46' }]}>
              You are on the latest version
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryCta,
              { backgroundColor: colors.primary },
              downloading && { opacity: 0.75 },
            ]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Update New Version"
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Download size={18} color="#FFFFFF" />
            )}
            <Text style={styles.primaryCtaText}>
              {downloading ? 'Opening Download Manager...' : 'Update New Version'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Secondary Action: Check Again */}
        {onRefresh && (
          <TouchableOpacity
            style={[
              styles.refreshBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
              },
            ]}
            onPress={onRefresh}
            disabled={checking}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Check for Updates"
          >
            <RefreshCw size={14} color={colors.textGray} style={checking ? styles.spin : undefined} />
            <Text style={[styles.secondaryBtnText, { color: colors.textGray }]}>
              {checking ? 'Checking...' : 'Check Again'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TrueNativeModal>
  );
}

const styles = StyleSheet.create({
  modalCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '84%',
    alignSelf: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  modalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.sm + 4,
    gap: Spacing.sm,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  heroStatusHeadline: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm + 1,
    flex: 1,
  },
  singleVersionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  heroVersionSingle: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  heroLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroVersion: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginTop: 1,
  },
  arrowSeparator: {
    paddingHorizontal: 2,
  },
  statusPillContainer: {
    alignSelf: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },
  specDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#94A3B8',
  },
  sectionBlock: {
    gap: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
  sectionCount: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
  },
  itemsList: {
    gap: 6,
    paddingLeft: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    marginLeft: 5,
    marginRight: 6,
  },
  itemText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.xs + 1,
    lineHeight: 18,
  },
  footerBar: {
    padding: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.xs + 2,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 48,
    borderRadius: BorderRadius.lg,
  },
  primaryCtaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
    color: '#FFFFFF',
  },
  upToDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  upToDateBannerText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSizes.sm,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
  },
  spin: {
    transform: [{ rotate: '45deg' }],
  },
});
