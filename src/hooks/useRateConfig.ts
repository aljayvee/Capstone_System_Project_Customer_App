import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { toUserMessage } from '../services/errorMessages';

export interface RateConfigData {
  id: number;
  baseFee: number;
  perKmRate: number;
  multiStoreFeePerStore: number;
  maxAdditionalStores: number;
  groceryFeeThreshold: number;
  groceryFeePercent: number;
  groceryFeeFlat: number;
  nonCodThreshold: number;
  nonCodFeeHigh: number;
  nonCodFeeLow: number;
}

const DEFAULT_RATE_CONFIG: RateConfigData = {
  id: 1,
  baseFee: 50,
  perKmRate: 10,
  multiStoreFeePerStore: 30,
  maxAdditionalStores: 2,
  groceryFeeThreshold: 3000,
  groceryFeePercent: 10,
  groceryFeeFlat: 50,
  nonCodThreshold: 3000,
  nonCodFeeHigh: 50,
  nonCodFeeLow: 15,
};

export function useRateConfig() {
  const [rateConfig, setRateConfig] = useState<RateConfigData>(DEFAULT_RATE_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<RateConfigData>('/rate-config');
      if (res.data && typeof res.data.baseFee === 'number') {
        setRateConfig(res.data);
      }
    } catch (err: any) {
      // Deliberately soft: a missing rate config falls back to the defaults
      // above, and a fee estimate the customer never asked for is not worth an
      // error banner. Kept in state for callers that choose to read it.
      setError(toUserMessage(err, 'errand'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return {
    rateConfig,
    baseFee: rateConfig.baseFee ?? 50,
    loading,
    error,
    refresh: fetchRates,
  };
}
