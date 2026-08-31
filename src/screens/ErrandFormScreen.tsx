import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
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
  ShieldCheck,
} from 'lucide-react-native';
import { RootStackScreenProps } from '../navigation/types';
import {
  fetchBackendMerchantCategories,
  BackendMerchantCategory,
  FALLBACK_BACKEND_CATEGORIES,
} from '../services/merchantCategories';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';

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
  const { user, reorderFrom } = route.params || {};
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
        const msg = 'You can select up to 3 store categories only for a single errand.';
        setPabiliError(msg);
        Alert.alert('Category Limit (Max 3)', msg);
        return;
      }
      setSelectedCats([...selectedCats, catName]);
    }
  };

  const handleContinue = () => {
    setValidationError(null);

    if (selectedCats.length === 0) {
      setValidationError('Please select at least 1 store category to proceed.');
      return;
    }

    navigation.navigate('ErrandItems', { user, selectedCats });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.navHeaderRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backBtn, { backgroundColor: isDark ? 'transparent' : colors.bgGray }]}
          testID="back-button"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.textDark }]}>Errand Details</Text>
        <View style={styles.navHeaderRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.stepperContainer}>
          <View style={[styles.stepPillActive, { backgroundColor: colors.primary }]}>
            <View style={styles.stepNumCircleActive}>
              <Text style={styles.stepNumActive}>1</Text>
            </View>
            <Text style={styles.stepTextActive}>Choose Stores</Text>
          </View>
          <View style={[styles.stepperLine, { backgroundColor: colors.border }]} />
          <View style={[styles.stepPillInactive, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
            <Text style={[styles.stepNumInactive, { color: colors.textLight }]}>2</Text>
            <Text style={[styles.stepTextInactive, { color: colors.textLight }]}>List Items</Text>
          </View>
          <View style={[styles.stepperLine, { backgroundColor: colors.border }]} />
          <View style={[styles.stepPillInactive, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray }]}>
            <Text style={[styles.stepNumInactive, { color: colors.textLight }]}>3</Text>
            <Text style={[styles.stepTextInactive, { color: colors.textLight }]}>Review</Text>
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={[styles.headerTitle, { color: colors.textDark }]}>Where should we shop?</Text>
          <Text style={[styles.subTitle, { color: colors.textGray }]}>
            Pick up to 3 store categories and your rider will visit them in one trip.
          </Text>
        </View>

        <View
          style={[
            styles.fleetBanner,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
            },
          ]}
        >
          <View style={styles.fleetDot} />
          <Text style={[styles.fleetText, { color: isDark ? '#34D399' : '#065F46' }]}>
            Dispatchers active in Tacurong · Upfront rate calculation before purchase
          </Text>
        </View>

        {validationError ? (
          <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2', borderColor: colors.danger }]} testID="validation-error-banner">
            <AlertCircle size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]} testID="validation-error-text">
              {validationError}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow} testID="pabili-section">
          <View style={styles.sectionHeaderLeft}>
            <ShoppingCart size={18} color={colors.primary} strokeWidth={2.2} />
            <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Store Categories</Text>
          </View>
          <View
            style={[
              styles.counterBadge,
              {
                backgroundColor: selectedCats.length > 0 ? colors.primary : (isDark ? 'rgba(255,255,255,0.08)' : colors.bgGray),
              },
            ]}
          >
            <Text
              style={[
                styles.counterBadgeText,
                { color: selectedCats.length > 0 ? '#FFFFFF' : colors.textGray },
              ]}
            >
              {selectedCats.length === 0 ? 'Pick up to 3' : `${selectedCats.length} of 3 chosen`}
            </Text>
          </View>
        </View>

        {pabiliError ? (
          <Text style={[styles.limitErrorText, { color: colors.danger }]} testID="category-limit-error">
            {pabiliError}
          </Text>
        ) : null}

        {categoriesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textGray }]}>
              Loading store categories from server...
            </Text>
          </View>
        ) : (
          <View style={styles.categoryGrid}>
            {categories.map((cat, index) => {
              const isSelected = selectedCats.includes(cat.name);
              const CatIcon = getCategoryIcon(cat.name);

              return (
                <TouchableOpacity
                  key={`category-${cat.id ?? ''}-${cat.name}-${index}`}
                  testID={`category-card-${cat.name}`}
                  activeOpacity={0.85}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                    isSelected && Shadows.soft,
                  ]}
                  onPress={() => toggleCategory(cat.name)}
                >
                  <View style={styles.categoryCardTop}>
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

                    <View
                      style={[
                        styles.selectIndicator,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : (isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray),
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {isSelected ? (
                        <Check size={12} color="#FFFFFF" strokeWidth={3} />
                      ) : (
                        <Plus size={12} color={colors.textLight} strokeWidth={2.5} />
                      )}
                    </View>
                  </View>

                  <Text style={[styles.categoryCardName, { color: colors.textDark }]} numberOfLines={1}>
                    {cat.name}
                  </Text>

                  {cat.description ? (
                    <Text style={[styles.categoryCardDesc, { color: colors.textGray }]} numberOfLines={2}>
                      {cat.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View
          style={[
            styles.trustCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.soft,
          ]}
        >
          <View style={[styles.trustIconHalo, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FFF0F5' }]}>
            <ShieldCheck size={20} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.trustTextCol}>
            <Text style={[styles.trustTitle, { color: colors.textDark }]}>
              Transparent Pricing Guarantee
            </Text>
            <Text style={[styles.trustSub, { color: colors.textGray }]}>
              Items are bought at exact store receipt prices. Your dispatcher calculates the transparent delivery fare via live chat before rider purchase.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          testID="submit-errand-form-button"
          activeOpacity={0.85}
          style={[
            styles.submitBtn,
            {
              backgroundColor: selectedCats.length > 0 ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB'),
            },
            selectedCats.length > 0 && Shadows.liftedUp,
          ]}
          onPress={handleContinue}
          disabled={selectedCats.length === 0}
        >
          <Text
            style={[
              styles.submitBtnText,
              { color: selectedCats.length > 0 ? '#FFFFFF' : colors.textGray },
            ]}
          >
            {selectedCats.length > 0
              ? `Continue with ${selectedCats.length} ${selectedCats.length === 1 ? 'store' : 'stores'}`
              : 'Choose a store to continue'}
          </Text>
          {selectedCats.length > 0 && <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
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
    fontSize: scaledFontSize(FontSizes.md, 0.35),
  },
  navHeaderRightPlaceholder: {
    width: 36,
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  stepNumCircleActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(10, 0.3),
    color: '#F62459',
  },
  stepTextActive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(11, 0.3),
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
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  stepNumInactive: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(10, 0.3),
  },
  stepTextInactive: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(11, 0.3),
  },
  titleSection: {
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.lg, 0.2),
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subTitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: moderateScale(16, 0.2),
  },
  fleetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  fleetDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  fleetText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(10, 0.2),
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
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
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
  counterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  counterBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(9.5, 0.2),
  },
  limitErrorText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(10, 0.2),
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
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  categoryGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  categoryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  categoryCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs + 2,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardName: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    marginBottom: 3,
  },
  categoryCardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    lineHeight: 15,
  },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  trustIconHalo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTextCol: {
    flex: 1,
  },
  trustTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    marginBottom: 1,
  },
  trustSub: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    lineHeight: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: moderateScale(11, 0.2),
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    minHeight: moderateScale(48, 0.2),
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
  },
});
