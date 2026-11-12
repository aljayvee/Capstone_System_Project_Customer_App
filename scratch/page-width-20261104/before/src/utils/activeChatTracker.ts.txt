/**
 * Shared in-memory tracker for the errand currently active in CustomerChatScreen.
 *
 * When the customer is actively reading or typing in CustomerChatScreen for an
 * errand, incoming dispatcher messages for that errand are presented directly in
 * the chat stream. Displaying a system drop-down heads-up notification banner and
 * sounding a chime over their active keyboard is disruptive.
 *
 * This singleton tracker allows the app-level notification handler to inspect
 * whether the incoming message matches the active chat and suppress redundant
 * external banners/chimes.
 */
let currentActiveChatErrandId: string | null = null;

export function setActiveChatErrandId(errandId: string | null): void {
  currentActiveChatErrandId = errandId;
}

export function getActiveChatErrandId(): string | null {
  return currentActiveChatErrandId;
}
