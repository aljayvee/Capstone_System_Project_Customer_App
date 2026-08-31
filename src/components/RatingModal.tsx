import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Star, CheckCircle } from 'lucide-react-native';
import { apiClient } from '../services/apiClient';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius, useResponsive, MAX_CONTENT_WIDTH, scaledFontSize, moderateScale } from '../config/theme';

interface RatingModalProps {
  visible: boolean;
  errandId: string;
  onDone: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({ visible, errandId, onDone }) => {
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
      setError('Please select at least 1 star.');
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
      const message = err instanceof Error ? err.message : 'Could not submit your rating. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {submitted ? (
            <View style={styles.successBox} testID="rating-success">
              <CheckCircle size={40} color={Colors.success} strokeWidth={2} />
              <Text style={styles.successText} maxFontSizeMultiplier={1.25}>Thank you for your feedback!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title} maxFontSizeMultiplier={1.25}>How was your errand?</Text>
              <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>Rate your rider's service for this delivery.</Text>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} testID={`rating-star-${n}`} onPress={() => setStars(n)} hitSlop={8}>
                    <Star
                      size={moderateScale(34, 0.3)}
                      color={n <= stars ? '#F59E0B' : Colors.border}
                      fill={n <= stars ? '#F59E0B' : 'transparent'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment (optional)"
                placeholderTextColor={Colors.textLight}
                value={comment}
                onChangeText={setComment}
                multiline
                testID="rating-comment-input"
              />

              {error && <Text style={styles.errorText} maxFontSizeMultiplier={1.2}>{error}</Text>}

              <View style={styles.actions}>
                <TouchableOpacity testID="rating-skip" style={styles.secondaryBtn} onPress={handleSkip} disabled={isSubmitting}>
                  <Text style={styles.secondaryBtnText} maxFontSizeMultiplier={1.2}>Skip for now</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="rating-submit" style={styles.primaryBtn} onPress={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color={Colors.textWhite} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.2}>Submit Feedback</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgWhite,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: scaledFontSize(FontSizes.lg, 0.2), fontWeight: FontWeights.bold, color: Colors.textDark, textAlign: 'center' },
  subtitle: { fontSize: scaledFontSize(FontSizes.xs, 0.2), color: Colors.textGray, textAlign: 'center', marginTop: 3, marginBottom: Spacing.md },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm + 4, marginBottom: Spacing.md },
  commentInput: {
    backgroundColor: Colors.bgGray,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: scaledFontSize(FontSizes.xs + 1, 0.2),
    color: Colors.textDark,
    marginBottom: Spacing.xs,
  },
  errorText: { color: Colors.danger, fontSize: scaledFontSize(FontSizes.xs, 0.2), marginBottom: Spacing.xs, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  secondaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  secondaryBtnText: { color: Colors.textMedium, fontWeight: FontWeights.semibold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  primaryBtn: {
    flex: 1,
    paddingVertical: moderateScale(10, 0.2),
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    minHeight: moderateScale(46, 0.2),
    justifyContent: 'center',
  },
  primaryBtnText: { color: Colors.textWhite, fontWeight: FontWeights.bold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  successBox: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  successText: { fontSize: scaledFontSize(FontSizes.md, 0.2), fontWeight: FontWeights.bold, color: Colors.success },
});
