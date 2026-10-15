import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ImageBackground,
  Vibration,
  LayoutAnimation,
  Platform,
  UIManager,
  GestureResponderEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Store,
  Pill,
  ShoppingBag,
  Utensils,
  ShoppingBasket,
  Plus,
  MapPin,
  Sparkles,
  RotateCcw,
} from 'lucide-react-native';
import {
  BorderRadius,
  FontSizes,
  Spacing,
  FontFamily,
  Shadows,
  scaledFontSize,
  moderateScale,
  PortalFontSizes,
  scaledPortalFontSize,
  getPortalLineHeight,
  PortalTouchTargets,
  PortalFontSizeMultipliers,
} from '../config/theme';
import { BackendMerchantCategory } from '../services/merchantCategories';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const STORAGE_KEY_BENTO_ORDER = '@sugo_customer_bento_order';

export interface CategoryButtonItem {
  id: string;
  label: string;
  categoryParam: string;
  Icon: any;
  iconColor: string;
  bgLight: string;
  imageUrl?: string;
  storeCount?: number;
  isPabiliService?: boolean;
  isSeeMore?: boolean;
}

export interface DraggableBentoMosaicProps {
  categories: BackendMerchantCategory[];
  categoryImages: Record<number, string>;
  pairSlotWidth: number;
  contentWidth: number;
  colors: any;
  isDark: boolean;
  onTilePress: (tile: CategoryButtonItem) => void;
  onSeeMorePress: () => void;
  onScrollLockChange?: (isLocked: boolean) => void;
}

/**
 * Visual defaults for a category tile
 */
export function getMerchantCategoryButtonMeta(catName: string, primaryColor: string) {
  const lower = String(catName || '').toLowerCase();

  if (lower.includes('supermarket') || lower.includes('grocery') || lower.includes('mall')) {
    return {
      aliasId: 'malls',
      label: 'Malls & Grocery',
      Icon: Store,
      iconColor: '#FFFFFF',
      bgLight: '#EFF6FF',
      imageUrl:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('pharmacy') || lower.includes('health') || lower.includes('med')) {
    return {
      aliasId: 'pharmacy',
      label: 'Pharmacy',
      Icon: Pill,
      iconColor: '#FFFFFF',
      bgLight: '#ECFDF5',
      imageUrl:
        'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('bakery') || lower.includes('bread') || lower.includes('pastr')) {
    return {
      aliasId: 'bakery',
      label: 'Bakery',
      Icon: ShoppingBag,
      iconColor: '#FFFFFF',
      bgLight: '#FEF3C7',
      imageUrl:
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe')) {
    return {
      aliasId: 'restaurant',
      label: 'Food & Dining',
      Icon: Utensils,
      iconColor: '#FFFFFF',
      bgLight: '#FEE2E2',
      imageUrl:
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
    };
  }
  if (lower.includes('retail') || lower.includes('merchandise') || lower.includes('goods')) {
    return {
      aliasId: 'retail',
      label: 'Retail & Goods',
      Icon: ShoppingBasket,
      iconColor: '#FFFFFF',
      bgLight: '#FFEEF3',
      imageUrl:
        'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    };
  }

  const displayLabel = catName.length > 12 ? catName.split(' ')[0] : catName;
  return {
    aliasId: catName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    label: displayLabel || 'Store',
    Icon: Store,
    iconColor: '#FFFFFF',
    bgLight: '#FFEEF3',
    imageUrl:
      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=400&q=80',
  };
}

const MAX_GRID_CATEGORIES = 5;

export default function DraggableBentoMosaic({
  categories: backendCategories,
  categoryImages,
  pairSlotWidth,
  contentWidth,
  colors,
  isDark,
  onTilePress,
  onSeeMorePress,
  onScrollLockChange,
}: DraggableBentoMosaicProps) {
  // Saved custom ordering of category IDs
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTile, setDraggedTile] = useState<CategoryButtonItem | null>(null);
  const [hoverSlotIndex, setHoverSlotIndex] = useState<number | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Refs for gesture handling
  const containerLayoutRef = useRef<{ pageX: number; pageY: number }>({ pageX: 0, pageY: 0 });
  const containerViewRef = useRef<View>(null);

  // Load saved custom order on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_BENTO_ORDER)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCustomOrder(parsed);
            }
          } catch {
            // ignore JSON parse error
          }
        }
      })
      .catch(() => {});
  }, []);

  // Build full list of active backend categories mapped to tile items
  const defaultCategoryTiles: CategoryButtonItem[] = useMemo(() => {
    return backendCategories
      .filter((c) => Boolean(c?.name && (c.status === 'Active' || !c.status)))
      .map((c) => {
        const meta = getMerchantCategoryButtonMeta(c.name, colors.primary);
        const ownerImage = typeof c.id === 'number' ? categoryImages[c.id] : undefined;

        return {
          id: meta.aliasId || `cat-${c.id ?? c.name}`,
          label: meta.label,
          categoryParam: c.name,
          Icon: meta.Icon,
          iconColor: meta.iconColor,
          bgLight: meta.bgLight,
          imageUrl: ownerImage || meta.imageUrl,
          storeCount: typeof c._count?.places === 'number' ? c._count.places : undefined,
        };
      });
  }, [backendCategories, categoryImages, colors.primary]);

  // Apply custom order if saved
  const sortedTiles: CategoryButtonItem[] = useMemo(() => {
    if (!customOrder || customOrder.length === 0) {
      return defaultCategoryTiles.slice(0, MAX_GRID_CATEGORIES);
    }

    const tileMap = new Map<string, CategoryButtonItem>();
    defaultCategoryTiles.forEach((t) => tileMap.set(t.id, t));

    const result: CategoryButtonItem[] = [];
    // First, append categories matching custom order
    customOrder.forEach((id) => {
      const found = tileMap.get(id);
      if (found) {
        result.push(found);
        tileMap.delete(id);
      }
    });

    // Then, append any remaining active categories not yet in custom order
    tileMap.forEach((t) => result.push(t));

    return result.slice(0, MAX_GRID_CATEGORIES);
  }, [defaultCategoryTiles, customOrder]);

  const isCustomized = Boolean(customOrder && customOrder.length > 0);

  // Reset order handler
  const handleResetOrder = useCallback(async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCustomOrder(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_BENTO_ORDER);
    } catch {
      // ignore
    }
  }, []);

  // Compute predictive tile arrangement when dragging
  const predictiveTiles = useMemo(() => {
    if (!isDragging || !draggedTile || hoverSlotIndex === null) {
      return sortedTiles;
    }

    const filtered = sortedTiles.filter((t) => t.id !== draggedTile.id);
    const targetIdx = Math.max(0, Math.min(hoverSlotIndex, filtered.length));

    // Place a placeholder entry for the ghost slot
    const ghostItem: CategoryButtonItem = {
      ...draggedTile,
      id: `__ghost__${draggedTile.id}`,
    };

    const reordered = [...filtered];
    reordered.splice(targetIdx, 0, ghostItem);
    return reordered;
  }, [sortedTiles, isDragging, draggedTile, hoverSlotIndex]);

  // Dimensions & slot coordinate calculation
  const TALL_HEIGHT = moderateScale(190, 0.2);
  const GAP = Spacing.md;
  const colWidth = (contentWidth - GAP) / 2;
  const HALF_HEIGHT = (TALL_HEIGHT - GAP) / 2;
  const WIDE_HEIGHT = moderateScale(90, 0.2);
  const ROW2_Y = TALL_HEIGHT + GAP;

  // Center points of the 5 bento slots inside the mosaic
  const slotCenters = useMemo(() => {
    return [
      // Slot 0: Tall (col 0, top)
      { index: 0, x: colWidth / 2, y: TALL_HEIGHT / 2, variant: 'tall' as const },
      // Slot 1: Half top (col 1, top)
      { index: 1, x: colWidth + GAP + colWidth / 2, y: HALF_HEIGHT / 2, variant: 'half' as const },
      // Slot 2: Half bottom (col 1, bottom)
      {
        index: 2,
        x: colWidth + GAP + colWidth / 2,
        y: HALF_HEIGHT + GAP + HALF_HEIGHT / 2,
        variant: 'half' as const,
      },
      // Slot 3: Wide left (col 0, row 2)
      { index: 3, x: colWidth / 2, y: ROW2_Y + WIDE_HEIGHT / 2, variant: 'wide' as const },
      // Slot 4: Wide right (col 1, row 2)
      {
        index: 4,
        x: colWidth + GAP + colWidth / 2,
        y: ROW2_Y + WIDE_HEIGHT / 2,
        variant: 'wide' as const,
      },
    ];
  }, [colWidth, TALL_HEIGHT, HALF_HEIGHT, WIDE_HEIGHT, ROW2_Y, GAP]);

  // Find target slot closest to current touch coordinate
  const calculateHoverSlot = useCallback(
    (relX: number, relY: number): number => {
      const maxSlots = Math.min(sortedTiles.length, 5);
      let closestSlot = 0;
      let minDistance = Infinity;

      for (let i = 0; i < maxSlots; i++) {
        const slot = slotCenters[i];
        const dist = (relX - slot.x) ** 2 + (relY - slot.y) ** 2;
        if (dist < minDistance) {
          minDistance = dist;
          closestSlot = i;
        }
      }

      return closestSlot;
    },
    [slotCenters, sortedTiles.length]
  );

  // Initiate drag mode after 320ms long-press
  const startDrag = useCallback(
    (tile: CategoryButtonItem, initialIndex: number, pageX: number, pageY: number) => {
      Vibration.vibrate(35);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setIsDragging(true);
      setDraggedTile(tile);
      setHoverSlotIndex(initialIndex);

      const relX = pageX - containerLayoutRef.current.pageX;
      const relY = pageY - containerLayoutRef.current.pageY;
      setTouchPos({ x: relX, y: relY });

      if (onScrollLockChange) {
        onScrollLockChange(true);
      }
    },
    [onScrollLockChange]
  );

  // Touch Handlers for drag tracking
  const handleTouchMove = (e: GestureResponderEvent) => {
    if (!isDragging) return;

    const { pageX, pageY } = e.nativeEvent;
    const relX = pageX - containerLayoutRef.current.pageX;
    const relY = pageY - containerLayoutRef.current.pageY;
    setTouchPos({ x: relX, y: relY });

    const newHover = calculateHoverSlot(relX, relY);
    if (newHover !== hoverSlotIndex) {
      LayoutAnimation.configureNext({
        duration: 200,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });
      setHoverSlotIndex(newHover);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging || !draggedTile || hoverSlotIndex === null) {
      setIsDragging(false);
      setDraggedTile(null);
      setHoverSlotIndex(null);
      if (onScrollLockChange) {
        onScrollLockChange(false);
      }
      return;
    }

    Vibration.vibrate(20);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const filtered = sortedTiles.filter((t) => t.id !== draggedTile.id);
    const targetIdx = Math.max(0, Math.min(hoverSlotIndex, filtered.length));
    const finalTiles = [...filtered];
    finalTiles.splice(targetIdx, 0, draggedTile);

    const newOrderIds = finalTiles.map((t) => t.id);
    setCustomOrder(newOrderIds);

    setIsDragging(false);
    setDraggedTile(null);
    setHoverSlotIndex(null);

    if (onScrollLockChange) {
      onScrollLockChange(false);
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY_BENTO_ORDER, JSON.stringify(newOrderIds));
    } catch {
      // ignore storage error
    }
  };

  // Render a Ghost Landing Slot placeholder showing the exact aspect ratio where the dragged item will land
  const renderGhostSlot = (variant: 'tall' | 'half' | 'wide') => {
    return (
      <View
        key="__ghost_landing_slot__"
        style={[
          styles.tile,
          variant === 'tall' && styles.tileTall,
          variant === 'half' && styles.tileHalf,
          variant === 'wide' && styles.tileWide,
          styles.ghostSlot,
          {
            borderColor: colors.primary,
            backgroundColor: isDark ? 'rgba(255, 77, 121, 0.10)' : '#FFEEF3',
          },
        ]}
      >
        <View style={styles.ghostContent}>
          <Sparkles size={variant === 'half' ? 14 : 18} color={colors.primary} strokeWidth={2.4} />
          <Text
            style={[
              styles.ghostText,
              { color: colors.primary },
              variant === 'half' && styles.ghostTextHalf,
            ]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
          >
            Release to place
          </Text>
        </View>
      </View>
    );
  };

  // Render one category tile with touch gesture bindings
  const renderTile = (tile: CategoryButtonItem, variant: 'tall' | 'half' | 'wide', index: number) => {
    if (tile.id.startsWith('__ghost__')) {
      return renderGhostSlot(variant);
    }

    const { id, label, Icon, imageUrl, storeCount } = tile;
    const isTall = variant === 'tall';

    return (
      <TouchableOpacity
        key={id}
        activeOpacity={0.85}
        style={[
          styles.tile,
          variant === 'tall' && styles.tileTall,
          variant === 'half' && styles.tileHalf,
          variant === 'wide' && styles.tileWide,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' },
          !isDark && Shadows.soft,
        ]}
        testID={`category-btn-${id}`}
        accessibilityRole="button"
        accessibilityLabel={
          typeof storeCount === 'number'
            ? `${label}, ${storeCount} ${storeCount === 1 ? 'store' : 'stores'}`
            : label
        }
        onPress={() => {
          if (!isDragging) onTilePress(tile);
        }}
        delayLongPress={280}
        onLongPress={(e: GestureResponderEvent) => {
          const pageX = e?.nativeEvent?.pageX ?? 0;
          const pageY = e?.nativeEvent?.pageY ?? 0;
          if (containerViewRef.current?.measure) {
            containerViewRef.current.measure((_x, _y, _width, _height, pX, pY) => {
              if (typeof pX === 'number' && typeof pY === 'number') {
                containerLayoutRef.current = { pageX: pX, pageY: pY };
              }
            });
          }
          startDrag(tile, index, pageX, pageY);
        }}
      >
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.tileImage}
          imageStyle={styles.bentoImageStyle}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.80)']}
            locations={[0, 0.45, 1]}
            style={styles.bentoOverlay}
            pointerEvents="none"
          />

          <View style={[styles.tileIconBadge, isTall && styles.tileIconBadgeTall]}>
            <Icon size={isTall ? 17 : 15} color="#FFFFFF" strokeWidth={2.6} />
          </View>

          <View style={styles.tileFooter}>
            <Text
              style={[styles.tileLabel, isTall && styles.tileLabelTall]}
              numberOfLines={isTall ? 2 : 1}
              maxFontSizeMultiplier={isTall ? PortalFontSizeMultipliers.subheading : PortalFontSizeMultipliers.label}
            >
              {label}
            </Text>

            {typeof storeCount === 'number' && storeCount > 0 && (
              <View style={styles.tileCountRow}>
                <MapPin size={9} color="rgba(255,255,255,0.85)" strokeWidth={2.6} />
                <Text
                  style={styles.tileCountText}
                  numberOfLines={1}
                  maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
                >
                  {storeCount} {storeCount === 1 ? 'store' : 'stores'}
                </Text>
              </View>
            )}
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const displayTiles = predictiveTiles;

  return (
    <View
      ref={containerViewRef}
      style={styles.container}
      onLayout={() => {
        if (containerViewRef.current) {
          containerViewRef.current.measure((_x, _y, _width, _height, pX, pY) => {
            containerLayoutRef.current = { pageX: pX, pageY: pY };
          });
        }
      }}
    >
      {/* Informational edit hint / Reset control row */}
      {isDragging ? (
        <View
          style={[
            styles.dragHintBar,
            { backgroundColor: isDark ? 'rgba(255, 77, 121, 0.15)' : '#FFEEF3' },
          ]}
        >
          <Sparkles size={13} color={colors.primary} />
          <Text
            style={[styles.dragHintText, { color: colors.primary }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
          >
            Dragging {draggedTile?.label} • Hover any slot to preview layout
          </Text>
        </View>
      ) : isCustomized ? (
        <View style={styles.customizedRow}>
          <Text
            style={[styles.customizedBadgeText, { color: colors.textGray }]}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
          >
            Personalized layout
          </Text>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetOrder}
            hitSlop={PortalTouchTargets.compactHitSlop}
          >
            <RotateCcw size={11} color={colors.primary} />
            <Text
              style={[styles.resetBtnText, { color: colors.primary }]}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
            >
              Reset
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Bento Grid Structure */}
      <View style={styles.mosaic}>
        {/* Row 1: 1 Tall Hero beside 2 Stacked Half tiles */}
        {displayTiles.length >= 3 ? (
          <View style={styles.mosaicRow}>
            <View style={styles.mosaicTallSlot}>
              {renderTile(displayTiles[0], 'tall', 0)}
            </View>
            <View style={styles.mosaicStackSlot}>
              {renderTile(displayTiles[1], 'half', 1)}
              {renderTile(displayTiles[2], 'half', 2)}
            </View>
          </View>
        ) : (
          <View style={styles.mosaicRow}>
            {displayTiles.map((tile, i) => (
              <View key={tile.id} style={styles.mosaicEqualSlot}>
                {renderTile(tile, 'wide', i)}
              </View>
            ))}
          </View>
        )}

        {/* Row 2: Remaining tiles plus See More overflow tile, in pairs */}
        <View style={styles.pairRow}>
          {(displayTiles.length >= 3 ? displayTiles.slice(3) : []).map((tile, idx) => (
            <View key={tile.id} style={[styles.pairSlot, { width: pairSlotWidth }]}>
              {renderTile(tile, 'wide', 3 + idx)}
            </View>
          ))}

          {/* See More Tile (Fixed collection launcher) */}
          <View style={[styles.pairSlot, { width: pairSlotWidth }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.tile,
                styles.seeMoreTile,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFEEF3',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#FCE7ED',
                },
              ]}
              onPress={onSeeMorePress}
              testID="category-btn-see_more"
              accessibilityRole="button"
              accessibilityLabel="See all store categories"
            >
              <View
                style={[
                  styles.seeMoreIcon,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#FCE7ED' },
                ]}
              >
                <Plus size={17} color={colors.primary} strokeWidth={2.8} />
              </View>
              <Text
                style={[styles.seeMoreLabel, { color: colors.textDark }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                See More
              </Text>
              <Text
                style={[styles.seeMoreHint, { color: colors.textGray }]}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                All categories
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Active Drag Overlay: intercepts touch movement and release across the entire grid */}
      {isDragging && (
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 900 }]}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            setIsDragging(false);
            setDraggedTile(null);
            setHoverSlotIndex(null);
            if (onScrollLockChange) onScrollLockChange(false);
          }}
        />
      )}

      {/* Floating Card representing the tile actively being dragged */}
      {isDragging && draggedTile && (
        <View
          style={[
            styles.floatingDragCard,
            {
              left: Math.max(0, Math.min(touchPos.x - pairSlotWidth / 2, contentWidth - pairSlotWidth)),
              top: Math.max(0, touchPos.y - WIDE_HEIGHT / 2),
              width: pairSlotWidth,
              height: WIDE_HEIGHT,
              borderColor: colors.primary,
              backgroundColor: colors.card,
            },
            Shadows.liftedUp,
          ]}
          pointerEvents="none"
        >
          <ImageBackground
            source={{ uri: draggedTile.imageUrl }}
            style={styles.tileImage}
            imageStyle={styles.bentoImageStyle}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.45, 1]}
              style={styles.bentoOverlay}
              pointerEvents="none"
            />
            <View style={styles.tileIconBadge}>
              <draggedTile.Icon size={15} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            <View style={styles.tileFooter}>
              <Text
                style={styles.tileLabel}
                numberOfLines={1}
                maxFontSizeMultiplier={PortalFontSizeMultipliers.label}
              >
                {draggedTile.label}
              </Text>
            </View>
          </ImageBackground>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  dragHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs + 2,
    alignSelf: 'center',
  },
  dragHintText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    letterSpacing: 0.2,
  },
  customizedRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  customizedBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    minHeight: PortalTouchTargets.minTouchTarget,
  },
  resetBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  mosaic: {
    gap: Spacing.md,
  },
  mosaicRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  mosaicTallSlot: {
    flex: 1,
    height: moderateScale(190, 0.2),
  },
  mosaicStackSlot: {
    flex: 1,
    height: moderateScale(190, 0.2),
    gap: Spacing.md,
  },
  mosaicEqualSlot: {
    flex: 1,
    height: moderateScale(95, 0.2),
  },
  pairRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  pairSlot: {
    height: moderateScale(90, 0.2),
  },
  tile: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  tileTall: {
    flex: 1,
  },
  tileHalf: {
    flex: 1,
  },
  tileWide: {
    flex: 1,
  },
  tileImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  tileIconBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  tileIconBadgeTall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  tileFooter: {
    padding: 7,
  },
  tileLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'heading'),
    color: '#FFFFFF',
  },
  tileLabelTall: {
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(PortalFontSizes.subheading, 'heading'),
  },
  tileCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  tileCountText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    color: 'rgba(255,255,255,0.92)',
  },
  seeMoreTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    height: '100%',
    minHeight: PortalTouchTargets.buttonHeight,
  },
  seeMoreIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  seeMoreLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'heading'),
  },
  seeMoreHint: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
    marginTop: 1,
  },
  ghostSlot: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  ghostText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 'label'),
    letterSpacing: 0.3,
  },
  ghostTextHalf: {
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 'label'),
  },
  floatingDragCard: {
    position: 'absolute',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    zIndex: 9999,
    transform: [{ scale: 1.05 }],
    elevation: 14,
  },
  bentoImageStyle: {
    resizeMode: 'cover',
  },
  bentoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
