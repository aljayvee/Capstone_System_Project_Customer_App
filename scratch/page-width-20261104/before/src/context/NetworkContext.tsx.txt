import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { hasSlowRequestInFlight } from '../services/apiClient';

const RECONNECTED_BANNER_MS = 2600;
const SLOW_POLL_MS = 1000;

export interface NetworkStatus {
  /** The device has a usable route to the internet. */
  isConnected: boolean;
  /** Connected, but requests are taking long enough that the customer notices. */
  isSlow: boolean;
  /** Briefly true right after connectivity comes back, to confirm the recovery. */
  justReconnected: boolean;
  /** Re-reads the radio now. Wired to the offline screen's Try again button. */
  retry: () => Promise<void>;
  /** Bumped on every disconnected -> connected edge, for refetch effects. */
  reconnectCount: number;
}

const NetworkContext = createContext<NetworkStatus | undefined>(undefined);

/**
 * Device connectivity, plus an honest reading of whether the connection is
 * usable rather than merely present.
 *
 * The connected predicate matches RiderMobileApp's useConnectivity exactly
 * (`isConnected && isInternetReachable !== false`). Two Sugo apps disagreeing
 * about whether the same phone is online would be worse than either being
 * wrong alone. `isInternetReachable` is compared against `false` rather than
 * truthiness on purpose: it is null while NetInfo is still probing, and
 * treating "not yet known" as offline flashes the block screen on every launch.
 *
 * Slowness is measured, not guessed. NetInfo can report a strong Wi-Fi signal
 * on a hotspot with no working uplink, so the radio tells us nothing the
 * customer cares about. apiClient times its own in-flight requests instead.
 */
export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const wasConnectedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyState = useCallback((connected: boolean) => {
    setIsConnected(connected);

    if (connected && !wasConnectedRef.current) {
      wasConnectedRef.current = true;
      setReconnectCount((c) => c + 1);
      setJustReconnected(true);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => setJustReconnected(false), RECONNECTED_BANNER_MS);
    } else if (!connected && wasConnectedRef.current) {
      wasConnectedRef.current = false;
      setJustReconnected(false);
      // Nothing can be in flight over a dead link, and a stale "slow" warning
      // stacked under the offline screen says two different things at once.
      setIsSlow(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      applyState(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => {
      unsubscribe();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [applyState]);

  useEffect(() => {
    // Polled rather than pushed: a request that is merely pending fires no
    // event, and "still waiting" is exactly the state worth reporting.
    const timer = setInterval(() => {
      setIsSlow((prev) => {
        const next = wasConnectedRef.current && hasSlowRequestInFlight();
        return next === prev ? prev : next;
      });
    }, SLOW_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const retry = useCallback(async () => {
    const state = await NetInfo.refresh();
    applyState(Boolean(state.isConnected && state.isInternetReachable !== false));
  }, [applyState]);

  const value = useMemo<NetworkStatus>(
    () => ({ isConnected, isSlow, justReconnected, retry, reconnectCount }),
    [isConnected, isSlow, justReconnected, retry, reconnectCount]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

/**
 * Safe outside the provider: returns an optimistic "connected" reading rather
 * than throwing, so a component rendered in a test harness or in isolation is
 * never blocked by a network gate that was never mounted.
 */
export function useNetworkStatus(): NetworkStatus {
  const context = useContext(NetworkContext);
  if (context) return context;
  return {
    isConnected: true,
    isSlow: false,
    justReconnected: false,
    retry: async () => {},
    reconnectCount: 0,
  };
}
