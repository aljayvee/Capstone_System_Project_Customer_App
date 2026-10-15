import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Clock } from 'lucide-react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePabiliDraft } from '../../hooks/usePabiliDraft';
import {
  droppedStoresWithItems,
  emptyDraft,
  pabiliDraftStore,
  readStoredDraft,
  storeCategoryOf,
  totalUnits,
  withCategories,
  withStores,
  type PabiliDraft,
  type PickedStore,
} from '../../services/pabiliDraft';
import { getCategoryIcon } from '../../constants/pabili';
import StepPills from '../../components/pabili/StepPills';
import ShimmerWave from '../../components/ShimmerWave';
import ConfirmModal from '../../components/ConfirmModal';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  Shadows,
  MAX_CONTENT_WIDTH,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../../config/theme';

/** A list whose Send started this recently may already be an errand. */
const RECENT_SEND_MS = 2 * 60 * 1000;

/**
 * Stores one errand may visit: ErrandFormScreen's limit, and the server
 * refuses a storeCount above it (errandValidators.ts).
 */
const MAX_STORES = 3;

/** "Pharmacy", "Pharmacy and Bakery", "Pharmacy, Bakery and Retail". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Step 2 of a pabili errand: one card per store, each opening its own list.
 *
 * This used to be one screen holding every store's chips, rows and compose box
 * plus the delivery card and Send, which clamped on a Samsung A04. Each store
 * now gets a whole screen (PabiliStoreEditorScreen) and the delivery address,
 * the tidy-up and Send live on Review (PabiliReviewScreen).
 *
 * The list is kept on the phone (services/pabiliDraft.ts), so leaving loses
 * nothing and needs no "discard?" prompt; Clear list is the explicit way out.
 */
export default function PabiliHubScreen({ route, navigation }: RootStackScreenProps<'ErrandItems'>) {
  const { user } = route.params || ({} as any);
  const userId = String(user?.id ?? '');
  const routeCats = useMemo(() => {
    const raw = route.params?.selectedCats;
    const cats = Array.isArray(raw) ? raw.map((c) => String(c || '').trim()).filter(Boolean) : [];
    return cats.length > 0 ? cats : ['Pabili'];
  }, [route.params?.selectedCats]);
  // Real stores picked in step 1's "Location" list. Absent for merchant categories.
  const routeStores = route.params?.stores;

  /**
   * The saved list re-pointed at these stores: picked stores keep their pin
   * details (from step 1, or from the saved list for one being kept), merchant
   * categories are plain names.
   */
  const repoint = useCallback(
    (base: PabiliDraft, keys: string[]): PabiliDraft => {
      if (!routeStores) return withCategories(base, keys);
      const picked = keys
        .map((key) => routeStores.find((s) => s.key === key) ?? base.stores?.[key])
        .filter((s): s is PickedStore => Boolean(s));
      return withStores(base, picked);
    },
    [routeStores]
  );

  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const draft = usePabiliDraft();
  const [ready, setReady] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ draft: PabiliDraft; dropped: string[] } | null>(null);
  const [showClear, setShowClear] = useState(false);
  const [missingStore, setMissingStore] = useState<string | null>(null);

  // Android Three-Key Navigation: Back button dismisses active confirmation modals or returns safely
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (showClear) {
        setShowClear(false);
        return true;
      }
      if (pendingDrop) {
        setPendingDrop(null);
        return true;
      }
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showClear, pendingDrop, navigation]);

  // Picks up where the customer left off, re-pointed at the stores just
  // chosen: every store still chosen keeps its items and a new one starts
  // empty. Going back to step 1 to add a store used to mean choosing between a
  // list without the new store and no list at all.
  //
  // The one question left is about a store the customer unselected that still
  // has items, because only that loses anything. Nothing is started until
  // they answer, so the saved list on the phone is untouched meanwhile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = pabiliDraftStore.getSnapshot();
      const saved = current && pabiliDraftStore.ownerId === userId ? current : userId ? await readStoredDraft(userId) : null;
      if (cancelled) return;
      if (!saved) {
        pabiliDraftStore.begin(userId, repoint(emptyDraft(routeCats), routeCats));
      } else {
        const dropped = droppedStoresWithItems(saved, routeCats);
        if (dropped.length === 0) pabiliDraftStore.begin(userId, repoint(saved, routeCats));
        else setPendingDrop({ draft: saved, dropped });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, routeCats, repoint]);

  const droppedUnits = pendingDrop
    ? pendingDrop.dropped.reduce(
        (sum, cat) => sum + (pendingDrop.draft.rowsByCategory[cat] ?? []).reduce((n, r) => n + r.quantity, 0),
        0
      )
    : 0;
  // A dropped store is kept only alongside its own kind: a merchant category
  // next to picked stores would reach the dispatcher as neither.
  const canKeepDropped = pendingDrop
    ? routeCats.length + pendingDrop.dropped.length <= MAX_STORES &&
      pendingDrop.dropped.every((key) => Boolean(pendingDrop.draft.stores?.[key]) === Boolean(routeStores))
    : false;
  const droppedNames = pendingDrop ? joinNames(pendingDrop.dropped) : '';

  const categories = draft?.categories ?? routeCats;
  const units = draft ? totalUnits(draft) : 0;
  const recentlySent = Boolean(draft?.submitStartedAt && Date.now() - draft.submitStartedAt < RECENT_SEND_MS);

  const countFor = useCallback(
    (cat: string) => (draft?.rowsByCategory[cat] ?? []).reduce((sum, r) => sum + r.quantity, 0),
    [draft]
  );

  const openStore = (category: string) => {
    setMissingStore(null);
    navigation.navigate('PabiliStoreEditor', { user, category });
  };

  /**
   * A disabled Review button would be a dead end with no explanation. Instead
   * the tap names the store that is still empty, on the card where the fix is.
   */
  const goToReview = () => {
    const empty = categories.find((cat) => countFor(cat) === 0);
    if (empty) {
      setMissingStore(empty);
      return;
    }
    navigation.navigate('PabiliReview', { user });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="back-button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          Shopping list
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <StepPills step={2} storeCount={categories.length} />

        {recentlySent ? (
          <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]} testID="recent-send-notice">
            <Clock size={15} color={colors.textGray} />
            <Text style={[styles.noticeText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              This list may already have been sent. Check My Errands before sending it again.
            </Text>
          </View>
        ) : null}

        {!ready ? (
          <View testID="hub-loading">
            {routeCats.map((cat) => (
              <View
                key={cat}
                style={[
                  styles.storeRow,
                  { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                ]}
              >
                <ShimmerWave height={36} width={36} style={{ borderRadius: 18 }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <ShimmerWave height={14} width="60%" />
                  <ShimmerWave height={12} width="30%" />
                </View>
              </View>
            ))}
          </View>
        ) : (
          categories.map((cat) => {
            const kind = storeCategoryOf(draft, cat);
            const Icon = getCategoryIcon(kind);
            const count = countFor(cat);
            const flagged = missingStore === cat;
            // A picked store says what kind of shop it is under its name.
            const picked = draft?.stores?.[cat];
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.7}
                onPress={() => openStore(cat)}
                style={[
                  styles.storeRow,
                  {
                    borderBottomColor: flagged
                      ? colors.danger
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9',
                  },
                ]}
                testID={`store-card-${cat}`}
                accessibilityRole="button"
                accessibilityLabel={`${cat}, ${count === 0 ? 'no items yet' : `${count} ${count === 1 ? 'item' : 'items'}`}`}
              >
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFF0F5' }]}>
                  <Icon size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.storeName, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                    {cat}
                  </Text>
                  {picked ? (
                    <Text
                      style={[styles.storeKind, { color: colors.textGray }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                      testID={`store-kind-${cat}`}
                    >
                      {picked.categoryName ?? 'Store type to be confirmed'}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.storeCount, { color: flagged ? colors.danger : count === 0 ? colors.primary : colors.textGray }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                  >
                    {flagged
                      ? 'Add at least one item here'
                      : count === 0
                      ? 'Add items'
                      : `${count} ${count === 1 ? 'item' : 'items'}`}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textLight} />
              </TouchableOpacity>
            );
          })
        )}

        {missingStore ? (
          <View
            style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2', borderColor: colors.danger }]}
            testID="missing-store-banner"
          >
            <AlertCircle size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              {`Add at least one item for ${missingStore}, or go back and remove that store.`}
            </Text>
          </View>
        ) : null}

        {units > 0 ? (
          <TouchableOpacity onPress={() => setShowClear(true)} style={styles.clearBtn} hitSlop={PortalTouchTargets.compactHitSlop} testID="clear-list">
            <Text style={[styles.clearText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              Clear list
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, Spacing.md),
          },
          Shadows.liftedUp,
        ]}
      >
        <Text style={[styles.summary, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
          {units === 0
            ? 'Your list is empty'
            : `${units} ${units === 1 ? 'item' : 'items'} · ${categories.length} ${categories.length === 1 ? 'store' : 'stores'}`}
        </Text>
        <TouchableOpacity
          testID="review-list-button"
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: units === 0 ? (isDark ? 'rgba(246,36,89,0.35)' : '#F7A8BE') : colors.primary }]}
          onPress={units === 0 ? () => openStore(categories[0]) : goToReview}
          disabled={!ready}
        >
          {/* One line, shortened with "..." (2026-10-14): a long store name,
              "7-Eleven Tacurong New Isabela (3453)", ran past both edges. */}
          <Text
            style={styles.primaryText}
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            testID="review-list-button-label"
          >
            {units === 0 ? `Start with ${categories[0]}` : 'Review my list'}
          </Text>
          <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} style={styles.primaryIcon} />
        </TouchableOpacity>
      </View>

      <ConfirmModal
        visible={Boolean(pendingDrop)}
        title={`Remove your ${droppedNames} items?`}
        message={
          `You didn't pick ${droppedNames} this time, but ${droppedUnits} ${droppedUnits === 1 ? 'item is' : 'items are'} still on your list for it.` +
          (canKeepDropped ? '' : ` An errand can visit up to ${MAX_STORES} stores, so to keep them, change your stores.`)
        }
        confirmLabel="Remove them"
        cancelLabel={canKeepDropped ? `Keep ${pendingDrop?.dropped.length === 1 ? droppedNames : 'them'}` : 'Change my stores'}
        destructive
        onConfirm={() => {
          if (pendingDrop) pabiliDraftStore.begin(userId, repoint(pendingDrop.draft, routeCats));
          setPendingDrop(null);
        }}
        onCancel={() => {
          const pending = pendingDrop;
          setPendingDrop(null);
          if (!pending) return;
          if (canKeepDropped) {
            pabiliDraftStore.begin(userId, repoint(pending.draft, [...routeCats, ...pending.dropped]));
          } else {
            // Nothing was started, so the saved list is exactly as it was.
            navigation.goBack();
          }
        }}
        testID="drop-stores-modal"
      />

      <ConfirmModal
        visible={showClear}
        title="Clear your list?"
        message="Every item in every store is removed. This can't be undone."
        confirmLabel="Clear list"
        cancelLabel="Keep my list"
        destructive
        onConfirm={() => {
          setShowClear(false);
          setMissingStore(null);
          void pabiliDraftStore.clear().then(() => pabiliDraftStore.begin(userId, emptyDraft(categories)));
        }}
        onCancel={() => setShowClear(false)}
        testID="clear-modal"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(17), lineHeight: getPortalLineHeight(17, 'heading') },
  scroll: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xl * 2 },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
    marginBottom: Spacing.md,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  noticeText: { flex: 1, fontFamily: FontFamily.medium, fontSize: scaledPortalFontSize(PortalFontSizes.caption) },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    minHeight: 64,
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  storeName: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading) },
  storeCount: { fontFamily: FontFamily.medium, fontSize: scaledPortalFontSize(PortalFontSizes.caption), marginTop: 2 },
  storeKind: { fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.micro), marginTop: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  errorText: { flex: 1, fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.caption) },
  clearBtn: { alignSelf: 'center', marginTop: Spacing.md, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  clearText: { fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.caption), textDecorationLine: 'underline' },
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  summary: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: moderateScale(50, 0.2),
    paddingHorizontal: Spacing.md + 2,
    borderRadius: BorderRadius.md,
  },
  // Shrinks to the button, never past it; the arrow keeps its size.
  primaryText: {
    flexShrink: 1,
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    color: '#FFFFFF',
  },
  primaryIcon: { flexShrink: 0 },
});
