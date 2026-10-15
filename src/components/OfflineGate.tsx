import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, ArrowLeft, Lock } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { useNetworkStatus } from '../context/NetworkContext';
import { FontSizes, FontFamily, Spacing, BorderRadius, scaledFontSize } from '../config/theme';
import { RETRY_LABEL } from '../services/errorMessages';
import {
  readCachedActiveErrand,
  describeStaleness,
  type CachedActiveErrand,
} from '../services/lastActiveErrand';
import { extractMerchantCategories } from '../utils/merchantCategories';
import { formatItemLabel } from '../utils/format';
import StatusBadge from './StatusBadge';

/**
 * The hard stop when the device has no internet.
 *
 * Rendered as a native Modal rather than an absolutely-positioned View on
 * purpose: RN Modals live in their own native window, so a plain View sibling
 * of the navigator would slide underneath any confirm dialog or bottom sheet
 * that happened to be open when the signal dropped, and the app would stay
 * usable through that hole. onRequestClose is a deliberate no-op so the Android
 * back button cannot dismiss it either.
 *
 * The one thing it does not block is looking. A customer whose rider is already
 * on the way is exactly who a blank wall punishes most, so the last errand the
 * app managed to load stays readable, stamped with its age, with every action
 * inert. Looking is not functioning.
 */
export const OfflineGate: React.FC = () => {
  const { isConnected, retry } = useNetworkStatus();
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();

  const [checking, setChecking] = useState(false);
  const [cached, setCached] = useState<CachedActiveErrand | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);

  // Read the snapshot when the block appears rather than on every render, so
  // the "last updated" stamp is measured from the moment of looking.
  useEffect(() => {
    if (isConnected) {
      setShowSnapshot(false);
      return;
    }
    let active = true;
    void readCachedActiveErrand().then((value) => {
      if (active) setCached(value);
    });
    return () => {
      active = false;
    };
  }, [isConnected]);

  const handleRetry = useCallback(async () => {
    setChecking(true);
    try {
      await retry();
    } finally {
      setChecking(false);
    }
  }, [retry]);

  if (isConnected) return null;

  const haloBg = isDark ? 'rgba(252,165,165,0.12)' : colors.dangerBg;

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      transparent={false}
      onRequestClose={() => {
        // Intentionally empty. There is nowhere to go back to.
      }}
    >
      <View
        style={[
          styles.root,
          { backgroundColor: colors.bgApp, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
        testID="offline-gate"
      >
        {showSnapshot && cached ? (
          <ErrandSnapshot cached={cached} onBack={() => setShowSnapshot(false)} />
        ) : (
          <View style={styles.center}>
            <View style={[styles.halo, { backgroundColor: haloBg }]}>
              <WifiOff size={34} color={colors.danger} strokeWidth={2} />
            </View>

            <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
              No internet connection
            </Text>
            <Text style={[styles.body, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
              Check your Wi-Fi or mobile data. Sugo will pick up where you left off.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleRetry}
              disabled={checking}
              style={[
                styles.primaryBtn,
                { backgroundColor: colors.primary, opacity: checking ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={RETRY_LABEL}
              testID="offline-retry"
            >
              {checking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.15}>
                  {RETRY_LABEL}
                </Text>
              )}
            </TouchableOpacity>

            {cached ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowSnapshot(true)}
                  style={styles.ghostBtn}
                  accessibilityRole="button"
                  accessibilityLabel="View my errand, saved on this phone"
                  testID="offline-view-errand"
                >
                  <Text
                    style={[styles.ghostBtnText, { color: colors.primary }]}
                    maxFontSizeMultiplier={1.15}
                  >
                    View my errand
                  </Text>
                  <Text
                    style={[styles.ghostBtnHint, { color: colors.textGray }]}
                    maxFontSizeMultiplier={1.15}
                  >
                    {describeStaleness(cached.cachedAt)}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
};

/**
 * Read-only, and says so. Every control is inert, and the reason sits beside
 * them rather than only on a greyed-out button nobody can interrogate.
 */
const ErrandSnapshot: React.FC<{ cached: CachedActiveErrand; onBack: () => void }> = ({
  cached,
  onBack,
}) => {
  const { colors } = useThemeColor();
  const { errand } = cached;
  const category = errand.category || extractMerchantCategories(errand);

  return (
    <View style={styles.snapshotRoot}>
      <View style={styles.snapshotNav}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={20} color={colors.textDark} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text
          style={[styles.snapshotNavTitle, { color: colors.textDark }]}
          maxFontSizeMultiplier={1.15}
        >
          My errand
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.snapshotBody} showsVerticalScrollIndicator={false}>
        <View style={[styles.staleRow, { backgroundColor: colors.warningBg }]}>
          <Lock size={13} color={colors.warning} strokeWidth={2.2} />
          <Text style={[styles.staleText, { color: colors.warning }]} maxFontSizeMultiplier={1.15}>
            {describeStaleness(cached.cachedAt)}. You are offline, so nothing here can change yet.
          </Text>
        </View>

        <View
          style={[styles.snapshotCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.snapshotCardHead}>
            <Text
              style={[styles.snapshotRef, { color: colors.textGray }]}
              maxFontSizeMultiplier={1.15}
              numberOfLines={1}
            >
              {errand.id}
            </Text>
            <StatusBadge status={errand.status} />
          </View>

          {category ? (
            <Text
              style={[styles.snapshotTitle, { color: colors.textDark }]}
              maxFontSizeMultiplier={1.2}
            >
              {category}
            </Text>
          ) : null}

          {errand.description ? (
            <Text
              style={[styles.snapshotBodyText, { color: colors.textMedium }]}
              maxFontSizeMultiplier={1.2}
            >
              {errand.description}
            </Text>
          ) : null}

          {errand.pickupAddress ? (
            <Text
              style={[styles.snapshotMeta, { color: colors.textGray }]}
              maxFontSizeMultiplier={1.2}
            >
              {errand.pickupAddress}
            </Text>
          ) : null}
        </View>

        {errand.pabiliDetails && errand.pabiliDetails.length > 0 ? (
          <View
            style={[
              styles.snapshotCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.sectionLabel, { color: colors.textGray }]}
              maxFontSizeMultiplier={1.15}
            >
              What to buy
            </Text>
            {errand.pabiliDetails.map((item, index) => (
              <Text
                key={`${item.itemName ?? 'item'}-${index}`}
                style={[styles.snapshotBodyText, { color: colors.textMedium }]}
                maxFontSizeMultiplier={1.2}
              >
                {formatItemLabel(item.itemName, item.size)}
              </Text>
            ))}
          </View>
        ) : null}

        <Text
          style={[styles.snapshotFootnote, { color: colors.textGray }]}
          maxFontSizeMultiplier={1.2}
        >
          Messaging, tracking and changes come back the moment you reconnect.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  halo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: scaledFontSize(FontSizes.xxl, 0.2),
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: scaledFontSize(FontSizes.md, 0.2),
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: Spacing.xl,
  },
  primaryBtn: {
    minWidth: 200,
    minHeight: 48,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: scaledFontSize(FontSizes.md, 0.2),
    fontFamily: FontFamily.semibold,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    maxWidth: 260,
  },
  ghostBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontSize: scaledFontSize(FontSizes.md, 0.2),
    fontFamily: FontFamily.semibold,
  },
  ghostBtnHint: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },

  snapshotRoot: { flex: 1 },
  snapshotNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  snapshotNavTitle: {
    fontSize: scaledFontSize(FontSizes.lg, 0.2),
    fontFamily: FontFamily.semibold,
  },
  snapshotBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  staleText: {
    flex: 1,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.medium,
    lineHeight: 18,
  },
  snapshotCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  snapshotCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  snapshotRef: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.mono,
    flexShrink: 1,
  },
  snapshotTitle: {
    fontSize: scaledFontSize(FontSizes.lg, 0.2),
    fontFamily: FontFamily.semibold,
  },
  snapshotBodyText: {
    fontSize: scaledFontSize(FontSizes.md, 0.2),
    fontFamily: FontFamily.regular,
    lineHeight: 21,
  },
  snapshotMeta: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  snapshotFootnote: {
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
});

export default OfflineGate;
