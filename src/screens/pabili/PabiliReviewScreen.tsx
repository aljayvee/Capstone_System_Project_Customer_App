import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ChevronLeft, MapPin, ShoppingBag } from 'lucide-react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePabiliDraft } from '../../hooks/usePabiliDraft';
import { useDefaultDeliveryLocation } from '../../hooks/useDefaultDeliveryLocation';
import {
  applyTidy,
  pabiliDraftStore,
  rowsAwaitingTidy,
  totalUnits,
  type DraftRow,
} from '../../services/pabiliDraft';
import { tidyItemLines } from '../../services/itemTidyService';
import { submitPabili } from '../../services/pabiliSubmit';
import { fetchQuote, type FeeQuote } from '../../services/quoteService';
import { showAppAlert } from '../../services/alertModal';
import { toUserMessage } from '../../services/errorMessages';
import { formatPeso } from '../../utils/format';
import StepPills from '../../components/pabili/StepPills';
import DeliveryLocationCard from '../../components/pabili/DeliveryLocationCard';
import ShimmerWave from '../../components/ShimmerWave';
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

/** Rows shown per store before "Show all", so a long list cannot bury Send. */
const ROWS_BEFORE_FOLD = 5;

/**
 * Step 3: the whole list, where it goes, and Send.
 *
 * Lines the typing rules left alone are read by the server's model the moment
 * this opens, in one request, and its readings simply replace them: the
 * customer sees a clean list, not a list of corrections. Send never waits for
 * it: pressed mid-read, the read is dropped and the list goes as typed, which
 * is exactly how every order went before this.
 */
export default function PabiliReviewScreen({ route, navigation }: RootStackScreenProps<'PabiliReview'>) {
  const { user } = route.params;
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const draft = usePabiliDraft();
  const { location, loading: locationLoading, failed: locationFailed, retry } = useDefaultDeliveryLocation(user?.id);

  const [tidyingIds, setTidyingIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const tidyAbortRef = useRef<AbortController | null>(null);

  // Android Three-Key Navigation: Back button safely returns to previous screen preserving draft
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  // ── the model reads the lines the rules would not ─────────────────────
  useEffect(() => {
    const current = pabiliDraftStore.getSnapshot();
    if (!current) return;
    const waiting = rowsAwaitingTidy(current);
    if (waiting.length === 0) return;

    const ids = waiting.map(({ row }) => row.id);
    const controller = new AbortController();
    tidyAbortRef.current = controller;
    setTidyingIds(ids);
    tidyItemLines(
      waiting.map(({ row }) => ({ id: row.id, text: row.name })),
      controller.signal
    ).then((answer) => {
      if (controller.signal.aborted) return;
      pabiliDraftStore.update((d) => applyTidy(d, ids, answer?.available ?? false, answer?.results ?? []));
      setTidyingIds([]);
    });
    return () => controller.abort();
    // Once per visit: rows added later are read on the next visit to Review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── the provisional fee, priced by the server ─────────────────────────
  const units = draft ? totalUnits(draft) : 0;
  const storeCount = draft?.categories.length ?? 0;
  useEffect(() => {
    if (units === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchQuote({ storeCount, itemUnits: units, isCod: true }).then((q) => {
        if (!cancelled) setQuote(q);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [units, storeCount]);


  const send = async () => {
    const current = pabiliDraftStore.getSnapshot();
    if (submittingRef.current || !current || !location) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    // A read still in flight is dropped; the rules' version goes.
    tidyAbortRef.current?.abort();
    setTidyingIds([]);

    pabiliDraftStore.update((d) => ({ ...d, submitStartedAt: Date.now() }));
    await pabiliDraftStore.flush();
    try {
      const errandId = await submitPabili(current, location, user.id);
      await pabiliDraftStore.clear();
      navigation.reset({
        index: 1,
        routes: [
          { name: 'CustomerPortal', params: { user } },
          { name: 'WaitingForDispatcher', params: { user, errandId } },
        ],
      });
    } catch (err: any) {
      pabiliDraftStore.update((d) => ({ ...d, submitStartedAt: null }));
      showAppAlert('Errand not sent', toUserMessage(err, 'errand'));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ── empty: nothing to review ──────────────────────────────────────────
  if (!draft || units === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.bgApp }]} testID="review-empty">
        <ShoppingBag size={32} color={colors.textLight} />
        <Text style={[styles.title, { color: colors.textDark, textAlign: 'center' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          Your list is empty
        </Text>
        <Text style={[styles.caption, { color: colors.textGray, textAlign: 'center' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
          Add what you need from each store, then come back here to send it.
        </Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, alignSelf: 'stretch' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>Add items</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tidyingSet = new Set(tidyingIds);
  const sendState = isSubmitting
    ? 'sending'
    : locationLoading
    ? 'locating'
    : locationFailed
    ? 'location-failed'
    : !location
    ? 'no-location'
    : 'ready';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="review-back"
          accessibilityLabel="Back to your stores"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          Review
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <StepPills step={3} storeCount={draft.categories.length} />

        <DeliveryLocationCard
          location={location}
          loading={locationLoading}
          failed={locationFailed}
          onChange={() => navigation.navigate('CustomerLocation', { user })}
          onRetry={retry}
        />

        {draft.categories.map((cat) => {
          const catRows = draft.rowsByCategory[cat] ?? [];
          const open = expanded[cat] || catRows.length <= ROWS_BEFORE_FOLD;
          const shown = open ? catRows : catRows.slice(0, ROWS_BEFORE_FOLD);
          return (
            <View key={cat} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.soft]} testID={`review-store-${cat}`}>
              <View style={styles.storeHeader}>
                <Text style={[styles.cardTitle, { color: colors.textDark, flex: 1 }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                  {cat}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('PabiliStoreEditor', { user, category: cat })}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  testID={`edit-store-${cat}`}
                >
                  <Text style={[styles.smallBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Edit</Text>
                </TouchableOpacity>
              </View>
              {/* A table, so the three facts a rider buys by are read the
                  same way on every line: how many, what, and in what unit. */}
              <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
                <Text style={[styles.headCell, styles.qtyCell, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                  Quantity
                </Text>
                <Text style={[styles.headCell, styles.itemCell, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                  Item
                </Text>
                <Text style={[styles.headCell, styles.sizeCell, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                  Unit
                </Text>
              </View>
              {shown.map((row: DraftRow) =>
                tidyingSet.has(row.id) ? (
                  <View key={row.id} style={styles.shimmerRow} testID={`tidying-${row.id}`}>
                    <ShimmerWave height={16} width="70%" />
                  </View>
                ) : (
                  <View key={row.id} style={[styles.tableRow, { borderBottomColor: colors.border }]} testID={`review-row-${row.id}`}>
                    <Text style={[styles.cell, styles.qtyCell, styles.qtyValue, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                      {row.quantity}
                    </Text>
                    <View style={styles.itemCell}>
                      <Text style={[styles.cell, { color: colors.textDark }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                        {row.name}
                      </Text>
                      {row.notes ? (
                        <Text style={[styles.noteText, { color: colors.textGray }]} numberOfLines={3} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                          {`Note: ${row.notes}`}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.cell, styles.sizeCell, { color: row.size ? colors.textDark : colors.textLight }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                      {row.size ?? 'Any'}
                    </Text>
                  </View>
                )
              )}
              {!open ? (
                <TouchableOpacity onPress={() => setExpanded((e) => ({ ...e, [cat]: true }))} style={styles.showAll} testID={`show-all-${cat}`}>
                  <Text style={[styles.smallBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                    {`Show all ${catRows.length}`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
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
        <View style={styles.summaryRow}>
          <Text style={[styles.summary, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
            {`${units} ${units === 1 ? 'item' : 'items'} · ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}`}
          </Text>
          {quote ? (
            <Text style={[styles.caption, { color: colors.textGray }]} testID="review-fee" maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              {`Starting Delivery ${formatPeso(quote.fees.subtotal)}`}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          testID="submit-errand-items-button"
          activeOpacity={0.85}
          style={[
            styles.primaryBtn,
            {
              backgroundColor:
                sendState === 'locating'
                  ? isDark
                    ? 'rgba(255,255,255,0.1)'
                    : '#E5E7EB'
                  : sendState === 'no-location'
                  ? '#D97706'
                  : colors.primary,
            },
          ]}
          onPress={
            sendState === 'no-location'
              ? () => navigation.navigate('CustomerLocation', { user })
              : sendState === 'location-failed'
              ? retry
              : send
          }
          disabled={sendState === 'sending' || sendState === 'locating'}
        >
          {sendState === 'sending' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : sendState === 'locating' ? (
            <Text style={[styles.primaryText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
              Finding your address
            </Text>
          ) : sendState === 'no-location' ? (
            <>
              <MapPin size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.primaryText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>Set delivery location</Text>
            </>
          ) : sendState === 'location-failed' ? (
            <Text style={styles.primaryText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>Try loading your address again</Text>
          ) : (
            <>
              <ShoppingBag size={17} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.primaryText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                {`Send my errand (${units} ${units === 1 ? 'item' : 'items'})`}
              </Text>
              <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(17), lineHeight: getPortalLineHeight(17, 'heading') },
  scroll: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xl * 2 },
  title: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.title) },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
  card: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md, gap: Spacing.sm },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading) },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
  },
  smallBtnText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.caption) },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shimmerRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10 },
  showAll: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  tableHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 6, borderBottomWidth: 1 },
  headCell: { fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'body'),
  },
  // Fixed widths for the two short columns, so every line's item starts at the
  // same place and "Quantity" fits above its numbers on a Samsung A04.
  qtyCell: { width: moderateScale(64, 0.2), textAlign: 'center' },
  qtyValue: { fontFamily: FontFamily.bold },
  itemCell: { flex: 1 },
  noteText: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
    marginTop: 2,
  },
  sizeCell: { width: moderateScale(72, 0.2) },
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  summary: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: moderateScale(50, 0.2),
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  primaryText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading), color: '#FFFFFF' },
});
