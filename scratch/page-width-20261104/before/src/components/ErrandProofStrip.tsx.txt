import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { PortalFontSizeMultipliers, PortalFontSizes, scaledPortalFontSize, getPortalLineHeight, FontFamily, Spacing } from '../config/theme';
import { formatPeso } from '../utils/format';
import { apiClient } from '../services/apiClient';

interface ProofSummary {
  id: number;
  kind: 'RECEIPT' | 'TRANSFER' | 'PROOF_OF_DELIVERY' | 'NO_RECEIPT';
  capturedAt: string;
  verified?: boolean;
  declaredTotal?: number | null;
  extraction?: { confirmedTotal: number | null; extractedTotal: number | null } | null;
}

/**
 * How long one photo fetch may take before it is given up on.
 *
 * The shared `apiClient` timeout is 10s, which is right for the JSON calls it
 * was set for and far too short for this one. A proof image is returned as
 * base64 INSIDE the JSON body, so a 400KB JPEG arrives as a ~530KB response,
 * and on Philippine mobile data that routinely needs longer than ten seconds.
 *
 * The production access log showed exactly that: repeated 200s for the same
 * image id with different byte counts (527,756 once, then 383,939, 371,652,
 * 469,955), which is one resource being cut off at a different point every
 * time. The request was not failing on the server; axios was hanging up on it
 * partway through. The customer saw a spinner, then an empty modal, because
 * the abort landed in a `catch` that set the image to null and said nothing.
 *
 * Sized for the 5MB ceiling the upload validator allows rather than for the
 * typical 400KB, since the slow case is the one that needs the headroom.
 */
const PHOTO_FETCH_TIMEOUT_MS = 60000;

const LABELS: Record<ProofSummary['kind'], string> = {
  RECEIPT: 'Receipt',
  NO_RECEIPT: 'No receipt issued',
  TRANSFER: 'Payment proof',
  PROOF_OF_DELIVERY: 'Handover',
};

/**
 * What the rider photographed, shown to the customer whose money paid for it.
 *
 * The errand list has always described itself as somewhere to "view past
 * receipts" and there were none to view — the photos existed, and no customer
 * screen ever asked for them. A customer disputing a delivery had a status word
 * and nothing else.
 *
 * Thumbnails are fetched one at a time and only when the strip is open. The list
 * endpoint deliberately omits every blob, because five receipts would otherwise
 * be two megabytes of base64 arriving with a screen nobody may look at.
 */
export default function ErrandProofStrip({ errandId }: { errandId: string }) {
  const { colors } = useThemeColor();

  const [proofs, setProofs] = useState<ProofSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Which photo the viewer is open on. Held separately from the decoded image
  // so the modal can stay open through a failure and offer a retry, rather
  // than closing itself and leaving the customer with nothing to act on.
  const [openId, setOpenId] = useState<number | null>(null);
  const [openImage, setOpenImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (!errandId) return;
    let cancelled = false;

    apiClient
      .get(`/errands/${errandId}/proof-images`)
      .then((res) => {
        if (!cancelled) setProofs(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        // An errand that finished before photos were captured has none, and an
        // older one may 403. Neither is worth an error banner on a receipt.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [errandId]);

  const load = useCallback(
    async (id: number) => {
      setLoadingImage(true);
      setImageError(null);
      setOpenImage(null);
      try {
        const res = await apiClient.get(`/errands/${errandId}/proof-images/${id}`, {
          timeout: PHOTO_FETCH_TIMEOUT_MS,
        });

        // A truncated transfer can still parse into an object with a short or
        // missing `imageData`. Caught here rather than handed to <Image>,
        // which renders nothing at all for a malformed data URI and gives the
        // customer a black rectangle with no explanation.
        if (!res.data?.imageData || !res.data?.mimeType) {
          throw new Error('INCOMPLETE');
        }

        setOpenImage(`data:${res.data.mimeType};base64,${res.data.imageData}`);
      } catch (err) {
        const timedOut =
          (err as { code?: string })?.code === 'ECONNABORTED' ||
          /timeout/i.test(String((err as { message?: string })?.message || ''));
        setImageError(
          timedOut
            ? 'That photo is taking too long to download. Check your connection and try again.'
            : 'We could not load that photo. Try again in a moment.'
        );
      } finally {
        setLoadingImage(false);
      }
    },
    [errandId]
  );

  const open = useCallback(
    (id: number) => {
      setOpenId(id);
      void load(id);
    },
    [load]
  );

  const close = useCallback(() => {
    setOpenId(null);
    setOpenImage(null);
    setImageError(null);
  }, []);

  if (failed || !proofs || proofs.length === 0) return null;

  const amountOf = (p: ProofSummary) =>
    p.extraction?.confirmedTotal ?? p.extraction?.extractedTotal ?? p.declaredTotal ?? null;

  return (
    <View style={styles.wrapper} testID="errand-proof-strip">
      <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.heading, { color: colors.textDark }]}>Photos from your rider</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {proofs.map((proof) => {
          const amount = amountOf(proof);
          const unverified = proof.verified === false;

          return (
            <Pressable
              key={proof.id}
              onPress={() => open(proof.id)}
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
              testID={`proof-${proof.id}`}
            >
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.kind, { color: colors.textDark }]}>{LABELS[proof.kind]}</Text>

              {amount !== null && (
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.amount, { color: colors.textDark }]}>{formatPeso(amount)}</Text>
              )}

              {/* Said plainly. A customer paying for goods bought somewhere that
                  prints no receipt should know which purchase that was — the
                  same reason the fee breakdown itemises rather than totalling. */}
              {unverified && (
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.unverified, { color: colors.warning }]} testID={`proof-${proof.id}-unverified`}>
                  Amount stated by the rider
                </Text>
              )}

              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.time, { color: colors.textLight }]}>
                {new Date(proof.capturedAt).toLocaleString()}
              </Text>

              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.view, { color: colors.primary }]}>Tap to view</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Four states, not two. This was `loading ? spinner : image`, so every
          failure resolved to a modal that closed itself: the spinner ran, the
          request aborted, and the customer was returned to the list with no
          image, no message and nothing to press. */}
      <Modal visible={openId !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          {loadingImage ? (
            <View style={styles.centered}>
              <ActivityIndicator color="#FFFFFF" size="large" />
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={styles.backdropText}>Loading photo</Text>
            </View>
          ) : imageError ? (
            <View style={styles.centered} testID="proof-image-error">
              <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={styles.errorText}>{imageError}</Text>
              <Pressable
                onPress={() => openId !== null && load(openId)}
                style={[styles.retry, { backgroundColor: colors.primary }]}
                testID="proof-image-retry"
              >
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={[styles.retryLabel, { color: colors.onPrimary }]}>Try again</Text>
              </Pressable>
              <Pressable onPress={close} style={styles.dismiss}>
                <Text maxFontSizeMultiplier={PortalFontSizeMultipliers.body} style={styles.backdropText}>Close</Text>
              </Pressable>
            </View>
          ) : openImage ? (
            <Image
              source={{ uri: openImage }}
              style={styles.full}
              resizeMode="contain"
              // The decoder's own failure channel. A data URI that survives the
              // checks above can still be undecodable, and without this the
              // component would be back to showing a silent blank.
              onError={() =>
                setImageError('That photo could not be displayed. Try again in a moment.')
              }
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: Spacing.md, gap: Spacing.sm },
  heading: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.subheading), 'heading'), fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.subheading) },
  row: { gap: Spacing.sm, paddingRight: Spacing.sm },
  card: {
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 2,
  },
  kind: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'), fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
  amount: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.price), 'price'), fontFamily: FontFamily.bold, fontSize: scaledPortalFontSize(PortalFontSizes.price) },
  unverified: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'), fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
  time: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'), fontFamily: FontFamily.regular, fontSize: scaledPortalFontSize(PortalFontSizes.micro) },
  view: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.micro), 'label'), fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.micro), marginTop: 2 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  full: { width: '100%', height: '80%' },
  centered: { alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  backdropText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    color: '#FFFFFF',
    fontFamily: FontFamily.regular,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    textAlign: 'center',
  },
  errorText: {
    lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'),
    color: '#FFFFFF',
    fontFamily: FontFamily.semibold,
    fontSize: scaledPortalFontSize(PortalFontSizes.body),
    textAlign: 'center',
  },
  retry: { borderRadius: 10, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  retryLabel: { lineHeight: getPortalLineHeight(scaledPortalFontSize(PortalFontSizes.body), 'body'), color: '#FFFFFF', fontFamily: FontFamily.semibold, fontSize: scaledPortalFontSize(PortalFontSizes.body) },
  dismiss: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
});
