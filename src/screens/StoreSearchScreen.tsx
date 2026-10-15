import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { ChevronLeft, RotateCcw } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { useMerchantCategories } from '../hooks/useMerchantCategories';
import { useCategoryImages } from '../hooks/useCategoryImages';
import { useStorePicks } from '../hooks/useStorePicks';
import EstablishmentPicker from '../components/pabili/EstablishmentPicker';
import StepPills from '../components/pabili/StepPills';
import { ProceedDock } from '../components/stores/ProceedDock';
import { toPickedStores } from '../services/pabiliDraft';
import { isPabiliCategory, recordCategorySearchAffinity } from '../services/merchantCategories';
import type { RootStackScreenProps } from '../navigation/types';
import {
  BorderRadius,
  FontFamily,
  MAX_CONTENT_WIDTH,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../config/theme';

/**
 * Step 1 of a Pabili errand (2026-10-10): search for the stores to buy from.
 * Opened from Home's Search button and the bottom bar's "+", in place of the
 * Errand Details form's Merchant/Location step.
 *
 * Opens with the keyboard up, on the stores near the customer's saved location
 * (the server's recommendation order: distance first, then their own past
 * orders and everyone's), each a photo card as on the Popular Stores screen.
 * Nothing above the list but the search field (2026-10-10: the "Where should we
 * shop?" heading and the "Pick up to 3" badge are gone). Picking a store brings
 * up "Proceed with this store (1)", up to 3, which opens the Shopping list with
 * them, as a Home store card does with one.
 *
 * Keyboard-safe like Edit Account: the list scrolls clear of the keyboard and
 * the Proceed bar rides on it, so a pick and Proceed need no keyboard dismiss.
 *
 * "Order again" in My Errands opens it with that errand's stores already picked
 * (`reorderFrom`), and without the keyboard, since the stores are already here:
 * the customer can Continue at once, or change them first.
 *
 * A Home category tile opens it on that merchant category's stores (`category`,
 * 2026-10-10), also without the keyboard, since the list is what they came for.
 * The category's chip clears it, to search every store.
 */
export default function StoreSearchScreen({ route, navigation }: RootStackScreenProps<'StoreSearch'>) {
  const { user, reorderFrom, category } = route.params || ({} as any);
  return (
    <StoreSearchView
      user={user}
      reorderFrom={reorderFrom}
      category={category}
      navigation={navigation}
      onBack={() => navigation.goBack()}
    />
  );
}

/** The floating bottom bar's height plus the gap under it (components/BottomNav.tsx). */
const BOTTOM_NAV_HEIGHT = 68;

/**
 * Find stores itself, as its own screen (above) or as the bottom bar's Search
 * tab (2026-10-14, `inTab`). The bar's Search button used to open it as a
 * screen over the portal, which hid the bar; as a tab the bar stays, Search
 * marked as the open tab. Home's search field, a category tile and "Order
 * again" still open the screen, with no bar, as before.
 *
 * In a tab, the list and the Proceed bar leave room for the floating bottom
 * bar, and Back returns to Home.
 */
export function StoreSearchView({
  user,
  reorderFrom,
  category: openedCategory,
  navigation,
  onBack,
  inTab = false,
}: {
  user: any;
  reorderFrom?: { errandId: string; stores: any[] };
  category?: { id: number; name: string };
  navigation: any;
  onBack: () => void;
  inTab?: boolean;
}) {
  const initialCategory =
    openedCategory && isPabiliCategory(openedCategory.name) ? openedCategory : null;
  const [category, setCategory] = useState<{ id: number; name: string } | null>(initialCategory);

  useEffect(() => {
    if (category?.name) {
      void recordCategorySearchAffinity(category.name);
    }
  }, [category?.name]);

  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const { categories } = useMerchantCategories();
  const categoryImages = useCategoryImages(categories);
  const { picked, toggle: toggleStore, limitError } = useStorePicks(reorderFrom?.stores ?? []);
  const isReorder = Boolean(reorderFrom);

  // A past errand's stop carries its category's id, and its name only in some
  // payloads: fill the name from the catalogue, so the row and the Shopping
  // list know what kind of shop it is.
  const shown = useMemo(
    () =>
      picked.map((store) => {
        if (store.categoryName || store.categoryId == null) return store;
        const category = categories.find((c) => c.id === store.categoryId);
        return category ? { ...store, categoryName: category.name } : store;
      }),
    [picked, categories]
  );
  const [dockHeight, setDockHeight] = useState(0);

  const handleContinue = () => {
    if (shown.length === 0) return;
    const stores = toPickedStores(shown);
    navigation.navigate('ErrandItems', { user, selectedCats: stores.map((s) => s.key), stores });
  };

  const count = picked.length;
  // In a tab, the floating bottom bar covers this much of the bottom edge.
  const navSpace = inTab ? BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, 12) + Spacing.sm : 0;
  // What the Proceed bar keeps under its button: the bottom bar's room in a
  // tab, else the phone's navigation bar.
  const dockPadding = inTab ? navSpace : insets.bottom;
  // The Proceed bar is only there once a store is picked.
  const dockCovers = count > 0 ? Math.max(0, dockHeight - dockPadding) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'left', 'right']}>
      <View style={styles.navHeaderRow}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          Find stores
        </Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      <KeyboardAwareScrollView
        // With no Proceed bar, the list runs to the phone's navigation bar.
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Spacing.lg + (count > 0 ? 0 : inTab ? navSpace : insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
        // A tap on a store picks it, even with the keyboard up.
        keyboardShouldPersistTaps="handled"
        bottomOffset={dockCovers + Spacing.md}
        testID="store-search-screen"
      >
        <StepPills step={1} storeCount={count} />

        {isReorder ? (
          <View
            style={[styles.reorderNote, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgGray }]}
            testID="store-search-reorder-note"
          >
            <RotateCcw size={14} color={colors.textGray} />
            <Text style={[styles.reorderNoteText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              {(reorderFrom?.stores?.length ?? 0) > 0
                ? 'The stores from your past order are picked. Proceed, or change them first.'
                : "We couldn't find the stores from that order. Search for them by name."}
            </Text>
          </View>
        ) : null}

        {limitError ? (
          <Text
            style={[styles.limitErrorText, { color: colors.danger }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
            testID="store-limit-error"
          >
            {limitError}
          </Text>
        ) : null}

        <EstablishmentPicker
          userId={user?.id}
          selected={shown}
          onToggle={toggleStore}
          autoFocus={picked.length === 0 && !openedCategory}
          category={category}
          onClearCategory={() => setCategory(null)}
          categoryImages={categoryImages}
          onLetRiderPick={
            category && picked.length === 0
              ? () => navigation.navigate('ErrandItems', { user, selectedCats: [category.name] })
              : undefined
          }
        />
      </KeyboardAwareScrollView>

      {/* The keyboard's height already includes the navigation bar the bar
          pads for, so it rides up by that much less (the opened offset). */}
      <KeyboardStickyView offset={{ closed: 0, opened: dockPadding }}>
        <ProceedDock
          count={count}
          onProceed={handleContinue}
          testID="store-search-proceed"
          onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}
          bottomPadding={inTab ? navSpace : undefined}
        />
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  backBtn: {
    width: PortalTouchTargets.compact,
    height: PortalTouchTargets.compact,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(17),
    lineHeight: getPortalLineHeight(17, 'heading'),
  },
  navHeaderRightPlaceholder: {
    width: PortalTouchTargets.compact,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  reorderNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: Spacing.sm,
  },
  reorderNoteText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
  },
  limitErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.35),
    marginBottom: Spacing.xs,
  },
});
