import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Switch,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  ChevronLeft,
  Star,
  Bug,
  Lightbulb,
  Truck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
} from 'lucide-react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';
import { useAuth } from '../context/AuthContext';
import { useThemeColor } from '../hooks/useThemeColor';
import {
  FontFamily,
  Spacing,
  BorderRadius,
  AuthFontSizeMultipliers,
  scaledFontSize,
} from '../config/theme';
import type { RootStackScreenProps } from '../navigation/types';

type FeedbackCategoryKey =
  | 'BUG_REPORT'
  | 'FEATURE_REQUEST'
  | 'DELIVERY_EXPERIENCE'
  | 'APP_USABILITY'
  | 'OTHER';

interface CategoryOption {
  key: FeedbackCategoryKey;
  label: string;
  icon: typeof Bug;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'BUG_REPORT', label: 'Bug Report', icon: Bug },
  { key: 'FEATURE_REQUEST', label: 'Feature Idea', icon: Lightbulb },
  { key: 'DELIVERY_EXPERIENCE', label: 'Rider & Delivery', icon: Truck },
  { key: 'APP_USABILITY', label: 'App Usability', icon: Smartphone },
  { key: 'OTHER', label: 'General', icon: MessageSquare },
];

const RATING_LABELS: Record<number, string> = {
  0: 'Tap a star to rate your experience',
  1: 'Poor · Needs urgent attention',
  2: 'Fair · Ran into problems',
  3: 'Average · Works, but can improve',
  4: 'Good · Satisfied with service',
  5: 'Excellent · Loved the experience!',
};

export default function FeedbackScreen({ navigation }: RootStackScreenProps<'Feedback'>) {
  const { user } = useAuth();
  const { colors, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState<FeedbackCategoryKey>('BUG_REPORT');
  const [rating, setRating] = useState<number>(0);
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>(user?.phone || '');
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successRefCode, setSuccessRefCode] = useState<string | null>(null);

  // Field focus states for crisp 1.5px border transitions
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const deviceModel = Device.modelName || Device.designName || Platform.OS;
  const osVersion = `${Platform.OS} ${Platform.Version}`;
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError(null);

    if (!rating || rating === 0) {
      setError('Please select a star rating for your experience.');
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject) {
      setError('Please provide a short summary of your feedback.');
      return;
    }
    if (trimmedSubject.length < 3) {
      setError('Subject must be at least 3 characters.');
      return;
    }
    if (!trimmedMessage) {
      setError('Please tell us a few details about your experience.');
      return;
    }
    if (trimmedMessage.length < 5) {
      setError('Description must be at least 5 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        category,
        rating,
        subject: trimmedSubject,
        message: trimmedMessage,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      };

      if (includeDiagnostics) {
        payload.deviceModel = deviceModel;
        payload.osVersion = osVersion;
        payload.platform = Platform.OS;
        payload.appVersion = appVersion;
      }

      const response = await apiClient.post('/feedback', payload);
      const data = response.data;
      setSuccessRefCode(data.refCode || 'FB-RECEIVED');
    } catch (err: any) {
      setError(toUserMessage(err, 'errand'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputBackground = isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';

  return (
    <View style={[styles.root, { backgroundColor: colors.bgApp }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: colors.card,
            borderBottomColor: cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
          testID="feedback-back-button"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
          Help & Feedback
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl + 24 }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={Spacing.xxl + 16}
      >
        {successRefCode ? (
          /* SUCCESS STATE */
          <View
            style={[styles.successCard, { backgroundColor: colors.card, borderColor: cardBorder }]}
            testID="feedback-success-card"
          >
            <View style={styles.successIconCircle}>
              <CheckCircle2 size={44} color="#10B981" strokeWidth={2.2} />
            </View>
            <Text style={[styles.successTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.25}>
              Feedback Submitted!
            </Text>
            <Text style={[styles.successSubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
              Thank you for helping us improve Sugo Express. Your review has been recorded and directly dispatched to our engineering team.
            </Text>

            <View style={[styles.ticketBadge, { backgroundColor: isDark ? 'rgba(246, 36, 89, 0.12)' : '#FEE2E2' }]}>
              <Text style={styles.ticketLabel}>REFERENCE TICKET</Text>
              <Text style={styles.ticketNumber}>{successRefCode}</Text>
            </View>

            <Text style={[styles.directDevNote, { color: colors.textLight }]} maxFontSizeMultiplier={1.15}>
              Your review has been directly dispatched to our engineering team.
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
              testID="feedback-done-button"
            >
              <Text style={styles.primaryButtonText} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* INPUT FORM */
          <>
            {/* INTRO HERO CARD */}
            <View style={[styles.introCard, { backgroundColor: colors.card, borderColor: cardBorder }]}>
              <View style={styles.introHeaderRow}>
                <View style={styles.sparkleIconBox}>
                  <Sparkles size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.introTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                    Your Voice Shapes Sugo
                  </Text>
                  <Text style={[styles.introBody, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
                    Found a glitch in Tacurong or have a feature idea? Our team reads every submission.
                  </Text>
                </View>
              </View>
            </View>

            {/* ERROR BANNER */}
            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2' }]}>
                <AlertCircle size={16} color={colors.danger} strokeWidth={2.4} />
                <Text style={[styles.errorBannerText, { color: colors.danger }]} maxFontSizeMultiplier={1.2}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/* CATEGORY SELECTOR */}
            <Text style={[styles.sectionHeading, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
              What is this regarding?
            </Text>
            <View style={styles.categoryWrap}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                const IconComponent = cat.icon;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    testID={`feedback-category-${cat.key}`}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected
                          ? isDark ? 'rgba(246,36,89,0.15)' : '#FEE2E2'
                          : inputBackground,
                        borderColor: isSelected ? colors.primary : cardBorder,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                    onPress={() => setCategory(cat.key)}
                    activeOpacity={0.8}
                  >
                    <IconComponent
                      size={15}
                      color={isSelected ? colors.primary : colors.textGray}
                      strokeWidth={2.2}
                    />
                    <Text
                      style={[
                        styles.categoryLabel,
                        {
                          color: isSelected ? colors.primary : colors.textDark,
                          fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
                        },
                      ]}
                      maxFontSizeMultiplier={AuthFontSizeMultipliers.label}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* STAR RATING */}
            <View style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: cardBorder }]}>
              <Text style={[styles.fieldLabel, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                Overall Experience Rating
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((num) => {
                  const isFilled = num <= rating;
                  return (
                    <TouchableOpacity
                      key={num}
                      testID={`feedback-star-${num}`}
                      style={styles.starHitBox}
                      onPress={() => setRating(num)}
                      hitSlop={8}
                    >
                      <Star
                        size={32}
                        color={isFilled ? '#F59E0B' : colors.border}
                        fill={isFilled ? '#F59E0B' : 'transparent'}
                        strokeWidth={1.8}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.ratingFeedbackText, { color: colors.textMedium }]} maxFontSizeMultiplier={1.15}>
                {RATING_LABELS[rating]}
              </Text>
            </View>

            {/* SUBJECT INPUT */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textDark }]} maxFontSizeMultiplier={1.15}>
                SUMMARY / SUBJECT *
              </Text>
              <View
                style={[
                  styles.textInputWrapper,
                  {
                    backgroundColor: inputBackground,
                    borderColor: focusedField === 'subject' ? colors.primary : cardBorder,
                    borderWidth: focusedField === 'subject' ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  testID="feedback-subject-input"
                  style={[styles.textInput, { color: colors.textDark }]}
                  placeholder="e.g. Map pin jumped to another street"
                  placeholderTextColor={colors.textLight}
                  value={subject}
                  onChangeText={setSubject}
                  maxLength={120}
                  onFocus={() => setFocusedField('subject')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* DESCRIPTION INPUT */}
            <View style={styles.inputGroup}>
              <View style={styles.labelWithCounterRow}>
                <Text style={[styles.inputLabel, { color: colors.textDark }]} maxFontSizeMultiplier={1.15}>
                  DETAILED FEEDBACK *
                </Text>
                <Text style={[styles.charCounter, { color: colors.textLight }]}>
                  {message.length} / 2000
                </Text>
              </View>
              <View
                style={[
                  styles.textAreaWrapper,
                  {
                    backgroundColor: inputBackground,
                    borderColor: focusedField === 'message' ? colors.primary : cardBorder,
                    borderWidth: focusedField === 'message' ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  testID="feedback-message-input"
                  style={[styles.textArea, { color: colors.textDark }]}
                  placeholder="Tell us what happened, steps to reproduce, or suggestions..."
                  placeholderTextColor={colors.textLight}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={5}
                  maxLength={2000}
                  textAlignVertical="top"
                  onFocus={() => setFocusedField('message')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* CONTACT DETAILS (OPTIONAL) */}
            <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: cardBorder }]}>
              <Text style={[styles.fieldLabel, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                Contact Information (Optional)
              </Text>
              <Text style={[styles.contactHint, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
                Provide your email if you would like developer follow-up regarding this review.
              </Text>

              <View
                style={[
                  styles.textInputWrapper,
                  {
                    backgroundColor: inputBackground,
                    borderColor: focusedField === 'email' ? colors.primary : cardBorder,
                    borderWidth: focusedField === 'email' ? 1.5 : 1,
                    marginTop: Spacing.sm,
                  },
                ]}
              >
                <TextInput
                  testID="feedback-email-input"
                  style={[styles.textInput, { color: colors.textDark }]}
                  placeholder="Email address (e.g. you@example.com)"
                  placeholderTextColor={colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* DIAGNOSTIC TELEMETRY CARD */}
            <View style={[styles.telemetryCard, { backgroundColor: colors.card, borderColor: cardBorder }]}>
              <View style={styles.telemetryRow}>
                <View style={{ flex: 1, paddingRight: Spacing.md }}>
                  <Text style={[styles.telemetryTitle, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
                    Include technical diagnostics
                  </Text>
                  <Text style={[styles.telemetrySubtitle, { color: colors.textGray }]} maxFontSizeMultiplier={1.15}>
                    Helps our engineering team identify and solve app issues faster.
                  </Text>
                </View>
                <Switch
                  testID="feedback-diagnostics-switch"
                  value={includeDiagnostics}
                  onValueChange={setIncludeDiagnostics}
                  trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              testID="feedback-submit-button"
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                submitting && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Submitting Review...</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText} maxFontSizeMultiplier={AuthFontSizeMultipliers.button}>
                  Submit Feedback
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(17, 0.2),
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  introCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md + 2,
    marginBottom: Spacing.lg,
  },
  introHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sparkleIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(246, 36, 89, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(15, 0.2),
    marginBottom: 2,
  },
  introBody: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(12.5, 0.2),
    lineHeight: 17,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontFamily: FontFamily.semibold,
    fontSize: scaledFontSize(12.5, 0.2),
    flex: 1,
  },
  sectionHeading: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(14, 0.2),
    marginBottom: Spacing.sm,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  categoryLabel: {
    fontSize: scaledFontSize(12, 0.2),
  },
  ratingCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(14, 0.2),
    marginBottom: Spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  starHitBox: {
    padding: 4,
  },
  ratingFeedbackText: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(12.5, 0.2),
    marginTop: Spacing.xs,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(11, 0.2),
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  labelWithCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCounter: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(11, 0.2),
  },
  textInputWrapper: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  textInput: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(14, 0.2),
    height: '100%',
  },
  textAreaWrapper: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 120,
    padding: Spacing.md,
  },
  textArea: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(14, 0.2),
    lineHeight: 20,
    height: 100,
  },
  contactCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  contactHint: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(12, 0.2),
    lineHeight: 16,
  },
  telemetryCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(13.5, 0.2),
    marginBottom: 2,
  },
  telemetrySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(11.5, 0.2),
    lineHeight: 15,
  },
  primaryButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(15, 0.2),
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  successCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(18, 0.2),
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(13, 0.2),
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  ticketBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ticketLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#DC2626',
    marginBottom: 2,
  },
  ticketNumber: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(16, 0.2),
    color: '#DC2626',
  },
  directDevNote: {
    fontFamily: FontFamily.medium,
    fontSize: scaledFontSize(11, 0.2),
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
