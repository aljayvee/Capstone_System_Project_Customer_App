import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, CheckCircle } from 'lucide-react-native';
import TrueBottomSheet from './transitions/TrueBottomSheet';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, FontFamily, Spacing, BorderRadius, useResponsive, MAX_CONTENT_WIDTH, moderateScale } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';

interface RatingModalProps {
  visible: boolean;
  errandId: string;
  /** Which errand this is (stores and reference), for a customer with more than one. */
  summary?: string | null;
  onDone: (outcome: 'rated' | 'skipped') => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({ visible, errandId, summary, onDone }) => {
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  // Keyboard-safe (2026-11-06). TrueBottomSheet already lifts the sheet onto
  // the keyboard; what was left is a sheet too tall for the room above it.
  // With a big keyboard and larger text, the sheet was squeezed and its bottom
  // (the comment field, then the buttons) clipped out of reach. Now:
  // - the content scrolls when it does not fit, rather than being cut off;
  // - the focused field is scrolled into view as the room shrinks;
  // - the nav-bar padding is dropped while the keyboard covers the nav bar;
  // - the comment field stops growing at a few lines and scrolls inside.
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const scrollRef = useRef<ScrollView>(null);
  const commentFocusedRef = useRef(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStars(0);
    setComment('');
    setSubmitted(false);
    setError(null);
  };

  const handleSkip = () => {
    reset();
    onDone('skipped');
  };

  const keepCommentInView = () => {
    if (commentFocusedRef.current) scrollRef.current?.scrollToEnd({ animated: false });
  };

  const handleSubmit = async () => {
    if (stars < 1) {
      setError('Tap a star to rate this errand.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/errands/${errandId}/rating`, { stars, comment: comment.trim() || undefined });
      setSubmitted(true);
      setTimeout(() => {
        reset();
        onDone('rated');
      }, 1400);
    } catch (err) {
      setError(toUserMessage(err, 'errand'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TrueBottomSheet visible={visible} onClose={handleSkip}>
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <ScrollView
          ref={scrollRef}
          testID="rating-scroll"
          bounces={false}
          showsVerticalScrollIndicator={false}
          // A tap on Submit while the keyboard is up must submit, not only
          // close the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // The room shrinking under the keyboard, or the comment growing a
          // line: either way the field being typed in stays in view.
          onLayout={keepCommentInView}
          onContentSizeChange={keepCommentInView}
          contentContainerStyle={[
            styles.sheetContent,
            {
              // Room for the nav bar while it shows; the keyboard covers it.
              paddingBottom: keyboardVisible ? Spacing.md : Math.max(Spacing.huge, insets.bottom + Spacing.md),
            },
          ]}
        >
        {submitted ? (
          <View style={styles.successBox} testID="rating-success">
            <CheckCircle size={40} color={colors.success} strokeWidth={2} />
            <Text style={[styles.successText, { color: colors.success }]} maxFontSizeMultiplier={1.25}>Thank you for your feedback!</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>How was your errand?</Text>
            <Text style={[styles.subtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>Rate your rider's service for this delivery.</Text>
            {summary ? (
              <Text
                testID="rating-errand-summary"
                style={[styles.summary, { color: colors.textMedium }]}
                maxFontSizeMultiplier={1.2}
                numberOfLines={2}
              >
                {summary}
              </Text>
            ) : null}

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} testID={`rating-star-${n}`} onPress={() => setStars(n)} hitSlop={8}>
                  <Star
                    size={moderateScale(34, 0.3)}
                    color={n <= stars ? '#F59E0B' : colors.border}
                    fill={n <= stars ? '#F59E0B' : 'none'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              testID="rating-comment"
              maxFontSizeMultiplier={1.25}
              style={[styles.commentInput, { backgroundColor: colors.bgGray, color: colors.textDark, borderColor: colors.border }]}
              placeholder="Optional comment about the delivery..."
              placeholderTextColor={colors.textLight}
              value={comment}
              onChangeText={setComment}
              onFocus={() => {
                commentFocusedRef.current = true;
                keepCommentInView();
              }}
              onBlur={() => {
                commentFocusedRef.current = false;
              }}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            {error ? <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity
                testID="rating-skip"
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={handleSkip}
                disabled={isSubmitting}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textMedium }]} maxFontSizeMultiplier={1.2}>
                  Skip for now
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="rating-submit"
                style={[styles.primaryBtn, { backgroundColor: stars === 0 || isSubmitting ? colors.border : colors.primary }]}
                onPress={handleSubmit}
                disabled={stars === 0 || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.2}>
                    Submit Feedback
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
        </ScrollView>
      </View>
    </TrueBottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
    // Shrinks with TrueBottomSheet's sheet when the keyboard leaves too little
    // room, so the ScrollView inside gets a bounded height and scrolls.
    flexShrink: 1,
  },
  sheetContent: {
    padding: Spacing.xl,
  },
  summary: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'),
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.caption),
    textAlign: 'center',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.title), 'heading'), fontSize: scaledPortalFontSize(PortalFontSizes.title), fontFamily: FontFamily.bold, textAlign: 'center' },
  subtitle: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.caption), 'label'), fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.caption), textAlign: 'center', marginTop: 3, marginBottom: Spacing.md },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm + 4, marginBottom: Spacing.md },
  commentInput: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    fontFamily: FontFamily.regular,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    minHeight: 60,
    // A long comment scrolls inside the field instead of pushing the buttons
    // down under the keyboard.
    maxHeight: moderateScale(120, 0.2),
    textAlignVertical: 'top',
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    marginBottom: Spacing.xs,
  },
  errorText: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'), fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.body), marginBottom: Spacing.xs, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  secondaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  secondaryBtnText: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'), fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  primaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  primaryBtnText: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'), color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  successBox: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  successText: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'), fontSize: scaledPortalFontSize(PortalFontSizes.body), fontFamily: FontFamily.bold },
});
