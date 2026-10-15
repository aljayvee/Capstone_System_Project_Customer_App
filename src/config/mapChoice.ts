import { useEffect, useState } from 'react';

/**
 * Which base map the tracking map draws for an errand, decided once and then
 * kept (the same rule as Sugo Rider's config/mapChoice.ts).
 *
 * Each map takes only its own routing engine's lines: Google's map Google
 * Directions', OpenStreetMap OSRM's. The two engines' roads sit metres apart,
 * so another engine's line runs beside the roads painted under it.
 *
 * The map is the one the first route came back drawn on (`drawnWith`, the
 * rider's map when the rider has a verdict), and then every later route is
 * asked for on that map's roads. It is never switched in place: Huawei phones
 * answer the Google Maps SDK with Petal Maps, which ignores a live switch to
 * mapType 'none' and leaves its roads under our tiles. A map that has to change
 * is created again (LiveTrackingMap keys its MapView on the style).
 *
 * It changes only:
 *  - from OpenStreetMap to Google when our tile server stops answering, once
 *    and never back;
 *  - to the other map when its own engine has no route at all (useLiveRoute
 *    `unroutable`), once per errand, so two failing engines cannot swap maps
 *    on every refresh.
 */
export type MapStyle = 'google' | 'osm';

/** The routing engine whose roads a map paints: the only lines drawn on it. */
export function engineForMap(style: MapStyle): 'osrm' | 'google' {
  return style === 'osm' ? 'osrm' : 'google';
}

/**
 * Whether a line may be drawn on this map. A straight-line guess (dashed)
 * follows no roads and stands on either; so does a line whose engine is not
 * known, and any line before there is a map.
 */
export function lineFitsMap(
  style: MapStyle | null | undefined,
  lineEngine: string | null | undefined,
  isGuess: boolean
): boolean {
  if (style == null || isGuess || lineEngine == null) return true;
  return lineEngine === engineForMap(style);
}

/**
 * How long the map waits for the first route before settling on Google.
 * Long enough for a route on a slow line; short enough that a customer with
 * no signal is not left looking at no map.
 */
export const MAP_CHOICE_WAIT_MS = 12_000;

export interface MapChoiceInput {
  /** Whether there is an errand to show a map for. */
  wanted: boolean;
  /** Whose roads the route on hand follows (useLiveRoute `lineEngine`); null until one arrives. */
  lineEngine: string | null | undefined;
  /** True when no road route came back: a straight-line guess, or no answer at all. */
  routeFailed: boolean;
  /** Whether our OpenStreetMap tile server answers (config/mapTiles.ts). */
  osmTilesUp: boolean;
  /** True once MAP_CHOICE_WAIT_MS has passed with no answer. */
  waitedTooLong: boolean;
  /** The engine that could not route on its own roads even when asked for nothing else, or null. */
  unroutable?: 'osrm' | 'google' | null;
  /** True once this errand's map has already moved because its engine could not route. */
  leftForRouting?: boolean;
}

/** The map to draw now, given the one already chosen (if any). Null means draw none yet. */
export function chooseMapStyle(chosen: MapStyle | null, input: MapChoiceInput): MapStyle | null {
  if (chosen === 'osm' && !input.osmTilesUp) return 'google';
  // The chosen map's engine has no route of its own. Google's base map needs
  // nothing from our server; OpenStreetMap only if its tiles answer.
  if (chosen && !input.leftForRouting && input.unroutable === engineForMap(chosen)) {
    if (chosen === 'osm') return 'google';
    if (input.osmTilesUp) return 'osm';
  }
  if (chosen) return chosen;
  if (!input.wanted) return null;

  if (input.lineEngine === 'osrm') return input.osmTilesUp ? 'osm' : 'google';
  if (input.lineEngine === 'google') return 'google';

  // No road route to follow (no signal, or no engine answered). Google's base
  // map needs nothing from our server, so it is the safe one.
  if (input.routeFailed || input.waitedTooLong) return 'google';
  return null;
}

// Module scope, not component state: the Track tab and the errand card track
// the same errand, and either can unmount (a tab switch, closing the map) while
// the choice must hold. Keyed by errand: each has its own rider and map.
const chosenByErrand = new Map<string, MapStyle>();
// Errands whose map has already moved off an engine that could not route.
const leftForRoutingByErrand = new Set<string>();

/**
 * The map already settled on for this errand, or null. Read before the route
 * is asked for, to name that map's roads in the request.
 */
export function chosenMapFor(errandKey: string | null | undefined): MapStyle | null {
  return errandKey ? chosenByErrand.get(errandKey) ?? null : null;
}

/**
 * The base map to draw for this errand, or null while the first route has not
 * said which. Once it returns a style it keeps returning it, apart from the
 * two moves described at the top.
 */
export function useMapChoice(
  errandKey: string | null | undefined,
  input: Omit<MapChoiceInput, 'wanted' | 'waitedTooLong' | 'leftForRouting'>
): MapStyle | null {
  // Bumped when this hook latches a choice, to render with it.
  const [, setLatched] = useState(0);
  // The errand whose wait ran out, so switching errands starts a fresh wait.
  const [waitedFor, setWaitedFor] = useState<string | null>(null);

  const key = errandKey || null;
  const chosen = chosenMapFor(key);

  useEffect(() => {
    if (chosen || !key) return;
    const timer = setTimeout(() => setWaitedFor(key), MAP_CHOICE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [chosen, key]);

  const next = chooseMapStyle(chosen, {
    ...input,
    wanted: key != null,
    waitedTooLong: key != null && waitedFor === key,
    leftForRouting: key != null && leftForRoutingByErrand.has(key),
  });
  const leavingForRouting = chosen != null && next !== chosen && input.unroutable === engineForMap(chosen);

  useEffect(() => {
    if (!key || !next || next === chosen) return;
    if (leavingForRouting) leftForRoutingByErrand.add(key);
    chosenByErrand.set(key, next);
    setLatched((n) => n + 1);
  }, [key, next, chosen, leavingForRouting]);

  // Returned straight away rather than after the effect, so the map is
  // created with the right type on the very render the answer arrives.
  return next;
}

/** Tests only: forget every errand's choice. */
export function __resetMapChoiceForTests(): void {
  chosenByErrand.clear();
  leftForRoutingByErrand.clear();
}
