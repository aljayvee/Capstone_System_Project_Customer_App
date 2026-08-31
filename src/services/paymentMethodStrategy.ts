export type PaymentMethodId = "COD" | "GCASH" | "BANK_TRANSFER" | "CARD";

export interface PaymentMethodDefinition {
  id: PaymentMethodId;
  // Must match a `PaymentMode.name` seeded on the server (server/src/seed.ts)
  // so the modal can look up the real numeric paymentModeId to submit.
  backendName: string;
  label: string;
  available: boolean;
}

// One Strategy per payment method — CodStrategy is the only one with real
// handling today. Wiring up a real GCash/Bank/Card integration later means
// adding a new Strategy class here, not editing a growing if/else chain.
interface PaymentMethodStrategy {
  isAvailable(): boolean;
}

class CodStrategy implements PaymentMethodStrategy {
  isAvailable(): boolean {
    return true;
  }
}

class UnavailableStrategy implements PaymentMethodStrategy {
  isAvailable(): boolean {
    return false;
  }
}

const codStrategy = new CodStrategy();
const unavailableStrategy = new UnavailableStrategy();

export const PAYMENT_METHODS: PaymentMethodDefinition[] = [
  { id: "COD", backendName: "Cash on Delivery", label: "Cash on Delivery", available: codStrategy.isAvailable() },
  { id: "GCASH", backendName: "GCash / PayMaya", label: "GCash / PayMaya", available: unavailableStrategy.isAvailable() },
  {
    id: "BANK_TRANSFER",
    backendName: "Bank Transfer",
    label: "Bank Transfer",
    available: unavailableStrategy.isAvailable(),
  },
  { id: "CARD", backendName: "Debit/Credit Card", label: "Debit/Credit Card (Visa/Mastercard)", available: unavailableStrategy.isAvailable() },
];
