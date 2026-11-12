import { act, renderHook } from '@testing-library/react-native';
import {
  __resetMapChoiceForTests,
  chooseMapStyle,
  chosenMapFor,
  engineForMap,
  lineFitsMap,
  MAP_CHOICE_WAIT_MS,
  useMapChoice,
  type MapChoiceInput,
} from '../config/mapChoice';

/**
 * Each map draws only its own engine's lines: Google's map Google Directions',
 * OpenStreetMap OSRM's. The customer's map is chosen once per errand, from the
 * roads the first route came back on, and never switched in place.
 */

const base: MapChoiceInput = {
  wanted: true,
  lineEngine: null,
  routeFailed: false,
  osmTilesUp: true,
  waitedTooLong: false,
  unroutable: null,
  leftForRouting: false,
};

beforeEach(() => {
  __resetMapChoiceForTests();
});

describe('which lines a map takes', () => {
  it('pairs each map with the engine whose roads it paints', () => {
    expect(engineForMap('google')).toBe('google');
    expect(engineForMap('osm')).toBe('osrm');
  });

  it('refuses another engine\'s road line on either map', () => {
    expect(lineFitsMap('google', 'osrm', false)).toBe(false);
    expect(lineFitsMap('osm', 'google', false)).toBe(false);
  });

  it('takes its own engine\'s line', () => {
    expect(lineFitsMap('google', 'google', false)).toBe(true);
    expect(lineFitsMap('osm', 'osrm', false)).toBe(true);
  });

  it('lets a dashed straight-line guess stand on either map', () => {
    expect(lineFitsMap('google', 'haversine', true)).toBe(true);
    expect(lineFitsMap('osm', null, true)).toBe(true);
  });

  it('has nothing to refuse before there is a map or a known engine', () => {
    expect(lineFitsMap(null, 'osrm', false)).toBe(true);
    expect(lineFitsMap('google', null, false)).toBe(true);
  });
});

describe('chooseMapStyle', () => {
  it('waits for the first route rather than guessing a map', () => {
    expect(chooseMapStyle(null, base)).toBeNull();
  });

  it('shows OpenStreetMap under a route drawn on OSRM\'s roads', () => {
    expect(chooseMapStyle(null, { ...base, lineEngine: 'osrm' })).toBe('osm');
  });

  it('shows Google under a route drawn on Google\'s roads', () => {
    expect(chooseMapStyle(null, { ...base, lineEngine: 'google' })).toBe('google');
  });

  it('shows Google when our tiles are down, even for an OSRM route', () => {
    // The hook then names Google's roads and takes no OSRM line for it.
    expect(chooseMapStyle(null, { ...base, lineEngine: 'osrm', osmTilesUp: false })).toBe('google');
  });

  it('settles on Google when no road route is coming', () => {
    expect(chooseMapStyle(null, { ...base, routeFailed: true })).toBe('google');
    expect(chooseMapStyle(null, { ...base, waitedTooLong: true })).toBe('google');
  });

  it('chooses nothing with no errand to show', () => {
    expect(chooseMapStyle(null, { ...base, wanted: false, lineEngine: 'osrm' })).toBeNull();
  });

  it('keeps a chosen map whatever later routes come back on', () => {
    expect(chooseMapStyle('osm', { ...base, lineEngine: 'google' })).toBe('osm');
    expect(chooseMapStyle('google', { ...base, lineEngine: 'osrm' })).toBe('google');
  });

  it('leaves OpenStreetMap for Google when the tiles stop answering', () => {
    expect(chooseMapStyle('osm', { ...base, osmTilesUp: false })).toBe('google');
  });

  it('moves off a map whose own engine cannot route at all', () => {
    expect(chooseMapStyle('osm', { ...base, unroutable: 'osrm' })).toBe('google');
    expect(chooseMapStyle('google', { ...base, unroutable: 'google' })).toBe('osm');
  });

  it('does not move to OpenStreetMap when its tiles are down', () => {
    expect(chooseMapStyle('google', { ...base, unroutable: 'google', osmTilesUp: false })).toBe('google');
  });

  it('moves for routing only once, so two failing engines cannot swap maps', () => {
    expect(chooseMapStyle('google', { ...base, unroutable: 'osrm' })).toBe('google');
    expect(chooseMapStyle('osm', { ...base, unroutable: 'osrm', leftForRouting: true })).toBe('osm');
  });
});

describe('useMapChoice', () => {
  type Props = { errand: string | null; input: Omit<MapChoiceInput, 'wanted' | 'waitedTooLong' | 'leftForRouting'> };
  const input = (over: Partial<Props['input']> = {}): Props['input'] => ({
    lineEngine: null,
    routeFailed: false,
    osmTilesUp: true,
    unroutable: null,
    ...over,
  });

  it('chooses from the first route and keeps that map for the errand', async () => {
    const { result, rerender } = await renderHook((p: Props) => useMapChoice(p.errand, p.input), {
      initialProps: { errand: 'e1', input: input() },
    });
    expect(result.current).toBeNull();

    await act(async () => {
      await rerender({ errand: 'e1', input: input({ lineEngine: 'osrm' }) });
    });
    expect(result.current).toBe('osm');
    expect(chosenMapFor('e1')).toBe('osm');

    // A later route on the other engine's roads does not change the map.
    await act(async () => {
      await rerender({ errand: 'e1', input: input({ lineEngine: 'google' }) });
    });
    expect(result.current).toBe('osm');
  });

  it('keeps each errand\'s own map', async () => {
    const { result, rerender } = await renderHook((p: Props) => useMapChoice(p.errand, p.input), {
      initialProps: { errand: 'e1', input: input({ lineEngine: 'osrm' }) },
    });
    expect(result.current).toBe('osm');

    await act(async () => {
      await rerender({ errand: 'e2', input: input({ lineEngine: 'google' }) });
    });
    expect(result.current).toBe('google');
    expect(chosenMapFor('e1')).toBe('osm');
    expect(chosenMapFor('e2')).toBe('google');
  });

  it('shares the choice with every view of the same errand', async () => {
    await renderHook(() => useMapChoice('e1', input({ lineEngine: 'osrm' })));
    // The errand card opens later, and its own first answer is on Google's roads.
    const { result } = await renderHook(() => useMapChoice('e1', input({ lineEngine: 'google' })));
    expect(result.current).toBe('osm');
  });

  it('settles on Google after waiting too long for a route', async () => {
    jest.useFakeTimers();
    try {
      const { result } = await renderHook(() => useMapChoice('e1', input()));
      expect(result.current).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(MAP_CHOICE_WAIT_MS);
      });
      expect(result.current).toBe('google');
    } finally {
      jest.useRealTimers();
    }
  });

  it('moves off an unroutable engine once per errand, then stays', async () => {
    const { result, rerender } = await renderHook((p: Props) => useMapChoice(p.errand, p.input), {
      initialProps: { errand: 'e1', input: input({ lineEngine: 'google' }) },
    });
    expect(result.current).toBe('google');

    await act(async () => {
      await rerender({ errand: 'e1', input: input({ lineEngine: 'google', unroutable: 'google' }) });
    });
    expect(result.current).toBe('osm');

    // OSRM cannot route either: the map does not swap back.
    await act(async () => {
      await rerender({ errand: 'e1', input: input({ lineEngine: null, unroutable: 'osrm' }) });
    });
    expect(result.current).toBe('osm');
  });
});
