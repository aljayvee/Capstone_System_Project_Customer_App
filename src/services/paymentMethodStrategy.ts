export type PaymentMethodId = "COD" | "GCASH" | "BANK_TRANSFER";

export interface PaymentMethodDefinition {
  id: PaymentMethodId;
  // Must match a `PaymentMode.name` seeded on the server (server/src/seed.ts)
  // so the modal can look up the real numeric paymentModeId to submit.
  backendName: string;
  label: string;
  /** One line under the label, where the method needs explaining. */
  hint?: string;
}

/** The shape `GET /payment-modes` returns. */
export interface BackendPaymentModeLike {
  name: string;
  status: string;
}

/**
 * The payment methods, in the order a customer sees them.
 *
 * Presentation only. Whether a method can be CHOSEN is not decided here — it is
 * `PaymentMode.status` on the server, read through isMethodAvailable below.
 *
 * This file used to carry a hardcoded `available: boolean` per method, set by a
 * CodStrategy / UnavailableStrategy pair. That was a second copy of a fact the
 * database already owned, and the two drifted the moment a new mode was
 * activated server-side: the mode was Active in `payment_modes`, the client
 * still said false, and the method was invisible with nothing to explain why.
 * A flag duplicated across a network boundary is a flag that will disagree.
 */
export const PAYMENT_METHODS: PaymentMethodDefinition[] = [
  {
    id: "COD",
    backendName: "Cash on Delivery",
    label: "Cash on Delivery",
    hint: "Pay the rider in full when your items arrive.",
  },
  {
    id: "GCASH",
    backendName: "GCash / PayMaya",
    // No "(50%)" since 2026-10-08: the half-payment plan is retired. The whole
    // bill is paid at the door, like cash on delivery, and the rider takes a
    // photo of the transfer's confirmation screen.
    label: "GCash / PayMaya",
    hint: "Pay in full when your items arrive. Send it by GCash or PayMaya and show your rider the confirmation.",
  },
  {
    id: "BANK_TRANSFER",
    backendName: "Bank Transfer",
    label: "Bank Transfer",
    hint: "Pay in full when your items arrive. Make the transfer and show your rider the confirmation.",
  },
  // Debit/Credit Card was listed here, always "Not available yet". Removed on
  // 2026-10-15, from the database too: there is no way to pay by card.
];

/**
 * The methods to offer: the ones the server lists. A method the catalogue no
 * longer has is not shown at all, rather than as a tile nobody can pick.
 */
export function offeredMethods(backendModes: BackendPaymentModeLike[]): PaymentMethodDefinition[] {
  return PAYMENT_METHODS.filter((method) => backendModes.some((m) => m.name === method.backendName));
}

/**
 * Whether the server currently offers this method.
 *
 * The single source of truth is `PaymentMode.status`, which
 * paymentSelectionService re-checks on submit anyway — so a method shown as
 * available here and rejected there would be a bug in this function, not a
 * difference of opinion.
 *
 * Unknown to the server means unavailable. A method the catalogue has never
 * heard of cannot be submitted (there is no id to send), so offering it would
 * only produce a tap that silently does nothing.
 */
export function isMethodAvailable(
  method: PaymentMethodDefinition,
  backendModes: BackendPaymentModeLike[]
): boolean {
  const mode = backendModes.find((m) => m.name === method.backendName);
  return mode?.status === "Active";
}

/** What a customer sees for a mode the server names; the name itself when unknown. */
export function labelForMode(modeName: string): string {
  return PAYMENT_METHODS.find((m) => m.backendName === modeName)?.label ?? modeName;
}
