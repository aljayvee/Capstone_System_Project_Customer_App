import { apiClient } from './apiClient';

export interface FeeQuote {
  fees: {
    baseFee: number;
    distanceFee: number;
    multiStoreFee: number;
    groceryFee: number;
    nonCodFee: number;
    /** The five above, summed. */
    subtotal: number;
  };
  /** The customer's money for the goods. Never part of `fees`. */
  itemsSubtotal: number;
  tip: number;
  grandTotal: number;
  /**
   * False for every pre-creation quote: distance is unknown until a dispatcher
   * pins stores, so the figure is provisional and must be labelled as such.
   */
  isFinal: boolean;
  /**
   * Stops the dispatcher added beyond what this quote charges for. Zero on an
   * ordinary errand; above zero the order is being collected from more shops
   * than the customer is paying a multi-store fee on.
   */
  absorbedStores?: number;
}

export interface QuoteRequest {
  estimatedCost?: number;
  tip?: number;
  storeCount?: number;
  isCod?: boolean;
  /**
   * Total units in the basket. The handling fee now turns on size as well as
   * value, so a quote that omits this can come in under the final bill on a
   * large but inexpensive order.
   */
  itemUnits?: number;
}

/**
 * Asks the server what a draft errand would cost.
 *
 * This screen used to compute the price itself, from a hardcoded 2.5 km and
 * without two of the fee components — so the number a customer agreed to at
 * checkout could not match what the server went on to bill them. There is now
 * exactly one pricing implementation, and it lives on the server.
 *
 * Returns null on failure rather than throwing: the caller shows "calculating"
 * instead of a wrong number, which is the honest failure mode for a price.
 */
export async function fetchQuote(request: QuoteRequest): Promise<FeeQuote | null> {
  try {
    const response = await apiClient.post('/errands/quote', request);
    return response.data ?? null;
  } catch (err) {
    console.warn('[Quote] Could not price this errand:', err);
    return null;
  }
}
