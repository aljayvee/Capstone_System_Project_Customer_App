export interface SavedLocation {
  id: number;
  userId: number;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

export interface LocationDraftPayload {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}
