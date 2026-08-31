// Shared "where should tapping this errand take the customer" routing —
// used by the My Errands list and the ongoing-errand FAB so both stay in sync.
export function openErrandDestination(navigation: any, user: any, errand: any) {
  if (!errand) return;
  // .orderId/.id are the backend's actual response field names (customerService.ts) — not renamed.
  const errandId = errand.orderId || errand.id;
  if (errand.status === 'PENDING') {
    navigation.navigate('WaitingForDispatcher', { user, errandId });
  } else {
    navigation.navigate('CustomerChat', { user, errandId });
  }
}
