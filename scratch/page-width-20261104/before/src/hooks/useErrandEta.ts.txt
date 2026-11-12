import { useEffect, useState } from 'react';
import { getSocket, subscribeToErrand, unsubscribeFromErrand } from '../services/socketClient';

export interface EtaTelemetry {
  etaLowAt: string;
  etaHighAt: string;
  travelSeconds: number;
  dwellLowSeconds: number;
  dwellHighSeconds: number;
  remainingStopCount: number;
  degraded: boolean;
}

export interface DelayNotice {
  storeName: string;
  categoryName: string | null;
  elapsedSeconds: number;
  typicalSeconds: number;
}

/**
 * Live ETA for one errand, pushed from the server.
 *
 * Also surfaces the "this stop is taking longer than usual" signal, which is the
 * part that makes an errand ETA honest. A rider standing still for 25 minutes
 * inside a supermarket is the job working correctly, not a stall — but from the
 * customer's side it is indistinguishable from a rider who has stopped caring
 * unless someone says so. Without this the ETA just slides quietly, which reads
 * as a broken promise.
 */
export function useErrandEta(errandId: string | null) {
  const [telemetry, setTelemetry] = useState<EtaTelemetry | null>(null);
  const [delayNotice, setDelayNotice] = useState<DelayNotice | null>(null);

  useEffect(() => {
    if (!errandId) {
      setTelemetry(null);
      setDelayNotice(null);
      return;
    }

    let cancelled = false;

    const onEta = (payload: any) => {
      if (cancelled || payload?.errandId !== errandId) return;
      setTelemetry({
        etaLowAt: payload.etaLowAt,
        etaHighAt: payload.etaHighAt,
        travelSeconds: Number(payload.travelSeconds) || 0,
        dwellLowSeconds: Number(payload.dwellLowSeconds) || 0,
        dwellHighSeconds: Number(payload.dwellHighSeconds) || 0,
        remainingStopCount: Number(payload.remainingStopCount) || 0,
        degraded: Boolean(payload.degraded),
      });
    };

    const onDelay = (payload: any) => {
      if (cancelled || payload?.errandId !== errandId) return;
      setDelayNotice({
        storeName: String(payload.storeName || 'the store'),
        categoryName: payload.categoryName ?? null,
        elapsedSeconds: Number(payload.elapsedSeconds) || 0,
        typicalSeconds: Number(payload.typicalSeconds) || 0,
      });
    };

    let detach: (() => void) | undefined;

    void (async () => {
      const socket = await getSocket();
      if (cancelled) return;
      socket.on('errand:eta_updated', onEta);
      socket.on('errand:stop_delayed', onDelay);
      await subscribeToErrand(errandId);
      detach = () => {
        socket.off('errand:eta_updated', onEta);
        socket.off('errand:stop_delayed', onDelay);
      };
    })();

    return () => {
      cancelled = true;
      detach?.();
      void unsubscribeFromErrand(errandId);
    };
  }, [errandId]);

  return { telemetry, delayNotice };
}

/** Plain-language explanation of a slow stop, phrased to reassure, not alarm. */
export function formatDelayNotice(notice: DelayNotice | null): string | null {
  if (!notice) return null;
  const typicalMinutes = Math.round(notice.typicalSeconds / 60);
  return `Your rider is still at ${notice.storeName}. Stops like this usually take about ${typicalMinutes} min.`;
}
