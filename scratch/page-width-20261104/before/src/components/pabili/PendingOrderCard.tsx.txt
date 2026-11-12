import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePabiliSubmission } from '../../hooks/usePabiliSubmission';
import { useThemeColor } from '../../hooks/useThemeColor';
import { pabiliSubmissionStore } from '../../services/pabiliSubmission';
import { toUserMessage } from '../../services/errorMessages';
import { FontFamily, Spacing, PortalFontSizes, scaledPortalFontSize, PortalFontSizeMultipliers } from '../../config/theme';
import SubmissionFeedback from './SubmissionFeedback';

export default function PendingOrderCard({ user, navigation, onConfirmed }: {
  user: any; navigation: any; onConfirmed: () => void;
}) {
  const state = usePabiliSubmission(user.id);
  const { colors } = useThemeColor();
  const refreshed = useRef<string | undefined>(undefined);
  const [dialogHidden, setDialogHidden] = React.useState(true);
  useEffect(() => {
    if (state.phase === 'confirmed' && state.errandId && refreshed.current !== state.errandId) {
      refreshed.current = state.errandId;
      onConfirmed();
    }
  }, [state.phase, state.errandId, onConfirmed]);
  if (state.phase === 'idle') return null;
  const retry = () => { setDialogHidden(false); void pabiliSubmissionStore.start(String(user.id)); };
  const confirmed = state.phase === 'confirmed';
  const rejected = state.phase === 'rejected';
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]} testID="pending-order-card">
      <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.title} style={[styles.title, { color: colors.textDark }]}>{confirmed ? 'Order submitted' : rejected ? 'Check your order' : 'Awaiting confirmation'}</Text>
      <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.body, { color: colors.textGray }]}>
        {confirmed ? 'Your request has been sent for dispatcher review.' : rejected
          ? state.storageFailed ? 'We couldn’t save your order safely. Check your device storage and try again.' : toUserMessage(state.error, 'errand')
          : 'Your request is saved. Check and continue this same request to avoid sending it twice.'}
      </Text>
      <TouchableOpacity accessibilityRole="button" style={[styles.button, { backgroundColor: colors.primary }]}
        testID="pending-order-action" disabled={state.phase === 'sending'} onPress={() => {
          if (confirmed) {
            navigation.navigate('ErrandDetails', { user, errandId: state.errandId });
            pabiliSubmissionStore.acknowledge();
          } else if (rejected && !state.restoreFailed) navigation.navigate('PabiliReview', { user });
          else retry();
        }}>
        <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.button} style={[styles.title, { color: colors.onPrimary }]}>{confirmed ? 'View order' : rejected && !state.restoreFailed ? 'Review order' : state.phase === 'sending' ? 'Checking your order…' : 'Try again'}</Text>
      </TouchableOpacity>
      <SubmissionFeedback state={dialogHidden ? { ...state, phase: 'idle' } : state} onRetry={retry} onViewOrders={() => setDialogHidden(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { margin: Spacing.lg, padding: Spacing.lg, borderRadius: 12, borderWidth: 1, gap: Spacing.sm },
  title: { fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  body: { fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.caption), lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.md },
});
