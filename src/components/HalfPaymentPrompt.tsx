import React, { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socketClient';
import { navigationRef } from '../navigation/navigationRef';
import { getActiveChatErrandId } from '../utils/activeChatTracker';

interface HalfPaymentRequest {
  errandId: string;
  dueUpFront: number;
  goodsTotal: number;
}

function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * "Your items are bought. Half-payment needed", over whatever is open.
 *
 * The rider is standing at the last shop until this is paid, so it cannot wait
 * for the customer to wander into the right chat. Mounted once, beside the
 * navigator, and driven by the server's `errand:half_payment_requested`, which
 * reaches this customer's own socket room whether or not they have the chat
 * open. Its one action takes them to that chat, where the amount and the
 * receipt upload are.
 *
 * Push covers an app that is closed; this covers one that is open.
 */
export default function HalfPaymentPrompt() {
  const { user } = useAuth();
  const [request, setRequest] = useState<HalfPaymentRequest | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let detach: (() => void) | undefined;
    let cancelled = false;

    const onRequested = (payload: any) => {
      const errandId = String(payload?.errandId || '');
      if (!errandId) return;
      setRequest({
        errandId,
        dueUpFront: Number(payload?.dueUpFront ?? 0),
        goodsTotal: Number(payload?.goodsTotal ?? 0),
      });
    };

    // Paid, from the chat or by the dispatcher: nothing left to prompt about.
    const onPaymentUpdated = (payload: any) => {
      if (payload?.reason !== 'upfront_confirmed') return;
      setRequest((current) =>
        current && current.errandId === String(payload?.errandId) ? null : current
      );
    };

    void getSocket().then((socket) => {
      if (cancelled) return;
      socket.on('errand:half_payment_requested', onRequested);
      socket.on('errand:payment_updated', onPaymentUpdated);
      detach = () => {
        socket.off('errand:half_payment_requested', onRequested);
        socket.off('errand:payment_updated', onPaymentUpdated);
      };
    });

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [user?.id]);

  const openChat = () => {
    const target = request;
    setRequest(null);
    if (!target || !user || !navigationRef.isReady()) return;
    // Already on that chat: closing the prompt is the whole job.
    if (getActiveChatErrandId() === target.errandId) return;
    navigationRef.navigate('CustomerChat', { user: user as any, errandId: target.errandId });
  };

  return (
    <ConfirmModal
      visible={request !== null}
      title="Your items are bought"
      message={
        request
          ? `Your rider paid ${peso(request.goodsTotal)} for your items. Send the half-payment of ${peso(request.dueUpFront)} so they can bring them to you.`
          : ''
      }
      confirmLabel="Open chat"
      cancelLabel="Later"
      destructive={false}
      buttonLayout="vertical"
      onConfirm={openChat}
      onCancel={() => setRequest(null)}
      testID="half-payment-prompt"
    />
  );
}
