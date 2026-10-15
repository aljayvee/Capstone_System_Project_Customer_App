import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Camera, ImageIcon, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { FontFamily, FontSizes, Spacing, BorderRadius, scaledFontSize, moderateScale } from '../config/theme';
import { formatPeso } from '../utils/format';
import { safePickImage } from '../utils/safeImagePicker';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';

/**
 * The customer shows what they sent.
 *
 * On a non-COD plan the money arrives on the company's Facebook Page, outside
 * this system entirely — so until now a dispatcher confirming a payment was
 * vouching for something they had seen in a different app, and the customer had
 * no way to show they had paid at all.
 *
 * The screenshot is read by Cloud Vision server-side and checked against this
 * errand before it is stored: it must carry a reference number, be for the
 * amount owed, and be dated today. Anything else is refused with a reason the
 * customer can act on, because a receipt for the wrong amount or the wrong day
 * is not weak evidence — it is evidence of a different payment.
 *
 * For the half-payment asked for mid-way, a receipt that passes those checks
 * confirms the payment on its own (`autoConfirmed`), and the rider is told to
 * head out. Anything else, and the balance, is still confirmed by a dispatcher.
 */

interface ExtractedProof {
  referenceNo: string | null;
  transactionId: string | null;
  amount: number | null;
  transactionDate: string | null;
  capturedAt?: string;
  /** True when this receipt settled the payment by itself. */
  autoConfirmed?: boolean;
}

interface PaymentProofUploadProps {
  errandId: string;
  /** What's currently owed — half up front, or the balance the rider would
   * otherwise collect in cash. The server decides which one this actually
   * validates against from the errand's live ledger state; this is only
   * what the card tells the customer to send. */
  amountDue: number;
  /** Which figure `amountDue` is, so the copy asks for the right thing. */
  context?: 'upfront' | 'balance';
  /** An already-uploaded proof, so the card opens in the right state. */
  existing?: ExtractedProof | null;
  onUploaded?: (proof: ExtractedProof) => void;
}

export default function PaymentProofUpload({
  errandId,
  amountDue,
  context = 'upfront',
  existing = null,
  onUploaded,
}: PaymentProofUploadProps) {
  const { colors } = useThemeColor();
  const [proof, setProof] = useState<ExtractedProof | null>(existing);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (mode: 'camera' | 'gallery') => {
    setError(null);

    const asset = await safePickImage({
      mode,
      // No crop. Squaring a payment confirmation is how the reference number
      // ends up outside the image the OCR then cannot find it in.
      allowsEditing: false,
      quality: 0.9,
      purpose: 'your payment receipt',
    });
    if (!asset?.base64) return;

    const sizeInBytes = asset.fileSize || Math.round((asset.base64.length * 3) / 4);
    const MAX_RECEIPT_BYTES = 15 * 1024 * 1024; // 15MB
    if (sizeInBytes > MAX_RECEIPT_BYTES) {
      setError('That image is too large. Please use one under 15MB.');
      return;
    }

    setPreview(asset.uri);
    setIsUploading(true);
    try {
      const res = await apiClient.post(
        `/errands/${errandId}/payment-proof`,
        {
          imageData: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`,
          mimeType: asset.mimeType || 'image/jpeg',
          fileSize: sizeInBytes,
        },
        { timeout: 60000 }
      );
      const uploaded: ExtractedProof = { ...res.data?.proof, autoConfirmed: Boolean(res.data?.autoConfirmed) };
      setProof(uploaded);
      onUploaded?.(uploaded);
    } catch (err: any) {
      // The server's validation reason, when there is one — wrong amount,
      // wrong day, no reference — and a status-shaped message otherwise
      // (offline, timed out, down for maintenance), never the raw response
      // body.
      setError(toUserMessage(err, 'payment'));
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  if (proof) {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]} testID="payment-proof-done">
        <View style={styles.header}>
          <CheckCircle2 size={16} color={colors.success ?? '#10B981'} />
          <Text style={[styles.heading, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
            {proof.autoConfirmed ? 'Payment confirmed' : 'Receipt received'}
          </Text>
        </View>

        <Text style={[styles.note, { color: colors.textGray }]} maxFontSizeMultiplier={1.2} testID="payment-proof-status">
          {proof.autoConfirmed
            ? 'Your receipt checked out. Your rider has been told to bring your items.'
            : "Your dispatcher is checking it. You'll see it confirmed here."}
        </Text>

        <View style={styles.rows}>
          <Row label="Reference" value={proof.referenceNo ?? '—'} testID="proof-reference" colors={colors} />
          {proof.transactionId && (
            <Row label="Transaction ID" value={proof.transactionId} testID="proof-transaction-id" colors={colors} />
          )}
          <Row
            label="Amount"
            value={proof.amount != null ? formatPeso(proof.amount) : '—'}
            testID="proof-amount"
            colors={colors}
          />
          <Row
            label="Date"
            value={proof.transactionDate ? new Date(proof.transactionDate).toLocaleDateString() : '—'}
            testID="proof-date"
            colors={colors}
          />
        </View>

        <TouchableOpacity onPress={() => setProof(null)} testID="proof-replace">
          <Text style={[styles.replace, { color: colors.primary }]} maxFontSizeMultiplier={1.2}>
            Upload a different receipt
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]} testID="payment-proof-upload">
      <Text style={[styles.heading, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
        Send us your receipt
      </Text>
      <Text style={[styles.note, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
        {context === 'balance'
          ? `After sending the ${formatPeso(amountDue)} balance through our Facebook Page, upload the confirmation. Otherwise your rider will collect it in cash on delivery.`
          : `After sending ${formatPeso(amountDue)} through our Facebook Page, upload the confirmation.`}{' '}
        Make sure the reference number, amount and date are all visible.
      </Text>

      {preview && <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" />}

      {error && (
        <View style={styles.errorRow} testID="proof-error">
          <AlertTriangle size={14} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]} maxFontSizeMultiplier={1.2}>
            {error}
          </Text>
        </View>
      )}

      {isUploading ? (
        <View style={styles.uploading} testID="proof-uploading">
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.note, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>
            Reading your receipt…
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => pick('camera')}
            accessibilityRole="button"
            accessibilityLabel="Take a photo of your payment receipt"
            testID="proof-camera"
          >
            <Camera size={15} color="#FFFFFF" />
            <Text style={styles.btnText} maxFontSizeMultiplier={1.2}>Take photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnGhost, { borderColor: colors.border }]}
            onPress={() => pick('gallery')}
            accessibilityRole="button"
            accessibilityLabel="Choose a payment receipt screenshot from your photos"
            testID="proof-gallery"
          >
            <ImageIcon size={15} color={colors.textDark} />
            <Text style={[styles.btnText, { color: colors.textDark }]} maxFontSizeMultiplier={1.2}>
              Upload screenshot
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Row({
  label,
  value,
  testID,
  colors,
}: {
  label: string;
  value: string;
  testID: string;
  colors: any;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textGray }]} maxFontSizeMultiplier={1.2}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textDark }]} testID={testID} maxFontSizeMultiplier={1.2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  heading: { fontFamily: FontFamily.bold, fontSize: scaledFontSize(FontSizes.sm, 0.2) },
  note: {
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: moderateScale(15, 0.2),
  },
  preview: { width: '100%', height: moderateScale(150, 0.2), borderRadius: BorderRadius.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    color: '#FFFFFF',
  },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  rows: { gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  rowLabel: { fontFamily: FontFamily.regular, fontSize: scaledFontSize(FontSizes.xs, 0.2) },
  rowValue: { fontFamily: FontFamily.mono, fontSize: scaledFontSize(FontSizes.xs, 0.2), flexShrink: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    lineHeight: moderateScale(15, 0.2),
  },
  replace: {
    fontFamily: FontFamily.bold,
    fontSize: scaledFontSize(FontSizes.xs, 0.2),
    paddingTop: Spacing.xs,
  },
});
