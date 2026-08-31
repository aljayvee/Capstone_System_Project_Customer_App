import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

export interface ErrandSummary {
  id: string;
  category: string;
  status: string;
}

export interface UseActiveErrandsResult {
  errands: ErrandSummary[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

async function fetchActiveErrands(userId: string | number): Promise<{ data: ErrandSummary[]; error: boolean }> {
  let networkFailed = false;

  try {
    const response = await apiClient.get(`/errands/user/${userId}`);
    const allErrands = response.data || [];
    // CANCELLED errands are kept (their chat is still findable/reviewable —
    // see the filter buttons in ChatTab/ActiveChatsScreen), only COMPLETED
    // ones are dropped, since a settled errand has nothing left to chat about.
    const ongoing = allErrands.filter((e: any) => e.status !== 'PASSING BY' && e.status !== 'COMPLETED');
    if (ongoing.length > 0) return { data: ongoing, error: false };
  } catch (err: any) {
    if (err.code === 'ERR_NETWORK' || !err.response) {
      networkFailed = true;
    }
  }

  try {
    const res = await apiClient.get(`/customers/${userId}/transactions`);
    const transactionErrands = res.data?.orders || [];
    const list = transactionErrands
      .filter((o: any) => o.status !== 'COMPLETED')
      .map((o: any) => ({ id: o.orderId || o.id, category: o.categories || 'Pabili', status: o.status || 'PENDING' }));
    return { data: list, error: false };
  } catch (err: any) {
    if (err.code === 'ERR_NETWORK' || !err.response) {
      networkFailed = true;
    }
    return { data: [], error: networkFailed };
  }
}

export function useActiveErrands(userId: string | number | undefined): UseActiveErrandsResult {
  const [errands, setErrands] = useState<ErrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);

    fetchActiveErrands(userId).then((result) => {
      if (isMounted) {
        setErrands(result.data);
        setError(result.error);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId, refreshCounter]);

  return { errands, loading, error, refresh };
}
