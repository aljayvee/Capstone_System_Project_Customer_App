// Client-side state machine for the chat-embedded payment mode flow — mirrors
// the discipline server/src/services/patterns/errandStateMachine.ts already
// enforces for errand lifecycle, applied here since the server never sees the
// intermediate states (only the terminal CONFIRMED write reaches it).
export type PaymentSelectionState = "PROMPTED" | "SELECTING" | "CONFIRMING" | "CONFIRMED";

const TRANSITIONS: Record<PaymentSelectionState, PaymentSelectionState[]> = {
  PROMPTED: ["SELECTING"],
  SELECTING: ["CONFIRMING"],
  CONFIRMING: ["CONFIRMED", "SELECTING"],
  CONFIRMED: [],
};

export function canTransition(current: PaymentSelectionState, target: PaymentSelectionState): boolean {
  return TRANSITIONS[current]?.includes(target) ?? false;
}
