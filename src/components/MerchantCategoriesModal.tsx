import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import {
  X,
  Search,
  Store,
  Pill,
  ShoppingBag,
  Utensils,
  ShoppingBasket,
  ChevronRight,
  Sparkles,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius, Shadows, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { BackendMerchantCategory } from '../services/merchantCategories';
import { useCategoryImages } from '../hooks/useCategoryImages';
import { useMerchantCategories } from '../hooks/useMerchantCategories';

export interface MerchantCategoriesModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCategory: (categoryName: string) => void;
}

/**
 * Dynamic Icon and theme mapping for Backend Categories
 */
function getCategoryVisuals(catName?: string, primaryColor: string = '#F62459'): {
  Icon: LucideIcon;
  iconColor: string;
  bgLight: string;
} {
  const normalized = String(catName || '').toLowerCase();

  if (normalized.includes('food') || normalized.includes('restaurant') || normalized.includes('cafe')) {
    return { Icon: Utensils, iconColor: '#EF4444', bgLight: '#FEE2E2' };
  }
  if (normalized.includes('pharmacy') || normalized.includes('health') || normalized.includes('med')) {
    return { Icon: Pill, iconColor: '#10B981', bgLight: '#ECFDF5' };
  }
  if (normalized.includes('supermarket') || normalized.includes('grocery') || normalized.includes('mall')) {
    return { Icon: Store, iconColor: '#3B82F6', bgLight: '#EFF6FF' };
  }
  if (normalized.includes('bakery') || normalized.includes('bread') || normalized.includes('pastr')) {
    return { Icon: ShoppingBag, iconColor: '#F59E0B', bgLight: '#FEF3C7' };
  }
  if (normalized.includes('retail') || normalized.includes('merchandise') || normalized.includes('goods')) {
    return { Icon: ShoppingBasket, iconColor: '#8B5CF6', bgLight: '#F5F3FF' };
  }

  return { Icon: Store, iconColor: primaryColor, bgLight: '#FFEEF3' };
}

export default function MerchantCategoriesModal({
  visible,
  onClose,
  onSelectCategory,
}: MerchantCategoriesModalProps) {
  const { colors, isDark } = useThemeColor();
  const [search, setSearch] = useState('');

  // Same live-synced source as the Home Bento grid. This modal used to run its
  // own one-shot fetch each time it opened, so the "See More" sheet and the grid
  // behind it could disagree about which categories still exist.
  const { categories, isLoading: loading, reload } = useMerchantCategories();

  // Same owner-set photos the Home Bento grid renders. Reusing the hook means
  // the modal reads from the cache the grid already warmed - the sheet opens
  // with the photos already there rather than popping them in a beat later.
  const categoryImages = useCategoryImages(categories);

  // Backs the "Reload from Server" button in the empty state. The hook keeps
  // itself current over the socket, so this is a manual escape hatch rather
  // than the mechanism.
  const loadBackendCategories = () => {
    void reload();
  };

  const filteredCategories = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!Array.isArray(categories)) return [];

    return categories.filter((cat) => {
      if (!cat) return false;
      const nameStr = String(cat.name || '').trim().toLowerCase();
      const descStr = String(cat.description || '').trim().toLowerCase();
      if (!q) return nameStr.length > 0;
      return nameStr.includes(q) || descStr.includes(q);
    });
  }, [categories, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissOverlay} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.liftedUp,
          ]}
        >
          {/* DRAG HANDLE INDICATOR */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
          </View>

          {/* HEADER ROW */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <View style={styles.headerTitleRow}>
                <Sparkles size={18} color={colors.primary} />
                <Text style={[styles.sheetTitle, { color: colors.textDark }]}>
                  Store & Merchant Categories
                </Text>
              </View>
              <Text style={[styles.sheetSubtitle, { color: colors.textGray }]}>
                Select any category found in the system to add items to buy
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close Category Selector"
              testID="close-merchant-categories-modal"
            >
              <X size={18} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          {/* SEARCH BAR */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                borderColor: colors.border,
              },
            ]}
          >
            <Search size={16} color={colors.primary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textDark }]}
              placeholder="Search category (e.g. Grocery, Pharmacy, Food)..."
              placeholderTextColor={colors.textLight}
              value={search}
              onChangeText={setSearch}
              testID="merchant-categories-search-input"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <X size={14} color={colors.textGray} />
              </TouchableOpacity>
            )}
          </View>

          {/* CATEGORIES BUTTONS LIST */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textGray }]}>
                Loading merchant categories from server...
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollList}
              showsVerticalScrollIndicator={false}
            >
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat, idx) => {
                  const catName = String(cat.name || 'Category');
                  const { Icon, iconColor, bgLight } = getCategoryVisuals(catName, colors.primary);
                  const photoUri = typeof cat.id === 'number' ? categoryImages[cat.id] : undefined;

                  return (
                    <TouchableOpacity
                      key={cat.id ? String(cat.id) : `${catName}-${idx}`}
                      activeOpacity={0.75}
                      style={[
                        styles.categoryCard,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                          borderColor: colors.border,
                        },
                        Shadows.soft,
                      ]}
                      onPress={() => {
                        onClose();
                        onSelectCategory(catName);
                      }}
                      testID={`merchant-category-card-${catName}`}
                    >
                      {/* The owner's photo when one is set, otherwise the
                          category's icon tile. Same precedence as the Bento
                          grid, so a category looks like itself in both places. */}
                      {photoUri ? (
                        <Image
                          source={{ uri: photoUri }}
                          style={styles.categoryThumb}
                          resizeMode="cover"
                          accessibilityLabel={`${catName} category photo`}
                        />
                      ) : (
                        <View
                          style={[
                            styles.categoryIconBadge,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : bgLight,
                              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
                            },
                          ]}
                        >
                          <Icon size={22} color={iconColor} strokeWidth={2.2} />
                        </View>
                      )}

                      <View style={styles.categoryInfoCol}>
                        <Text style={[styles.categoryName, { color: colors.textDark }]} numberOfLines={1}>
                          {catName}
                        </Text>
                        <Text style={[styles.categoryDesc, { color: colors.textGray }]} numberOfLines={2}>
                          {cat.description || `Shop items from ${catName} stores`}
                        </Text>
                      </View>

                      <ChevronRight size={18} color={colors.textLight} />
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={[styles.emptyTitle, { color: colors.textDark }]}>
                    No categories found
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textGray }]}>
                    Try searching with another keyword or tap reload.
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                    onPress={loadBackendCategories}
                  >
                    <RefreshCw size={14} color="#FFFFFF" />
                    <Text style={styles.retryBtnText}>Reload from Server</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: '82%',
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl + 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm + 2,
  },
  headerTextCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.md + 1, 0.35),
  },
  sheetSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    padding: 0,
  },
  loadingBox: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  scrollList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  categoryIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 1,
  },
  categoryThumb: {
    width: 46,
    height: 38,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
  },
  categoryInfoCol: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  categoryName: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    marginBottom: 2,
  },
  categoryDesc: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(10, 0.2),
    lineHeight: 14,
  },
  emptyBox: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.sm, 0.2),
    marginBottom: 2,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    marginTop: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
  },
});
