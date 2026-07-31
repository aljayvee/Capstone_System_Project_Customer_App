import { database } from './config';
import { ref, set } from 'firebase/database';

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: number;
}

/**
 * Saves customer live GPS location coordinates to Firebase Realtime Database.
 */
export async function saveCustomerLocation(
  customerId: string | number,
  latitude: number,
  longitude: number,
  address: string = 'Current Location'
): Promise<void> {
  try {
    const locationRef = ref(database, `locations/customers/${customerId}`);
    await set(locationRef, {
      latitude,
      longitude,
      address,
      timestamp: Date.now(),
    });
    console.log(`[Firebase RTDB] Saved GPS location for customer ${customerId}: (${latitude}, ${longitude})`);
  } catch (err) {
    console.error('[Firebase RTDB] Error saving customer location:', err);
  }
}
