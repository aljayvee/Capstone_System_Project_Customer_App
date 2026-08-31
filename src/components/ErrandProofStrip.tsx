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
import { FontFamily, FontSizes, Spacing } from '../config/theme';
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
  const [openImage, setOpenImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

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

  const open = useCallback(
    async (id: number) => {
      setLoadingImage(true);
      try {
        const res = await apiClient.get(`/errands/${errandId}/proof-images/${id}`);
        setOpenImage(`data:${res.data.mimeType};base64,${res.data.imageData}`);
      } catch {
        setOpenImage(null);
      } finally {
        setLoadingImage(false);
      }
    },
    [errandId]
  );

  if (failed || !proofs || proofs.length === 0) return null;

  const amountOf = (p: ProofSummary) =>
    p.extraction?.confirmedTotal ?? p.extraction?.extractedTotal ?? p.declaredTotal ?? null;

  return (
    <View style={styles.wrapper} testID="errand-proof-strip">
      <Text style={[styles.heading, { color: colors.textDark }]}>Photos from your rider</Text>

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
              <Text style={[styles.kind, { color: colors.textDark }]}>{LABELS[proof.kind]}</Text>

              {amount !== null && (
                <Text style={[styles.amount, { color: colors.textDark }]}>{formatPeso(amount)}</Text>
              )}

              {/* Said plainly. A customer paying for goods bought somewhere that
                  prints no receipt should know which purchase that was — the
                  same reason the fee breakdown itemises rather than totalling. */}
              {unverified && (
                <Text style={[styles.unverified, { color: colors.warning }]} testID={`proof-${proof.id}-unverified`}>
                  Amount stated by the rider
                </Text>
              )}

              <Text style={[styles.time, { color: colors.textLight }]}>
                {new Date(proof.capturedAt).toLocaleString()}
              </Text>

              <Text style={[styles.view, { color: colors.primary }]}>Tap to view</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={openImage !== null || loadingImage} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpenImage(null)}>
          {loadingImage ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            openImage && <Image source={{ uri: openImage }} style={styles.full} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: Spacing.md, gap: Spacing.sm },
  heading: { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm },
  row: { gap: Spacing.sm, paddingRight: Spacing.sm },
  card: {
    minWidth: 150,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    gap: 2,
  },
  kind: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs },
  amount: { fontFamily: FontFamily.bold, fontSize: FontSizes.md },
  unverified: { fontFamily: FontFamily.semibold, fontSize: 10 },
  time: { fontFamily: FontFamily.regular, fontSize: 10 },
  view: { fontFamily: FontFamily.semibold, fontSize: 10, marginTop: 2 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  full: { width: '100%', height: '80%' },
});
