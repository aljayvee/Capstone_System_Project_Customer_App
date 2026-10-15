import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, RotateCw, Store } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import type { Establishment } from '../../services/establishments';
import ShimmerWave from '../ShimmerWave';
import { StoreCard } from './StoreCard';
import {
  BorderRadius,
  FontFamily,
  PortalFontSizeMultipliers,
  PortalFontSizes,
  PortalTouchTargets,
  Spacing,
  getPortalLineHeight,
  scaledPortalFontSize,
} from '../../config/theme';

type RowStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/** A store card's width in dp, the same on every phone. */
export const STORE_CARD_WIDTH = 150;

export interface StoreCardRowProps {
  title: string;
  /** The icon beside the title. */
  Icon: any;
  /** Section test ids: `<prefix>`, `<prefix>-see-all`, `-loading`, `-error`, `-empty`, `-list`, `-see-all-card`. */
  testID: string;
  /** Card test ids (StoreCard's `testIDPrefix`). */
  cardTestIDPrefix: string;
  items: Establishment[];
  status: RowStatus;
  onRetry: () => void;
  onStorePress: (store: Establishment) => void;
  onSeeAll: () => void;
  /** The last card of the row, and the header See all link's label. */
  seeAll: { title: string; body: string; Icon: any; accessibilityLabel: string };
  errorMessage: string;
  /** The empty state's message and action; the action defaults to See all. */
  empty: { message: string; actionLabel: string; ActionIcon: any; onPress?: () => void };
  categoryImages: Record<number, string>;
  contentWidth: number;
  showRating?: boolean;
  /** At most this many cards before the See all card. */
  maxCards?: number;
  /** What tapping a card does, for a screen reader (StoreCard `actionLabel`). */
  cardActionLabel?: string;
}

/**
 * A Home tab row of store cards that scrolls sideways, as foodpanda lists
 * shops: a header with a "See all >" link, the cards, and a "See all" card at the end.
 * "Stores near you" and "Popular Stores" are both this, with their own data.
 *
 * Every state spans the column instead of scrolling: shimmer cards while
 * loading, a message with Try again on error, and an empty message that still
 * offers the See all action.
 */
export function StoreCardRow({
  title,
  Icon,
  testID,
  cardTestIDPrefix,
  items,
  status,
  onRetry,
  onStorePress,
  onSeeAll,
  seeAll,
  errorMessage,
  empty,
  categoryImages,
  contentWidth,
  showRating = false,
  maxCards,
  cardActionLabel,
}: StoreCardRowProps) {
  const { colors, isDark } = useThemeColor();

  // A fixed width, as foodpanda's cards are (2026-10-13): two and a bit on a
  // 360 dp phone, so the row plainly continues sideways, and more on a bigger
  // one. It was 58% of the column, so every phone showed the same 1.7 cards,
  // only larger on a larger screen. contentWidth only caps it on tiny screens.
  const cardWidth = Math.round(Math.min(STORE_CARD_WIDTH, contentWidth * 0.58));
  const imageHeight = Math.round(cardWidth * 0.5);
  const shown = maxCards ? items.slice(0, maxCards) : items;
  const isLoading = (status === 'idle' || status === 'loading') && items.length === 0;

  const panel = (id: string, message: string, action: { label: string; onPress: () => void; Icon: any }) => (
    <View
      style={[styles.panel, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB' }]}
      testID={id}
    >
      <Store size={20} color={colors.textLight} />
      <Text style={[styles.panelText, { color: colors.textGray }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.body}>
        {message}
      </Text>
      <TouchableOpacity
        style={[styles.panelBtn, { borderColor: colors.primary }]}
        onPress={action.onPress}
        hitSlop={PortalTouchTargets.compactHitSlop}
        accessibilityRole="button"
        testID={`${id}-action`}
      >
        <action.Icon size={14} color={colors.primary} />
        <Text style={[styles.panelBtnText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
          {action.label}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon size={16} color={colors.primary} />
          <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.subheading}>
            {title}
          </Text>
        </View>
        {/* Says what it does (2026-10-13): a bare arrow read as decoration. */}
        <TouchableOpacity
          style={styles.seeAllLink}
          onPress={onSeeAll}
          hitSlop={PortalTouchTargets.compactHitSlop}
          accessibilityRole="button"
          accessibilityLabel={seeAll.accessibilityLabel}
          testID={`${testID}-see-all`}
        >
          <Text style={[styles.seeAllLinkText, { color: colors.primary }]} maxFontSizeMultiplier={PortalFontSizeMultipliers.button}>
            See all
          </Text>
          <ChevronRight size={18} color={colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={styles.bleed}
          contentContainerStyle={styles.row}
          testID={`${testID}-loading`}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.shimmerCard, { width: cardWidth }]}
            >
              <ShimmerWave width={cardWidth} height={imageHeight} borderRadius={BorderRadius.lg} />
              <View style={styles.shimmerBody}>
                <ShimmerWave height={14} width="75%" borderRadius={BorderRadius.sm} />
                <ShimmerWave height={11} width="50%" borderRadius={BorderRadius.sm} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : status === 'error' ? (
        panel(`${testID}-error`, errorMessage, { label: 'Try again', onPress: onRetry, Icon: RotateCw })
      ) : items.length === 0 ? (
        panel(`${testID}-empty`, empty.message, {
          label: empty.actionLabel,
          onPress: empty.onPress ?? onSeeAll,
          Icon: empty.ActionIcon,
        })
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.row}
          testID={`${testID}-list`}
        >
          {shown.map((store) => (
            <StoreCard
              key={store.key}
              store={store}
              onPress={onStorePress}
              categoryImages={categoryImages}
              width={cardWidth}
              imageHeight={imageHeight}
              testIDPrefix={cardTestIDPrefix}
              showRating={showRating}
              actionLabel={cardActionLabel}
            />
          ))}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.seeAllCard, { width: cardWidth }]}
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel={`${seeAll.title}. ${seeAll.body}`}
            testID={`${testID}-see-all-card`}
          >
            <View
              style={[
                styles.seeAllBanner,
                {
                  height: imageHeight,
                  backgroundColor: isDark ? 'rgba(246, 36, 89, 0.10)' : '#FFF5F7',
                },
              ]}
            >
              <View style={[styles.seeAllIcon, { backgroundColor: colors.primary }]}>
                <seeAll.Icon size={18} color="#FFFFFF" strokeWidth={2.6} />
              </View>
            </View>
            <View style={styles.seeAllMeta}>
              <Text style={[styles.seeAllTitle, { color: colors.primary }]} numberOfLines={1} maxFontSizeMultiplier={PortalFontSizeMultipliers.card}>
                {seeAll.title}
              </Text>
              <Text style={[styles.seeAllBody, { color: colors.textGray }]} numberOfLines={2} maxFontSizeMultiplier={PortalFontSizeMultipliers.caption}>
                {seeAll.body}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.subheading),
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'),
  },
  seeAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: PortalTouchTargets.compact,
  },
  seeAllLinkText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption + 1),
  },
  // Runs to the screen edges, as foodpanda's rows do, while the first item
  // still lines up with everything above it.
  bleed: {
    marginHorizontal: -Spacing.md,
  },
  row: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 4,
    gap: Spacing.sm + 2,
  },
  shimmerCard: {
    // Unboxed loading skeleton
  },
  shimmerBody: {
    paddingTop: Spacing.xs + 2,
    paddingBottom: 2,
    gap: 6,
  },
  seeAllCard: {
    // Unboxed See All item matching StoreCard layout
  },
  seeAllBanner: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllMeta: {
    paddingTop: Spacing.xs + 2,
    paddingBottom: 2,
    gap: 2,
  },
  seeAllIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    lineHeight: getPortalLineHeight(PortalFontSizes.body, 'heading'),
  },
  seeAllBody: {
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.35),
  },
  panel: {
    alignItems: 'center',
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  panelText: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    lineHeight: getPortalLineHeight(PortalFontSizes.caption, 1.4),
  },
  panelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    minHeight: PortalTouchTargets.pillHeight,
  },
  panelBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
  },
});
