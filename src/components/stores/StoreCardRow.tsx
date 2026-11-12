import { usePageLayout } from '../../hooks/usePageLayout';
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

/** A compact Home store card's maximum width in dp. */
export const STORE_CARD_WIDTH = 160;

export interface StoreCardRowProps {
  title: string;
  /** The icon beside the title. */
  Icon: any;
  /** Section test ids: `<prefix>`, `<prefix>-see-all`, `-loading`, `-error`, `-empty`, `-list`. */
  testID: string;
  /** Card test ids (StoreCard's `testIDPrefix`). */
  cardTestIDPrefix: string;
  items: Establishment[];
  status: RowStatus;
  onRetry: () => void;
  onStorePress: (store: Establishment) => void;
  onSeeAll: () => void;
  /** The header See all link's label. */
  seeAll: { title: string; body: string; Icon: any; accessibilityLabel: string };
  errorMessage: string;
  /** The empty state's message and action; the action defaults to See all. */
  empty: { message: string; actionLabel: string; ActionIcon: any; onPress?: () => void };
  categoryImages: Record<number, string>;
  contentWidth: number;
  showRating?: boolean;
  /** At most this many store cards. */
  maxCards?: number;
  /** What tapping a card does, for a screen reader (StoreCard `actionLabel`). */
  cardActionLabel?: string;
}

/**
 * A Home tab row of store cards that scrolls sideways, as foodpanda lists
 * shops: a header with a "See all >" link and the store cards.
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
  const pageLayout = usePageLayout();
  const { colors } = useThemeColor();

  // Moderate 4:3 photos, with the next card still visible on narrow phones.
  const cardWidth = Math.round(Math.min(STORE_CARD_WIDTH, contentWidth * 0.68));
  const imageHeight = Math.round(cardWidth * 0.75);
  const shown = maxCards ? items.slice(0, maxCards) : items;
  const isLoading = (status === 'idle' || status === 'loading') && items.length === 0;

  const panel = (id: string, message: string, action: { label: string; onPress: () => void; Icon: any }) => (
    <View
      style={styles.panel}
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
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={[styles.bleed, pageLayout.bleedStyle]}
          contentContainerStyle={[styles.row, pageLayout.gutterStyle]}
          testID={`${testID}-loading`}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.shimmerCard, { width: cardWidth }]}
            >
              <ShimmerWave width={cardWidth} height={imageHeight} borderRadius={BorderRadius.lg} />
              <View style={styles.shimmerBody}>
                <ShimmerWave height={11} width="85%" borderRadius={BorderRadius.sm} />
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
          style={[styles.bleed, pageLayout.bleedStyle]}
          contentContainerStyle={[styles.row, pageLayout.gutterStyle]}
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
              presentation="photo-overlay"
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
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
    fontSize: scaledPortalFontSize(PortalFontSizes.micro),
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
  panel: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
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
