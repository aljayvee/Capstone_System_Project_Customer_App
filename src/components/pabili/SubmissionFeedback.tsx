import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { FontFamily, PortalFontSizes, scaledPortalFontSize, Spacing, PortalFontSizeMultipliers } from '../../config/theme';
import type { SubmissionState } from '../../services/pabiliSubmission';

export default function SubmissionFeedback({ state, onRetry, onViewOrders }: {
  state: SubmissionState; onRetry: () => void; onViewOrders: () => void;
}) {
  const { colors } = useThemeColor();
  const sending = state.phase === 'sending';
  return (
    <Modal transparent visible={sending || state.phase === 'unconfirmed'} animationType="fade"
      statusBarTranslucent onRequestClose={() => {}}>
      <View accessibilityViewIsModal style={[styles.backdrop, { backgroundColor: sending ? 'rgba(30,34,40,0.88)' : 'rgba(30,34,40,0.45)' }]}
        testID={sending ? 'order-submitting-overlay' : 'order-unconfirmed-modal'}>
        {sending ? (
          <View style={styles.waiting} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.title} style={[styles.title, { color: '#FFFFFF' }]}>
              {state.slow ? 'This is taking longer than usual.' : 'Sending your order…'}
            </Text>
            <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.body, { color: '#FFFFFF' }]}>
              {state.slow ? 'We’re still waiting for confirmation.' : 'Please keep this screen open while we confirm your request.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.title} style={[styles.title, { color: colors.textDark }]}>Your order hasn’t been confirmed yet</Text>
            <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.body, { color: colors.textGray }]}>
              We haven’t received confirmation yet. Your order may already have reached the dispatcher. Try again to safely check and continue the same request.
            </Text>
            <TouchableOpacity accessibilityRole="button" style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={onRetry} testID="retry-order-submission">
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.button} style={[styles.buttonText, { color: colors.onPrimary }]}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onViewOrders} testID="view-orders-after-timeout">
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.button} style={[styles.buttonText, { color: colors.textDark }]}>View my orders</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  waiting: { width: '100%', maxWidth: 420, alignItems: 'center', gap: Spacing.lg },
  dialog: { width: '100%', maxWidth: 420, padding: Spacing.xl, borderRadius: 12, gap: Spacing.lg },
  title: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading), textAlign: 'center', lineHeight: 25 },
  body: { fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.body), textAlign: 'center', lineHeight: 22 },
  button: { minHeight: 50, paddingHorizontal: Spacing.md, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
});
