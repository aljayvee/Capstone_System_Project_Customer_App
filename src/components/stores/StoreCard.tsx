import React from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, type DimensionValue } from 'react-native';
import { Check, Plus, Star } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { storeDistanceLabel, storePhotoSource, type Establishment } from '../../services/establishments';
import { getCategoryIcon } from '../../constants/pabili';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../../config/theme';

/**
 * One store item (unboxed): rounded photo on top, then name, category and
 * distance (in green), then address. Shared by Home's "Popular Stores" and
 * "Stores near you" rows, the Popular Stores screen, Stores near you screen,
 * Merchant Category Stores screen, and the Find stores list, so a store looks
 * the same wherever it is.
 *
 * `selectable` (where up to 3 stores are picked) adds a pick mark beside the
 * name, a plus or a tick; the item then picks instead of starting an order.
 *
 * Test ids hang off `testIDPrefix`: `<prefix>-<key>` for the item, and
 * `<prefix>-photo|category-photo|icon|distance|rating|ordered-before|pick-<key>`
 * inside it.
 */
export interface StoreCardProps {
  store: Establishment;
  onPress: (store: Establishment) => void;
  /** Owner-set category photos by category id: the fallback when a shop has no photo of its own. */
  categoryImages: Record<number, string>;
  /** Fallback category id when `store.categoryId` is null (e.g. inside a merchant category screen). */
  fallbackCategoryId?: number | null;
  /** Fallback category name when `store.categoryName` is null. */
  fallbackCategoryName?: string;
  width: DimensionValue;
  imageHeight: number;
  testIDPrefix: string;
  /** Google's star rating on the photo: the popular lists, where it is the reason for the order. */
  showRating?: boolean;
  /** The item picks the store (up to 3) instead of starting an order: it shows a pick mark. */
  selectable?: boolean;
  /** Picked: primary name highlight and a tick. */
  selected?: boolean;
  /** What a tap does, for a screen reader, when it is not picking (Home's rows). */
  actionLabel?: string;
}

export function StoreCard({
  store,
  onPress,
  categoryImages,
  fallbackCategoryId = null,
  fallbackCategoryName,
  width,
  imageHeight,
  testIDPrefix,
  showRating = false,
  selectable = false,
  selected = false,
  actionLabel = 'Start an order here',
}: StoreCardProps) {
  const { colors, isDark } = useThemeColor();
  const isClosed = store.isOpen === false;
  const closedNotice = isClosed ? (store.closedReason?.trim() || 'Temporarily Unavailable') : null;
  const category = store.categoryName ?? fallbackCategoryName ?? 'Store';
  const distance = storeDistanceLabel(store.distanceMeters);
  const rating = showRating ? ratingLabel(store) : null;
  const action = isClosed
    ? closedNotice!
    : !selectable
    ? actionLabel
    : selected
    ? 'Picked. Tap to remove it'
    : 'Tap to pick it';

  return (
    <TouchableOpacity
      activeOpacity={isClosed ? 1 : 0.85}
      disabled={isClosed || undefined}
      style={[styles.card, { width }, isClosed ? styles.cardClosed : null]}
      onPress={() => {
        if (!isClosed) onPress(store);
      }}
      accessibilityRole="button"
      accessibilityState={
        selectable || isClosed
          ? {
              ...(selectable ? { selected } : {}),
              ...(isClosed ? { disabled: true } : {}),
            }
          : undefined
      }
      accessibilityLabel={`${store.name}, ${category}${distance ? `, ${distance} away` : ''}${
        rating ? `, rated ${rating.spoken}` : ''
      }${store.orderedBefore ? ', you ordered here before' : ''}. ${action}`}
      testID={`${testIDPrefix}-${store.key}`}
    >
      <StorePhoto
        store={store}
        categoryImages={categoryImages}
        fallbackCategoryId={fallbackCategoryId}
        fallbackCategoryName={fallbackCategoryName}
        height={imageHeight}
        testIDPrefix={testIDPrefix}
        rating={rating?.shown ?? null}
        isClosed={isClosed}
        closedNotice={closedNotice}
      />
      <View style={styles.body}>
        <View style={styles.bodyText}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.name,
                { color: isClosed ? colors.textGray : selected ? colors.primary : colors.textDark },
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={PortalFontSizeMultipliers.card}
            >
              {store.name}
            </Text>
            {store.isVerified ? (
              <View
                style={[
                  styles.verifiedBadge,
                  { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(5, 150, 105, 0.1)' },
                ]}
                testID={`${testIDPrefix}-verified-${store.key}`}
              >
                <Check size={9} color={isDark ? '#34D399' : '#059669'} strokeWidth={2.8} />
                <Text style={[styles.verifiedText, { color: isDark ? '#34D399' : '#059669' }]}>
                  VERIFIED
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.detail, { color: isClosed ? colors.textLight : colors.textGray }]}
            numberOfLines={1}
            maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}
          >
            {category}
            {distance ? (
              <>
                {' · '}
                <Text
                  style={[styles.distance, { color: isClosed ? colors.textLight : colors.success }]}
                  testID={`${testIDPrefix}-distance-${store.key}`}
                >
                  {distance}
                </Text>
              </>
            ) : null}
          </Text>
          {store.address ? (
            <Text style={[styles.address, { color: colors.textLight }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
              {store.address}
            </Text>
          ) : null}
        </View>
        {selectable && !isClosed ? (
          <View
            style={[
              styles.pick,
              {
                backgroundColor: selected ? colors.primary : isDark ? 'rgba(255,255,255,0.06)' : colors.bgGray,
                borderColor: selected ? colors.primary : 'transparent',
              },
            ]}
            testID={`${testIDPrefix}-pick-${store.key}`}
          >
            {selected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : <Plus size={14} color={colors.textLight} strokeWidth={2.5} />}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** "4.6 (128)" on the photo, and "4.6 stars from 128 ratings" for a screen reader. Null when unrated. */
function ratingLabel(store: Establishment): { shown: string; spoken: string } | null {
  if (store.rating === null || store.rating === undefined) return null;
  const stars = store.rating.toFixed(1);
  const count = store.ratingCount ?? 0;
  return {
    shown: count > 0 ? `${stars} (${count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count})` : stars,
    spoken: `${stars} stars${count > 0 ? ` from ${count} ratings` : ''}`,
  };
}

/**
 * The top of a store item: the shop's own landscape storefront photo from
 * Google Maps, or the clean category icon when the shop has no photo of its own
 * (or when its photo fails to load). Never repeats the merchant category cover
 * image across individual stores.
 */
function StorePhoto({
  store,
  fallbackCategoryName,
  height,
  testIDPrefix,
  rating,
  isClosed,
  closedNotice,
}: {
  store: Establishment;
  categoryImages?: Record<number, string>;
  fallbackCategoryId?: number | null;
  fallbackCategoryName?: string;
  height: number;
  testIDPrefix: string;
  rating: string | null;
  isClosed: boolean;
  closedNotice: string | null;
}) {
  const { colors, isDark } = useThemeColor();
  const [failedOwn, setFailedOwn] = React.useState(false);

  const own = failedOwn ? null : storePhotoSource(store);
  const overlays = (
    <>
      {store.orderedBefore ? <OrderedBeforeChip testID={`${testIDPrefix}-ordered-before-${store.key}`} /> : null}
      {rating ? <RatingChip label={rating} testID={`${testIDPrefix}-rating-${store.key}`} /> : null}
      {isClosed ? (
        <View style={styles.closedOverlay} testID={`${testIDPrefix}-closed-overlay-${store.key}`}>
          <View style={styles.closedBadge} testID={`${testIDPrefix}-closed-badge-${store.key}`}>
            <Text style={styles.closedBadgeText} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
              {closedNotice ?? 'Temporarily Unavailable'}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );

  if (own) {
    return (
      <ImageBackground
        source={own}
        style={[styles.image, { height, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9' }]}
        resizeMode="cover"
        onError={() => setFailedOwn(true)}
        accessibilityIgnoresInvertColors
        testID={`${testIDPrefix}-photo-${store.key}`}
      >
        {/* Google requires a photo's author shown with it. */}
        {store.photoAttribution ? (
          <Text style={styles.credit} numberOfLines={1} maxFontSizeMultiplier={1}>
            {`Photo: ${store.photoAttribution}`}
          </Text>
        ) : null}
        {overlays}
      </ImageBackground>
    );
  }
  const Icon = getCategoryIcon(store.categoryName ?? fallbackCategoryName ?? store.name);
  return (
    <View
      style={[
        styles.image,
        styles.imageFallback,
        { height, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : isClosed ? '#E2E8F0' : '#FFF1F4' },
      ]}
      testID={`${testIDPrefix}-icon-${store.key}`}
    >
      <Icon size={30} color={isClosed ? colors.textLight : colors.primary} strokeWidth={2} />
      {overlays}
    </View>
  );
}

function OrderedBeforeChip({ testID }: { testID: string }) {
  return (
    <View style={[styles.chip, styles.chipLeft]} testID={testID}>
      <Text style={styles.chipText} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
        Ordered before
      </Text>
    </View>
  );
}

function RatingChip({ label, testID }: { label: string; testID: string }) {
  return (
    <View style={[styles.chip, styles.chipRight, styles.ratingChip]} testID={testID}>
      <Star size={11} color="#FBBF24" fill="#FBBF24" />
      <Text style={styles.chipText} maxFontSizeMultiplier={PortalFontSizeMultipliers.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // Strictly unboxed: no background card fill, no border, no drop shadow
  },
  cardClosed: {
    opacity: 0.72,
  },
  image: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(51, 65, 85, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '92%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  closedBadgeText: {
    color: '#F8FAFC',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    letterSpacing: 0.2,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs + 2,
    paddingBottom: 2,
  },
  bodyText: {
    flex: 1,
    minWidth: 0,
  },
  pick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'heading'),
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  verifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  detail: {
    fontFamily: FontFamily.medium,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
    marginTop: 2,
  },
  distance: {
    fontFamily: FontFamily.bold,
  },
  address: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
    lineHeight: getPortalLineHeight(PortalFontSizes.micro, 1.35),
    marginTop: 2,
  },
  // Status chips on the photo: the one place a full pill belongs.
  chip: {
    position: 'absolute',
    top: 8,
    backgroundColor: 'rgba(11, 19, 43, 0.82)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipLeft: {
    left: 8,
  },
  chipRight: {
    right: 8,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chipText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
  },
  credit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    maxWidth: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    color: '#FFFFFF',
    fontFamily: FontFamily.medium,
    fontSize: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderTopLeftRadius: 4,
  },
});
