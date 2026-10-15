import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Not React Native's: under Expo's edge-to-edge Android build the window never
// resizes for the keyboard, so RN's version has nothing to react to.
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePabiliDraft } from '../../hooks/usePabiliDraft';
import {
  addTypedLines,
  adjustQuantity,
  applyStoreChecks,
  dismissRemovedStore,
  editRow,
  keepInStore,
  moveRow,
  noteRemovedStore,
  pabiliDraftStore,
  removeRow,
  rowsAwaitingStoreCheck,
  setCompose,
  type DraftRow,
  type StoreCheck,
  storeCategoryOf,
  storeKeyForCategory,
} from '../../services/pabiliDraft';
import { checkItemStores } from '../../services/itemStoreCheckService';
import { isStoreMismatch } from '../../utils/storeFit';
import { getCategoryIcon } from '../../constants/pabili';
import PabiliItemRow from '../../components/pabili/PabiliItemRow';
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

/**
 * One store's list, on a screen of its own.
 *
 * The compose box takes whatever the customer types, a pasted list included,
 * and the rules in utils/itemEntryParser.ts move a stated count onto the
 * stepper and a size beside the name ("5 Kilo of Chicken 2qty" becomes
 * "2 × Chicken · 5 kg"). A line they cannot read safely is added exactly as
 * typed and read by the server's model on Review, with nothing to confirm.
 * Each typed item is also checked against this store: one usually sold
 * elsewhere gets a question under its row. A store's name typed into the line
 * ("Rose Pharmacy Lozartan 5mg") is taken out of the item, with a warning.
 */
export default function PabiliStoreEditorScreen({ route, navigation }: RootStackScreenProps<'PabiliStoreEditor'>) {
  const { category } = route.params;
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const draft = usePabiliDraft();
  const [editing, setEditing] = useState<{ row: DraftRow; name: string; size: string; notes: string } | null>(null);

  const rows = draft?.rowsByCategory[category] ?? [];
  const compose = draft?.composeByCategory[category] ?? { text: '', quantity: 1 };
  // What kind of shop this is: the category itself, or a picked store's category.
  const kind = storeCategoryOf(draft, category);
  const picked = draft?.stores?.[category] ?? null;
  const Icon = getCategoryIcon(kind);
  const units = rows.reduce((sum, r) => sum + r.quantity, 0);

  // Android Three-Key Navigation: Back button dismisses the edit modal first or navigates back safely
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (editing) {
        setEditing(null);
        return true;
      }
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [editing, navigation]);

  const commit = () => {
    if (!compose.text.trim()) return;
    pabiliDraftStore.update((d) => addTypedLines(d, category, compose.text, compose.quantity));
  };

  // ── does each item belong in this store? ─────────────────────────────
  // Asked once per pause in adding, for every row not yet asked about, in one
  // request. Only a strong answer naming a store that does not stock that kind
  // of thing becomes a question (utils/storeFit.ts); anything else, including
  // a server that cannot answer, quietly counts as fitting.
  const awaitingKey = draft ? rowsAwaitingStoreCheck(draft, category).map((r) => `${r.id}:${r.name}`).join('|') : '';
  useEffect(() => {
    if (!awaitingKey) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const current = pabiliDraftStore.getSnapshot();
      const asked = current ? rowsAwaitingStoreCheck(current, category) : [];
      if (asked.length === 0) return;
      const answers = await checkItemStores(asked.map((r) => r.name));
      if (cancelled) return;
      pabiliDraftStore.update((d) =>
        applyStoreChecks(
          d,
          category,
          asked.map((r, i) => {
            const answer = answers?.[i];
            const check: StoreCheck =
              answer?.strong && answer.usualStore && isStoreMismatch(storeCategoryOf(current, category), answer.usualStore)
                ? { status: 'mismatch', usualStore: answer.usualStore }
                : { status: 'fits' };
            return { id: r.id, name: r.name, check };
          })
        )
      );
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [awaitingKey, category]);

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) return;
    pabiliDraftStore.update((d) => editRow(d, category, editing.row.id, { name: editing.name, size: editing.size, notes: editing.notes }));
    setEditing(null);
  };

  if (!draft) {
    // Reached without the hub (a stale deep link, or the list was just sent).
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.bgApp }]} testID="editor-no-list">
        <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          This list isn't open
        </Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, alignSelf: 'stretch' }]} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryText} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={PortalTouchTargets.compactHitSlop}
            style={styles.backBtn}
            testID="editor-back"
            accessibilityLabel="Back to your stores"
          >
            <ChevronLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <View style={styles.navTitleRow}>
            <Icon size={16} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.navTitle, { color: colors.textDark }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
              {category}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={PortalTouchTargets.compactHitSlop}
            style={styles.doneNavBtn}
            testID="editor-done"
            accessibilityLabel="Done"
          >
            <Text style={[styles.doneNavText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {picked ? (
            <Text
              style={[styles.caption, styles.pickedStoreLine, { color: colors.textGray }]}
              numberOfLines={2}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
              testID="editor-picked-store"
            >
              {[picked.categoryName, picked.address].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {rows.length === 0 ? (
            <View style={[styles.empty, { borderColor: colors.border }]} testID="editor-empty">
              <Text style={[styles.emptyTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
                Nothing from {category} yet
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {rows.map((row, index) => (
                <View key={row.id}>
                  <PabiliItemRow
                    row={row}
                    testID={`row-${index}`}
                    onPress={() => setEditing({ row, name: row.name, size: row.size ?? '', notes: row.notes ?? '' })}
                    onIncrement={() => pabiliDraftStore.update((d) => adjustQuantity(d, category, row.id, 1))}
                    onDecrement={() => pabiliDraftStore.update((d) => adjustQuantity(d, category, row.id, -1))}
                    onRemove={() => pabiliDraftStore.update((d) => removeRow(d, category, row.id))}
                  />
                  {row.removedStore ? (
                    <StoreNameNotice
                      row={row}
                      store={row.removedStore}
                      category={category}
                      pickedStore={picked?.name ?? null}
                      testID={`store-name-${index}`}
                    />
                  ) : null}
                  {row.storeCheck?.status === 'mismatch' ? (
                    <StoreMismatchNotice
                      row={row}
                      category={category}
                      usualStore={row.storeCheck.usualStore}
                      moveTo={storeKeyForCategory(draft, row.storeCheck.usualStore)}
                      testID={`store-check-${index}`}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.composeBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
            Shadows.liftedUp,
          ]}
        >
          {/* Top Row: What to buy (expanded) + Quantity Stepper on the right */}
          <View style={styles.composeRow}>
            <View style={styles.composeField}>
              <Text style={[styles.fieldCaption, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
                What to buy
              </Text>
              <TextInput
                style={[
                  styles.composeInput,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FAFAFA', borderColor: colors.border, color: colors.textDark },
                ]}
                placeholder="5 kilo chicken x2"
                placeholderTextColor={colors.textLight}
                value={compose.text}
                onChangeText={(text) => pabiliDraftStore.update((d) => setCompose(d, category, { text }))}
                onSubmitEditing={commit}
                // Multiline so a pasted list keeps its line breaks; "submit" so
                // the keyboard's Enter adds the item instead of a new line.
                multiline
                submitBehavior="submit"
                returnKeyType="done"
                maxLength={1000}
                testID="compose-input"
                accessibilityLabel={`What to buy from ${category}`}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.title}
              />
            </View>

            {/* In the right side, add Quantity */}
            <View style={styles.composeQtyField}>
              <Text
                style={[styles.fieldCaption, styles.fieldCaptionCenter, { color: colors.textGray }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                Quantity
              </Text>
              <View
                style={[
                  styles.stepper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => pabiliDraftStore.update((d) => setCompose(d, category, { quantity: Math.max(1, compose.quantity - 1) }))}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  testID="compose-minus"
                  accessibilityLabel="One fewer"
                >
                  <Minus size={13} color={compose.quantity > 1 ? colors.textDark : colors.textLight} />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.stepperValue,
                    { color: colors.textDark },
                  ]}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
                >
                  {compose.quantity}
                </Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => pabiliDraftStore.update((d) => setCompose(d, category, { quantity: compose.quantity + 1 }))}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  testID="compose-plus"
                  accessibilityLabel="One more"
                >
                  <Plus size={13} color={colors.textDark} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Quick Quantities Presets */}
          <View style={styles.pillRow}>
            {QUICK_QUANTITIES.map((n) => {
              const selected = compose.quantity === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.qtyPill,
                    {
                      backgroundColor: selected ? colors.primary : isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => pabiliDraftStore.update((d) => setCompose(d, category, { quantity: n }))}
                  hitSlop={PortalTouchTargets.compactHitSlop}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Quantity ${n}`}
                  testID={`quick-qty-${n}`}
                >
                  <Text
                    style={[styles.qtyPillText, { color: selected ? '#FFFFFF' : colors.textDark }]}
                    maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                  >
                    {`${n}×`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom Button: Replaced "Back to my Stores" with "+" Add Item button */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: compose.text.trim()
                  ? colors.primary
                  : isDark
                  ? 'rgba(255,255,255,0.08)'
                  : '#E2E8F0',
              },
            ]}
            onPress={commit}
            testID="compose-add"
            accessibilityLabel={`Add item to ${category}`}
            hitSlop={PortalTouchTargets.compactHitSlop}
          >
            <Plus
              size={18}
              color={compose.text.trim() ? '#FFFFFF' : colors.textLight}
              strokeWidth={2.8}
            />
            <Text
              style={[
                styles.primaryText,
                { color: compose.text.trim() ? '#FFFFFF' : colors.textLight },
              ]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
              Edit item
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Item</Text>
            <TextInput
              value={editing?.name ?? ''}
              onChangeText={(name) => setEditing((e) => (e ? { ...e, name } : e))}
              style={[styles.field, { borderColor: colors.border, color: colors.textDark }]}
              maxLength={120}
              testID="edit-name"
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            />
            <Text style={[styles.fieldLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              Unit (optional)
            </Text>
            <TextInput
              value={editing?.size ?? ''}
              onChangeText={(size) => setEditing((e) => (e ? { ...e, size } : e))}
              placeholder="5 kg, 1.5 L, 1 pack"
              placeholderTextColor={colors.textLight}
              style={[styles.field, { borderColor: colors.border, color: colors.textDark }]}
              maxLength={40}
              testID="edit-size"
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            />
            <Text style={[styles.fieldLabel, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              Note for the rider (optional)
            </Text>
            <TextInput
              value={editing?.notes ?? ''}
              onChangeText={(notes) => setEditing((e) => (e ? { ...e, notes } : e))}
              placeholder="e.g. pick ripe ones, any brand is fine"
              placeholderTextColor={colors.textLight}
              style={[styles.field, styles.noteField, { borderColor: colors.border, color: colors.textDark }]}
              maxLength={200}
              multiline
              testID="edit-notes"
              maxFontSizeMultiplier={PortalFontSizeMultipliers.body}
            />
            <View style={styles.sheetButtons}>
              <TouchableOpacity style={[styles.sheetBtn, { borderColor: colors.border }]} onPress={() => setEditing(null)}>
                <Text style={[styles.sheetBtnText, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: editing?.name.trim() ? colors.primary : '#F7A8BE', borderColor: 'transparent' }]}
                onPress={saveEdit}
                disabled={!editing?.name.trim()}
                testID="edit-save"
              >
                <Text style={[styles.sheetBtnText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** The counts customers ask for most, one tap each. */
const QUICK_QUANTITIES = [1, 2, 3, 5];

/**
 * "Rose Pharmacy Lozartan 5mg" was added as Lozartan, 5 mg. The dispatcher
 * picks which store a rider goes to, so a store's name in an item only sends
 * the rider looking for a product called "Rose Pharmacy Lozartan". The
 * customer is told it was taken out and may still ask for that store, which
 * then reaches the dispatcher and rider in the item's note.
 */
function StoreNameNotice({
  row,
  store,
  category,
  pickedStore,
  testID,
}: {
  row: DraftRow;
  store: string;
  category: string;
  /** The real store this list is for, when the customer picked one in step 1. */
  pickedStore: string | null;
  testID: string;
}) {
  const { isDark } = useThemeColor();
  const ink = isDark ? '#FDE68A' : '#92400E';
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB', borderColor: isDark ? '#D97706' : '#FCD34D' },
      ]}
      testID={testID}
    >
      <Text style={[styles.noticeText, { color: ink }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
        {pickedStore
          ? `We took "${store}" out of this item because it is a store, not something to buy. This list is for ${pickedStore}.`
          : `We took "${store}" out of this item because it is a store, not something to buy. Your dispatcher picks the store.`}
      </Text>
      <View style={styles.noticeActions}>
        <TouchableOpacity
          style={[styles.noticeBtn, { borderColor: ink }]}
          onPress={() => pabiliDraftStore.update((d) => noteRemovedStore(d, category, row.id))}
          hitSlop={PortalTouchTargets.compactHitSlop}
          testID={`${testID}-ask`}
        >
          <Text
            style={[styles.noticeBtnText, { color: ink }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
          >
            {`Ask for ${store}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.noticeBtn, { borderColor: ink }]}
          onPress={() => pabiliDraftStore.update((d) => dismissRemovedStore(d, category, row.id))}
          hitSlop={PortalTouchTargets.compactHitSlop}
          testID={`${testID}-ok`}
        >
          <Text style={[styles.noticeBtnText, { color: ink }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
            OK
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * "Biogesic is usually bought at Pharmacy & Health." With that store already
 * on this errand, one tap moves the item there. Without it, the customer is
 * asked whether this store really has it, and either answer is final.
 */
function StoreMismatchNotice({
  row,
  category,
  usualStore,
  moveTo,
  testID,
}: {
  row: DraftRow;
  category: string;
  usualStore: string;
  /** The store on this list that sells it: the category itself, or a picked store of that kind. */
  moveTo: string | null;
  testID: string;
}) {
  const { colors, isDark } = useThemeColor();
  const canMove = Boolean(moveTo) && moveTo !== category;
  const ink = isDark ? '#FDE68A' : '#92400E';
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB', borderColor: isDark ? '#D97706' : '#FCD34D' },
      ]}
      testID={testID}
    >
      <Text style={[styles.noticeText, { color: ink }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
        {canMove
          ? `${row.name} is usually bought at ${usualStore}.`
          : `${row.name} is usually sold at ${usualStore}. Are you sure ${category} has it?`}
      </Text>
      <View style={styles.noticeActions}>
        {canMove ? (
          <TouchableOpacity
            style={[styles.noticeBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => pabiliDraftStore.update((d) => moveRow(d, category, moveTo!, row.id))}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID={`${testID}-move`}
          >
            <Text style={[styles.noticeBtnText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              {`Move to ${moveTo}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.noticeBtn, { borderColor: ink }]}
            onPress={() => pabiliDraftStore.update((d) => removeRow(d, category, row.id))}
            hitSlop={PortalTouchTargets.compactHitSlop}
            testID={`${testID}-remove`}
          >
            <Text style={[styles.noticeBtnText, { color: ink }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              Remove
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.noticeBtn, { borderColor: ink }]}
          onPress={() => pabiliDraftStore.update((d) => keepInStore(d, category, row.id))}
          hitSlop={PortalTouchTargets.compactHitSlop}
          testID={`${testID}-keep`}
        >
          <Text style={[styles.noticeBtnText, { color: ink }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
            {canMove ? 'Keep it here' : 'Yes, keep it'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  notice: {
    marginTop: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  noticeText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noticeBtn: {
    // Never wider than the notice, however long the store name (2026-10-14).
    maxWidth: '100%',
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBtnText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.caption) },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  navTitle: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(17), lineHeight: getPortalLineHeight(17, 'heading'), flexShrink: 1 },
  doneNavBtn: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  doneNavText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'label'),
  },
  scroll: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  title: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.title) },
  pickedStoreLine: { marginBottom: 10 },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'body'),
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    padding: Spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
  },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  list: { gap: 8 },
  composeBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  composeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  composeField: { flex: 1 },
  composeQtyField: { alignItems: 'center' },
  fieldCaption: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'body'),
    marginBottom: 4,
  },
  fieldCaptionCenter: { textAlign: 'center' },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyPill: {
    minWidth: 44,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPillText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.caption) },
  noteField: { minHeight: 64, paddingTop: 12, textAlignVertical: 'top' },
  composeInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  stepperBtn: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body), minWidth: 24, textAlign: 'center' },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(11,19,43,0.5)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: 6 },
  sheetTitle: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading), marginBottom: Spacing.xs },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: scaledPortalFontSize(PortalFontSizes.micro), marginTop: 6 },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
  },
  sheetButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  sheetBtn: { flex: 1, minHeight: 48, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
});
