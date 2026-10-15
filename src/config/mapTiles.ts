import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { API_BASE_URL } from './api';

/**
 * Our own OpenStreetMap tile server (server/gis/docker-compose.tiles.yml),
 * behind nginx on this app's API host.
 *
 * The Track map shows it when the rider's route was drawn on OpenStreetMap's
 * roads, so the customer sees the same map, and the same line on it, as the
 * rider (the server decides; see TrackTab). Not tile.openstreetmap.org, whose
 * usage policy forbids apps from relying on it.
 */
export const OSM_TILE_URL = `${API_BASE_URL}/tiles/{z}/{x}/{y}.png`;

/** The server renders to 19; the map may zoom one further and scale up. */
export const OSM_MAX_NATIVE_ZOOM = 19;
export const OSM_MAX_ZOOM = 20;

/** Required by the OpenStreetMap licence wherever its map is shown. */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

/**
 * Tiles kept on the phone: a street already seen loads with no signal and
 * costs no data the second time. Null in Expo Go, which disables the cache.
 */
export const OSM_TILE_CACHE_PATH: string | null = (() => {
  const pkg = Constants.expoConfig?.android?.package;
  return pkg ? `/data/user/0/${pkg}/cache/osm-tiles` : null;
})();

/** A week. The data changes only when the extract is rebuilt. */
export const OSM_TILE_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** The z12 tile over Tacurong: small, always rendered, proves the server is up. */
const PROBE_URL = OSM_TILE_URL.replace('{z}', '12').replace('{x}', '3466').replace('{y}', '1971');
const PROBE_TIMEOUT_MS = 6000;
const PROBE_TTL_MS = 5 * 60 * 1000;

let lastProbe: { at: number; ok: boolean } | null = null;
let inFlight: Promise<boolean> | null = null;

/** Whether the tile server answers. Cached for five minutes either way. */
export async function probeOsmTiles(now: number = Date.now()): Promise<boolean> {
  if (lastProbe && now - lastProbe.at < PROBE_TTL_MS) return lastProbe.ok;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(PROBE_URL, { method: 'GET', signal: controller.signal });
      const type = response.headers.get('content-type') ?? '';
      return response.ok && type.startsWith('image/');
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  })();

  const ok = await inFlight;
  inFlight = null;
  lastProbe = { at: Date.now(), ok };
  return ok;
}

/**
 * True while the OpenStreetMap map can be shown. Starts optimistic so the map
 * does not flash Google first; turns false, and the map falls back to Google,
 * only once the server has actually failed to answer. Asked again every five
 * minutes, so an outage and a recovery are both noticed.
 */
export function useOsmTilesAvailable(wanted: boolean): boolean {
  const [available, setAvailable] = useState(() => lastProbe?.ok ?? true);

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    const check = () =>
      void probeOsmTiles().then((ok) => {
        if (!cancelled) setAvailable(ok);
      });
    check();
    const timer = setInterval(check, PROBE_TTL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [wanted]);

  return available;
}
