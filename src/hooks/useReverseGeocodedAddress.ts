import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { LocationGeocodedAddress } from 'expo-location';
import { MapCoordinate } from '../utils/coords';
import { fetchNearestPlace } from '../services/placesService';

export interface ReverseGeocodedAddress {
  resolving: boolean;
  resolvedAddress: string | null;
}

// Open Location Code, the "plus code" Android's geocoder returns as the entire
// formattedAddress when a coordinate has no street address of its own — e.g.
// "MMM8+F22, Road, City of Tacurong, Sultan Kudarat, Philippines" for a pin on
// the STI College campus.
//
// The grid uses a 20-character alphabet that deliberately excludes vowels and
// easily-confused glyphs, so this cannot collide with a real street name: the
// shape is 4-8 code characters, a '+', then 2-3 more.
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

function isPlusCode(value: string): boolean {
  // Test the first segment only. The code is the leading component of an
  // otherwise ordinary comma-separated address, so matching the whole string
  // would never fire.
  return PLUS_CODE.test(value.split(',')[0].trim());
}

// The geocoder emits a bare "Road" as a placeholder for an unnamed way. It adds
// nothing to an address and reads as a mistake next to a real street name.
const PLACEHOLDER_PARTS = new Set(['road', 'unnamed road']);

function isMeaningful(part: string | null | undefined): part is string {
  if (!part || !part.trim()) return false;
  const trimmed = part.trim();
  // `name` frequently repeats whatever led formattedAddress, so on exactly the
  // coordinates this fix targets it is the plus code again. Screening the parts
  // as well as the whole string is what stops the code reappearing in the
  // fallback it was supposed to escape to.
  if (isPlusCode(trimmed)) return false;
  return !PLACEHOLDER_PARTS.has(trimmed.toLowerCase());
}

function composeAddress(entry: LocationGeocodedAddress): string | null {
  // formattedAddress is preferred when it is a real address, but it is exactly
  // the field that carries the plus code, so it is no longer trusted blindly.
  if (entry.formattedAddress && !isPlusCode(entry.formattedAddress)) {
    return entry.formattedAddress;
  }
  const parts = [entry.name, entry.street, entry.district, entry.city, entry.region].filter(isMeaningful);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Resolves a coordinate to a human-readable address.
 *
 * Two sources, in order of how useful the answer is to a rider:
 *   1. The verified-places catalogue, which can name an establishment
 *      ("STI College Tacurong") — the thing a device geocoder fundamentally
 *      cannot do.
 *   2. The device's native geocoder, for everywhere else, with plus codes
 *      rejected so a pin never resolves to a grid reference nobody can navigate
 *      to by reading it.
 *
 * Every failure path (no network, no result, thrown error, or the web platform
 * which resolves empty rather than throwing) collapses to `resolvedAddress:
 * null` — callers should treat that as "let the user type it in", never surface
 * it as an error.
 */
export function useReverseGeocodedAddress(coordinate: MapCoordinate | null): ReverseGeocodedAddress {
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;

    if (!coordinate) {
      setResolving(false);
      setResolvedAddress(null);
      return;
    }

    setResolving(true);
    setResolvedAddress(null);

    const point = { latitude: coordinate.latitude, longitude: coordinate.longitude };

    const resolve = async (): Promise<string | null> => {
      const place = await fetchNearestPlace(point);
      if (place) return place.name;

      try {
        const results = await Location.reverseGeocodeAsync(point);
        return results[0] ? composeAddress(results[0]) : null;
      } catch {
        return null;
      }
    };

    resolve()
      .then((address) => {
        if (generationRef.current !== generation) return;
        setResolvedAddress(address);
      })
      .catch(() => {
        if (generationRef.current !== generation) return;
        setResolvedAddress(null);
      })
      .finally(() => {
        if (generationRef.current !== generation) return;
        setResolving(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinate?.latitude, coordinate?.longitude]);

  return { resolving, resolvedAddress };
}
