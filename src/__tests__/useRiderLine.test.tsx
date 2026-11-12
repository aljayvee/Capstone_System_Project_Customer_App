import { act, renderHook, waitFor } from '@testing-library/react-native';
import { RIDER_LINE_POLL_MS, useRiderLine } from '../hooks/useRiderLine';

const mockGet = jest.fn();
jest.mock('../services/apiClient', () => ({
  apiClient: { get: (...args: any[]) => mockGet(...args) },
}));

// A socket whose handlers the tests can fire.
const mockHandlers: Record<string, Array<(...args: any[]) => void>> = {};
const mockSocket = {
  on: jest.fn((event: string, handler: (...args: any[]) => void) => {
    (mockHandlers[event] ??= []).push(handler);
  }),
  off: jest.fn((event: string, handler: (...args: any[]) => void) => {
    mockHandlers[event] = (mockHandlers[event] ?? []).filter((h) => h !== handler);
  }),
};
jest.mock('../services/socketClient', () => ({
  getSocket: () => Promise.resolve(mockSocket),
}));

const fire = (event: string, payload?: unknown) => (mockHandlers[event] ?? []).forEach((h) => h(payload));

const route = (version: number) => ({
  riderId: 7,
  version,
  at: 1,
  reroutedAt: version > 1 ? 99 : null,
  target: { latitude: 6.7, longitude: 124.67 },
  coordinates: [
    { latitude: 6.69, longitude: 124.67 },
    { latitude: 6.7, longitude: 124.67 },
  ],
  distanceMeters: 1100,
  durationSeconds: 200,
  lineEngine: 'osrm',
});

beforeEach(() => {
  jest.useFakeTimers();
  mockGet.mockReset();
  Object.keys(mockHandlers).forEach((key) => delete mockHandlers[key]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useRiderLine', () => {
  it('asks for nothing until it is wanted', async () => {
    await renderHook(() => useRiderLine('errand-1', false));
    await act(async () => {});
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches the rider\'s line for this errand', async () => {
    mockGet.mockResolvedValue({ data: { route: route(1) } });
    const { result } = await renderHook(() => useRiderLine('errand-1', true));

    await waitFor(() => expect(result.current?.version).toBe(1));
    expect(mockGet).toHaveBeenCalledWith('/routing/rider-route', { params: { errandId: 'errand-1' } });
    expect(result.current?.lineEngine).toBe('osrm');
    expect(result.current?.coordinates).toHaveLength(2);
  });

  it('fetches again on a notice about this errand, saying which line it holds', async () => {
    mockGet.mockResolvedValueOnce({ data: { route: route(1) } }).mockResolvedValue({ data: { route: route(2) } });
    const { result } = await renderHook(() => useRiderLine('errand-1', true));
    await waitFor(() => expect(result.current?.version).toBe(1));
    await waitFor(() => expect(mockHandlers['rider:route']?.length).toBe(1));

    await act(async () => fire('rider:route', { version: 2, errandIds: ['errand-1'] }));

    await waitFor(() => expect(result.current?.version).toBe(2));
    expect(result.current?.reroutedAt).toBe(99);
    expect(mockGet).toHaveBeenLastCalledWith('/routing/rider-route', { params: { errandId: 'errand-1', since: 1 } });
  });

  it('ignores a notice about another errand, or about the line it already holds', async () => {
    mockGet.mockResolvedValue({ data: { route: route(1) } });
    const { result } = await renderHook(() => useRiderLine('errand-1', true));
    await waitFor(() => expect(result.current?.version).toBe(1));
    await waitFor(() => expect(mockHandlers['rider:route']?.length).toBe(1));

    await act(async () => {
      fire('rider:route', { version: 2, errandIds: ['errand-9'] });
      fire('rider:route', { version: 1, errandIds: ['errand-1'] });
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('keeps the line it holds when told nothing changed, or when a read fails', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { route: route(1) } })
      .mockResolvedValueOnce({ data: { route: null, unchanged: true } })
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useRiderLine('errand-1', true));
    await waitFor(() => expect(result.current?.version).toBe(1));

    await act(async () => {
      jest.advanceTimersByTime(RIDER_LINE_POLL_MS);
    });
    await act(async () => {
      jest.advanceTimersByTime(RIDER_LINE_POLL_MS);
    });

    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(result.current?.version).toBe(1);
  });

  it('lets go of the line when the server has none to show', async () => {
    mockGet.mockResolvedValueOnce({ data: { route: route(1) } }).mockResolvedValue({ data: { route: null } });
    const { result } = await renderHook(() => useRiderLine('errand-1', true));
    await waitFor(() => expect(result.current?.version).toBe(1));

    await act(async () => {
      jest.advanceTimersByTime(RIDER_LINE_POLL_MS);
    });

    await waitFor(() => expect(result.current).toBeNull());
  });

  it('stops listening when it is no longer wanted', async () => {
    mockGet.mockResolvedValue({ data: { route: route(1) } });
    const { result, rerender } = await renderHook(({ enabled }: { enabled: boolean }) => useRiderLine('errand-1', enabled), {
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(result.current?.version).toBe(1));
    await waitFor(() => expect(mockHandlers['rider:route']?.length).toBe(1));

    await act(async () => {
      await rerender({ enabled: false });
    });

    expect(result.current).toBeNull();
    expect(mockHandlers['rider:route']).toHaveLength(0);
  });
});
