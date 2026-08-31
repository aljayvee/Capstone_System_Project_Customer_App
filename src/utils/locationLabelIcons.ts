import type { LucideIcon } from 'lucide-react-native';
import { House, Briefcase, MapPin } from 'lucide-react-native';

export interface LocationLabelChip {
  label: string;
  Icon: LucideIcon;
}

/** Quick-select chips offered in the "name this location" wizard step. */
export const LOCATION_LABEL_CHIPS: LocationLabelChip[] = [
  { label: 'Home', Icon: House },
  { label: 'Work', Icon: Briefcase },
  { label: 'Other', Icon: MapPin },
];

/** Maps a saved location's free-text label to a representative icon, falling back to a generic pin. */
export function getLocationTypeIcon(label: string): LucideIcon {
  const normalized = label.trim().toLowerCase();
  const match = LOCATION_LABEL_CHIPS.find((chip) => chip.label.toLowerCase() === normalized);
  return match ? match.Icon : MapPin;
}
