export interface SavedLocation {
  id: number;
  userId: number;
  label: string;
  address: string;
  // Door-side details for the rider. Null when the customer left them blank,
  // and on every location saved before they existed.
  streetName?: string | null;
  landmark?: string | null;
  notes?: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

export interface LocationDraftPayload {
  label: string;
  address: string;
  // Sent as null when blank, so editing a place can clear a detail again.
  streetName: string | null;
  landmark: string | null;
  notes: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

// Mirror the server's column limits (locationValidators.ts), so a field can
// never hold more than the save will accept.
export const STREET_NAME_MAX = 150;
export const LANDMARK_MAX = 200;
export const DELIVERY_NOTES_MAX = 300;
