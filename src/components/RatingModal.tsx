import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Star, CheckCircle } from 'lucide-react-native';
import TrueBottomSheet from './transitions/TrueBottomSheet';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import { FontSizes, FontWeights, Spacing, BorderRadius, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';
import { useThemeColor } from '../hooks/useThemeColor';

interface RatingModalProps {
  visible: boolean;
  errandId: string;
  onDone: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({ visible, errandId, onDone }) => {
  const { colors, isDark } = useThemeColor();
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
    onDone();
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
        onDone();
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
        {submitted ? (
          <View style={styles.successBox} testID="rating-success">
            <CheckCircle size={40} color={colors.success} strokeWidth={2} />
            <Text style={[styles.successText, { color: colors.success }]} maxFontSizeMultiplier={1.25}>Thank you for your feedback!</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>How was your errand?</Text>
            <Text style={[styles.subtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>Rate your rider's service for this delivery.</Text>

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
              style={[styles.commentInput, { backgroundColor: colors.bgGray, color: colors.textDark, borderColor: colors.border }]}
              placeholder="Optional comment about the delivery..."
              placeholderTextColor={colors.textLight}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
      </View>
    </TrueBottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: scaledFontSize(FontSizes.lg, 0.2), fontWeight: FontWeights.bold, textAlign: 'center' },
  subtitle: { fontSize: scaledFontSize(FontSizes.xs, 0.2), textAlign: 'center', marginTop: 3, marginBottom: Spacing.md },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm + 4, marginBottom: Spacing.md },
  commentInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
    marginBottom: Spacing.xs,
  },
  errorText: { fontSize: scaledFontSize(FontSizes.xs, 0.2), marginBottom: Spacing.xs, textAlign: 'center' },
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
  secondaryBtnText: { fontWeight: FontWeights.semibold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  primaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: FontWeights.bold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  successBox: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  successText: { fontSize: scaledFontSize(FontSizes.md, 0.2), fontWeight: FontWeights.bold },
});
