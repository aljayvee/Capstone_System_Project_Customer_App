import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { showAppAlert } from '../services/alertModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingCart,
  Check,
  Plus,
  AlertCircle,
  ChevronLeft,
  ArrowRight,
  Pill,
  Utensils,
  Store,
  ShoppingBag,
  Package,
} from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import {
  fetchBackendMerchantCategories,
  BackendMerchantCategory,
  FALLBACK_BACKEND_CATEGORIES,
} from '../services/merchantCategories';
import { useThemeColor } from '../hooks/useThemeColor';
import StoreModeToggle, { type StoreMode } from '../components/pabili/StoreModeToggle';
import EstablishmentPicker from '../components/pabili/EstablishmentPicker';
import type { Establishment } from '../services/establishments';
import { toPickedStores } from '../services/pabiliDraft';
import {
  FontFamily,
  FontSizes,
  Spacing,
  BorderRadius,
  Shadows,
  useResponsive,
  MAX_CONTENT_WIDTH,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';

const getCategoryIcon = (categoryName: string) => {
  const lower = String(categoryName || '').toLowerCase();
  if (lower.includes('pharmacy') || lower.includes('health') || lower.includes('drug') || lower.includes('med')) return Pill;
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('dining') || lower.includes('eatery')) return Utensils;
  if (lower.includes('supermarket') || lower.includes('grocery') || lower.includes('market') || lower.includes('mart')) return ShoppingBag;
  if (lower.includes('bakery') || lower.includes('bread') || lower.includes('cake')) return Store;
  if (lower.includes('retail') || lower.includes('general') || lower.includes('hardware') || lower.includes('supplies')) return Package;
  return ShoppingCart;
};

export default function ErrandFormScreen({ route, navigation }: RootStackScreenProps<'ErrandForm'>) {
  const { user, reorderFrom, initialMode } = route.params || {};
  const { colors, isDark } = useThemeColor();
  const { isTablet } = useResponsive();

  const [categories, setCategories] = useState<BackendMerchantCategory[]>(FALLBACK_BACKEND_CATEGORIES);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  /**
   * Categories a reorder arrives with, already selected.
   *
   * Smart defaults: a customer repeating last week's grocery run should not
   * have to re-pick the same categories from scratch. Split on the same
   * separator the history card joins them with, capped at the 3 this form
   * allows, and filtered to non-empty — a reorder must never open the form in
   * a state the form itself would reject.
   */
  const [selectedCats, setSelectedCats] = useState<string[]>(() => {
    const raw = reorderFrom?.categories;
    if (!raw) return [];
    return raw
      .split(/[,&]/)
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 3);
  });
  const [pabiliError, setPabiliError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  // Merchant: kinds of store, and the dispatcher picks the shops. Location: the
  // shops themselves, which reach the dispatcher already pinned. Each keeps its
  // own picks, so switching back and forth loses nothing.
  const [mode, setMode] = useState<StoreMode>(initialMode === 'location' ? 'location' : 'merchant');
  const [pickedStores, setPickedStores] = useState<Establishment[]>([]);
  const chosenCount = mode === 'location' ? pickedStores.length : selectedCats.length;

  useEffect(() => {
    let isMounted = true;
    fetchBackendMerchantCategories()
      .then((cats) => {
        if (isMounted && Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);

          // A reorder can name a category the owner has since deactivated.
          // Leaving it selected would submit an errand against a store type the
          // system no longer offers, so reconcile against what is actually live.
          setSelectedCats((prev) =>
            prev.filter((name) =>
              cats.some((c) => c.name.toLowerCase() === name.toLowerCase())
            )
          );
        }
      })
      .catch((err) => {
        console.warn('[ErrandFormScreen] Error fetching server merchant categories:', err);
      })
      .finally(() => {
        if (isMounted) setCategoriesLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleCategory = (catName: string) => {
    setPabiliError(null);
    setValidationError(null);
    if (selectedCats.includes(catName)) {
      setSelectedCats(selectedCats.filter((c) => c !== catName));
    } else {
      if (selectedCats.length >= 3) {
        const msg = 'You can select up to 3 merchant categories only for a single errand.';
        setPabiliError(msg);
        showAppAlert({
          title: 'Category Limit (Max 3)',
          message: msg,
          variant: 'warning',
        });
        return;
      }
      setSelectedCats([...selectedCats, catName]);
    }
  };

  const toggleStore = (store: Establishment) => {
    setPabiliError(null);
    setValidationError(null);
    if (pickedStores.some((s) => s.key === store.key)) {
      setPickedStores(pickedStores.filter((s) => s.key !== store.key));
      return;
    }
    if (pickedStores.length >= 3) {
      const msg = 'You can pick up to 3 stores for a single errand.';
      setPabiliError(msg);
      showAppAlert({ title: 'Store Limit (Max 3)', message: msg, variant: 'warning' });
      return;
    }
    setPickedStores([...pickedStores, store]);
  };

  const changeMode = (next: StoreMode) => {
    setMode(next);
    setPabiliError(null);
    setValidationError(null);
  };

  const handleContinue = () => {
    setValidationError(null);

    if (mode === 'location') {
      if (pickedStores.length === 0) {
        setValidationError('Please pick at least 1 store to proceed.');
        return;
      }
      const stores = toPickedStores(pickedStores);
      navigation.navigate('ErrandItems', { user, selectedCats: stores.map((s) => s.key), stores });
      return;
    }

    if (selectedCats.length === 0) {
      setValidationError('Please select at least 1 merchant category to proceed.');
      return;
    }

    navigation.navigate('ErrandItems', { user, selectedCats });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.navHeaderRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={PortalTouchTargets.compactHitSlop}
          style={styles.backBtn}
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
          Errand Details
        </Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.stepperContainer}>
          <View style={[styles.stepPillActive, { backgroundColor: colors.primary }]}>
            <View style={styles.stepNumCircleActive}>
              <Text style={styles.stepNumActive} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>1</Text>
            </View>
            <Text style={styles.stepTextActive} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Choose Stores</Text>
          </View>
          <View style={[styles.stepperLine, { backgroundColor: colors.border }]} />
          <View style={[styles.stepPillInactive, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
            <Text style={[styles.stepNumInactive, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>2</Text>
            <Text style={[styles.stepTextInactive, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>List Items</Text>
          </View>
          <View style={[styles.stepperLine, { backgroundColor: colors.border }]} />
          <View style={[styles.stepPillInactive, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
            <Text style={[styles.stepNumInactive, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>3</Text>
            <Text style={[styles.stepTextInactive, { color: colors.textLight }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>Review</Text>
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={[styles.headerTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.title}>
            Where should we shop?
          </Text>
        </View>

        <StoreModeToggle mode={mode} onChange={changeMode} />

        {validationError ? (
          <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]} testID="validation-error-banner">
            <AlertCircle size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]} testID="validation-error-text" maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              {validationError}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow} testID="pabili-section">
          <View style={styles.sectionHeaderLeft}>
            <ShoppingCart size={18} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.sectionTitle, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
              {mode === 'location' ? 'Stores' : 'Merchant Categories'}
            </Text>
          </View>
          <View
            style={[
              styles.counterBadge,
              {
                backgroundColor: chosenCount > 0 ? colors.primary : (isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray),
              },
            ]}
          >
            <Text
              style={[
                styles.counterBadgeText,
                { color: chosenCount > 0 ? '#FFFFFF' : colors.textGray },
              ]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
            >
              {chosenCount === 0 ? 'Pick up to 3' : `${chosenCount} of 3 chosen`}
            </Text>
          </View>
        </View>

        {pabiliError ? (
          <Text style={[styles.limitErrorText, { color: colors.danger }]} testID="category-limit-error" maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
            {pabiliError}
          </Text>
        ) : null}

        {mode === 'location' ? (
          <View style={styles.categoryList}>
            <EstablishmentPicker userId={user?.id} selected={pickedStores} onToggle={toggleStore} />
          </View>
        ) : categoriesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textGray }]}>
              Loading merchant categories from server...
            </Text>
          </View>
        ) : (
          <View style={styles.categoryList}>
            {categories.map((cat, index) => {
              const isSelected = selectedCats.includes(cat.name);
              const CatIcon = getCategoryIcon(cat.name);

              return (
                <TouchableOpacity
                  key={`category-${cat.id ?? ''}-${cat.name}-${index}`}
                  testID={`category-card-${cat.name}`}
                  activeOpacity={0.7}
                  style={[
                    styles.categoryRow,
                    {
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(246, 36, 89, 0.08)' : '#FFF5F7')
                        : 'transparent',
                    },
                  ]}
                  onPress={() => toggleCategory(cat.name)}
                >
                  <View
                    style={[
                      styles.categoryIconCircle,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : (isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray),
                      },
                    ]}
                  >
                    <CatIcon
                      size={20}
                      color={isSelected ? '#FFFFFF' : colors.primary}
                      strokeWidth={2.2}
                    />
                  </View>

                  <View style={styles.categoryInfoCol}>
                    <Text
                      style={[
                        styles.categoryCardName,
                        { color: isSelected ? colors.primary : colors.textDark },
                      ]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={PortalFontSizeMultipliers.card}
                    >
                      {cat.name}
                    </Text>
                    {cat.description ? (
                      <Text
                        style={[styles.categoryCardDesc, { color: colors.textGray }]}
                        numberOfLines={2}
                        maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
                      >
                        {cat.description}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.selectIndicator,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : (isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray),
                        borderColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {isSelected ? (
                      <Check size={13} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <Plus size={13} color={colors.textLight} strokeWidth={2.5} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          testID="submit-errand-form-button"
          activeOpacity={0.85}
          style={[
            styles.submitBtn,
            {
              backgroundColor: chosenCount > 0 ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB'),
            },
          ]}
          onPress={handleContinue}
          disabled={chosenCount === 0}
        >
          <Text
            style={[
              styles.submitBtnText,
              { color: chosenCount > 0 ? '#FFFFFF' : colors.textGray },
            ]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.button}
          >
            {chosenCount > 0
              ? `Continue with ${chosenCount} ${chosenCount === 1 ? 'store' : 'stores'}`
              : 'Choose a store to continue'}
          </Text>
          {chosenCount > 0 && <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
        </TouchableOpacity>
      </ScrollView>
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
    borderBottomWidth: 0,
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
    paddingBottom: Spacing.xl * 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  stepPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  stepNumCircleActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.2),
    color: '#F62459',
  },
  stepTextActive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.25),
    color: '#FFFFFF',
  },
  stepperLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 4,
  },
  stepPillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  stepNumInactive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.2),
  },
  stepTextInactive: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.25),
  },
  titleSection: {
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.title),
    lineHeight: getPortalLineHeight(PortalFontSizes.title, 'heading'),
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  counterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  counterBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.2),
  },
  limitErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.35),
    marginBottom: Spacing.xs,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
  },
  categoryList: {
    marginBottom: Spacing.xl,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderRadius: BorderRadius.md,
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfoCol: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  selectIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardName: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
    marginBottom: 2,
  },
  categoryCardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'),
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: moderateScale(11, 0.2),
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    minHeight: PortalTouchTargets.buttonHeight,
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 1.25),
  },
});
