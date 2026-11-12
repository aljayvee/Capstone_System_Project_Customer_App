import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

/**
 * The rating prompt, on the Track tab (2026-11-06).
 *
 * It used to open only in the dispatcher chat. The Track tab, where the
 * customer watches the delivery finish, drops an errand the moment it is
 * DELIVERED and had no prompt, so a customer watching it saw "All Caught Up!"
 * and nothing to rate, then met the prompt in the chat later.
 *
 * Also the sheet's keyboard safety: with a big keyboard the sheet was squeezed
 * and its comment field and buttons clipped out of reach.
 */

jest.setTimeout(30000);

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    isDark: false,
    colors: {
      primary: '#F62459',
      card: '#FFFFFF',
      border: '#E5E7EB',
      textDark: '#1F2937',
      textGray: '#6B7280',
      textLight: '#9CA3AF',
      textMedium: '#4B5563',
      bgApp: '#F9FAFB',
      bgGray: '#F3F4F6',
      borderLight: '#F3F4F6',
      danger: '#EF4444',
      success: '#10B981',
    },
  }),
}));

// The live map and its data feeds: not what these tests are about.
jest.mock('../hooks/useRiderLiveLocation', () => ({
  useRiderLiveLocation: () => ({ location: null, freshness: 'none', label: '' }),
}));
jest.mock('../hooks/useLiveRoute', () => ({
  useLiveRoute: () => ({
    coordinates: [],
    pickupLegCoordinates: [],
    deliveryLegCoordinates: [],
    distanceMeters: null,
    durationSeconds: null,
    pickupDistanceMeters: null,
    pickupDurationSeconds: null,
    deliveryDistanceMeters: null,
    deliveryDurationSeconds: null,
    nextStopRoadMeters: null,
    degraded: false,
    lineEngine: null,
    unroutable: false,
  }),
}));
jest.mock('../config/mapTiles', () => ({ useOsmTilesAvailable: () => true }));
jest.mock('../config/mapChoice', () => ({
  chosenMapFor: () => null,
  engineForMap: () => 'osrm',
  useMapChoice: () => null,
}));
jest.mock('../components/LiveTrackingMap', () => () => null);
jest.mock('../components/RiderToStorePanel', () => () => null);
jest.mock('../components/DeliveryHoldNote', () => () => null);

import TrackTab from '../screens/portal/TrackTab';
import { RatingModal } from '../components/RatingModal';
import {
  deliveryRatingCandidates,
  resetDeliveryRatingPromptMemory,
  RATING_PROMPT_WINDOW_MS,
} from '../hooks/useDeliveryRatingPrompt';
import { Spacing } from '../config/theme';

const HOUR = 60 * 60 * 1000;
const agoIso = (ms: number) => new Date(Date.now() - ms).toISOString();

const delivered = (id: string, over: Record<string, any> = {}) => ({
  id,
  orderId: id,
  referenceNo: `261106-ABCDE-${id.replace(/\D/g, '').padStart(4, '0')}`,
  status: 'DELIVERED',
  riderId: 9,
  riderName: 'Rico Rider',
  createdAt: agoIso(HOUR),
  pinpoints: [{ storeName: 'Corner Bakery' }],
  ...over,
});

const onTheWay = (id: string) => ({
  ...delivered(id),
  status: 'IN_TRANSIT',
  deliveryAddress: 'Blk 1 Lot 2',
  grandTotal: 250,
  pinpoints: [{ id: 1, storeName: 'Corner Bakery', latitude: 14.6, longitude: 121.0, sequence: 1 }],
});

/** The server's answer to GET /errands/:id/rating, per errand. */
const ratingAnswers = (answers: Record<string, any>) => {
  mockGet.mockImplementation((url: string) => {
    const match = String(url).match(/\/errands\/([^/]+)\/rating$/);
    if (!match) return Promise.resolve({ data: null });
    const answer = answers[match[1]];
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve({ data: answer ?? null });
  });
};

const ratingCalls = () =>
  mockGet.mock.calls.map(([url]) => String(url)).filter((url) => url.endsWith('/rating'));

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

const renderTrack = (props: Record<string, any>) =>
  render(
    <TrackTab
      user={{ id: 1 }}
      navigation={{ navigate: jest.fn() }}
      activeErrands={[]}
      {...props}
    />
  );

beforeEach(() => {
  resetDeliveryRatingPromptMemory();
  mockGet.mockReset();
  mockPost.mockReset();
  ratingAnswers({});
});

describe('which errands may be offered', () => {
  it('takes delivered or completed errands with a rider, placed within the last day, newest first', () => {
    const now = Date.now();
    const list = [
      delivered('E1', { createdAt: new Date(now - 3 * HOUR).toISOString() }),
      delivered('E2', { createdAt: new Date(now - HOUR).toISOString(), status: 'completed' }),
      delivered('E3', { createdAt: new Date(now - RATING_PROMPT_WINDOW_MS - HOUR).toISOString() }), // too old
      delivered('E4', { riderId: null }), // the server refuses a rating without a rider
      delivered('E5', { status: 'IN_TRANSIT' }),
      delivered('E6', { status: 'CANCELLED' }),
      delivered('E7', { createdAt: 'not a date' }),
    ];

    expect(deliveryRatingCandidates(list, now).map((c) => c.errandId)).toEqual(['E2', 'E1']);
  });

  it('names the errand by its stores and reference', () => {
    const [candidate] = deliveryRatingCandidates([
      delivered('E1', { pinpoints: [{ storeName: 'Corner Bakery' }, { storeName: 'Mercury Drug' }] }),
    ]);
    expect(candidate.summary).toBe('Corner Bakery & Mercury Drug · #261106-ABCDE-0001');
  });

  it('treats a fresh errand stamped slightly in the future (phone clock behind) as recent', () => {
    const now = Date.now();
    const ahead = delivered('E1', { createdAt: new Date(now + 5 * 60 * 1000).toISOString() });
    expect(deliveryRatingCandidates([ahead], now)).toHaveLength(1);
  });

  it('copes with no list at all', () => {
    expect(deliveryRatingCandidates(undefined)).toEqual([]);
    expect(deliveryRatingCandidates(null)).toEqual([]);
  });
});

describe('TrackTab: the rating prompt', () => {
  it('asks for a rating on the Track tab once a recent errand is delivered and unrated', async () => {
    const res: any = await renderTrack({ allErrands: [delivered('E1')] });

    expect(await res.findByText('How was your errand?')).toBeTruthy();
    expect(res.getByTestId('rating-errand-summary').props.children).toBe('Corner Bakery · #261106-ABCDE-0001');
    // The empty Track view is still there behind it.
    expect(res.getByText('All Caught Up!')).toBeTruthy();
    expect(ratingCalls()).toEqual(['/errands/E1/rating']);
  });

  it('asks over the live map too, while another errand is still on its way', async () => {
    const res: any = await renderTrack({
      activeErrands: [onTheWay('E2')],
      allErrands: [delivered('E1'), onTheWay('E2')],
    });

    expect(await res.findByText('How was your errand?')).toBeTruthy();
    expect(res.queryByText('All Caught Up!')).toBeNull();
  });

  it('stays quiet for an errand already rated, on this phone or another', async () => {
    ratingAnswers({ E1: { id: 3, stars: 5 } });
    const res: any = await renderTrack({ allErrands: [delivered('E1')] });

    await waitFor(() => expect(ratingCalls()).toEqual(['/errands/E1/rating']));
    await flush();
    expect(res.queryByText('How was your errand?')).toBeNull();
  });

  it('moves past a rated errand to the next unrated one', async () => {
    ratingAnswers({ E1: { id: 3, stars: 5 } });
    const res: any = await renderTrack({
      allErrands: [delivered('E1'), delivered('E2', { createdAt: agoIso(2 * HOUR) })],
    });

    expect(await res.findByText('How was your errand?')).toBeTruthy();
    expect(res.getByTestId('rating-errand-summary').props.children).toBe('Corner Bakery · #261106-ABCDE-0002');
  });

  it('does not ask about old, riderless or undelivered errands', async () => {
    const res: any = await renderTrack({
      allErrands: [
        delivered('E1', { createdAt: agoIso(RATING_PROMPT_WINDOW_MS + HOUR) }),
        delivered('E2', { riderId: null }),
        delivered('E3', { status: 'ACCEPTED' }),
      ],
    });

    await flush();
    expect(ratingCalls()).toEqual([]);
    expect(res.queryByText('How was your errand?')).toBeNull();
  });

  it('holds the prompt while another screen or dialog is in front, then shows it', async () => {
    const errands = [delivered('E1')];
    const res: any = await renderTrack({ allErrands: errands, canPromptRating: false });

    await flush();
    expect(ratingCalls()).toEqual([]);
    expect(res.queryByText('How was your errand?')).toBeNull();

    await res.rerender(
      <TrackTab user={{ id: 1 }} navigation={{ navigate: jest.fn() }} activeErrands={[]} allErrands={errands} canPromptRating />
    );
    expect(await res.findByText('How was your errand?')).toBeTruthy();
  });

  it('hides a sheet already up when something comes in front of it, and keeps the draft', async () => {
    const errands = [delivered('E1')];
    const res: any = await renderTrack({ allErrands: errands });
    await res.findByText('How was your errand?');
    await fireEvent.changeText(res.getByTestId('rating-comment'), 'Fast and friendly');

    // A push tap opening the chat: the sheet is a Modal, a window above every
    // screen, so left up it would float over the chat.
    await res.rerender(
      <TrackTab user={{ id: 1 }} navigation={{ navigate: jest.fn() }} activeErrands={[]} allErrands={errands} canPromptRating={false} />
    );
    await waitFor(() => expect(res.queryByText('How was your errand?')).toBeNull(), { timeout: 3000 });

    await res.rerender(
      <TrackTab user={{ id: 1 }} navigation={{ navigate: jest.fn() }} activeErrands={[]} allErrands={errands} canPromptRating />
    );
    expect(await res.findByText('How was your errand?')).toBeTruthy();
    expect(res.getByTestId('rating-comment').props.value).toBe('Fast and friendly');
    // Shown again from memory, not asked of the server again.
    expect(ratingCalls()).toEqual(['/errands/E1/rating']);
  });

  it('shows nothing when the check fails, and asks again on the next visit', async () => {
    ratingAnswers({ E1: new Error('Network Error') });
    const first: any = await renderTrack({ allErrands: [delivered('E1')] });

    await waitFor(() => expect(ratingCalls()).toHaveLength(1));
    await flush();
    expect(first.queryByText('How was your errand?')).toBeNull();
    await first.unmount();

    ratingAnswers({});
    const second: any = await renderTrack({ allErrands: [delivered('E1')] });
    expect(await second.findByText('How was your errand?')).toBeTruthy();
  });

  it('"Skip for now" closes it, and this app run does not offer it again', async () => {
    const first: any = await renderTrack({ allErrands: [delivered('E1')] });
    await first.findByText('How was your errand?');

    await fireEvent.press(first.getByTestId('rating-skip'));
    await waitFor(() => expect(first.queryByText('How was your errand?')).toBeNull(), { timeout: 3000 });
    expect(mockPost).not.toHaveBeenCalled();
    await first.unmount();

    // Back to the Track tab later in the same run.
    const second: any = await renderTrack({ allErrands: [delivered('E1')] });
    await flush();
    expect(second.queryByText('How was your errand?')).toBeNull();
    expect(ratingCalls()).toEqual(['/errands/E1/rating']);
  });

  it('after a skip, waits for the next visit before offering a second errand', async () => {
    const errands = [delivered('E1'), delivered('E2', { createdAt: agoIso(2 * HOUR) })];
    const first: any = await renderTrack({ allErrands: errands });
    await first.findByText('How was your errand?');

    await fireEvent.press(first.getByTestId('rating-skip'));
    await waitFor(() => expect(first.queryByText('How was your errand?')).toBeNull(), { timeout: 3000 });
    await flush();
    expect(ratingCalls()).toEqual(['/errands/E1/rating']);
    await first.unmount();

    const second: any = await renderTrack({ allErrands: errands });
    expect(await second.findByText('How was your errand?')).toBeTruthy();
    expect(second.getByTestId('rating-errand-summary').props.children).toBe('Corner Bakery · #261106-ABCDE-0002');
  });

  it('submits the rating for that errand, then offers the next delivered one', async () => {
    mockPost.mockResolvedValue({ data: { id: 1, stars: 4 } });
    const errands = [delivered('E1'), delivered('E2', { createdAt: agoIso(2 * HOUR) })];
    const res: any = await renderTrack({ allErrands: errands });
    await res.findByText('How was your errand?');

    await fireEvent.press(res.getByTestId('rating-star-4'));
    await fireEvent.changeText(res.getByTestId('rating-comment'), '  On time  ');
    await fireEvent.press(res.getByTestId('rating-submit'));

    expect(mockPost).toHaveBeenCalledWith('/errands/E1/rating', { stars: 4, comment: 'On time' });
    expect(await res.findByTestId('rating-success')).toBeTruthy();

    await waitFor(
      () => expect(res.getByTestId('rating-errand-summary').props.children).toBe('Corner Bakery · #261106-ABCDE-0002'),
      { timeout: 5000 }
    );
    expect(ratingCalls()).toEqual(['/errands/E1/rating', '/errands/E2/rating']);
  });
});

describe('RatingModal: keyboard-safe', () => {
  const keyboard = require('react-native-keyboard-controller');
  const keyboardAt = (isVisible: boolean) =>
    keyboard.useKeyboardState.mockImplementation((selector: any) => {
      const state = { isVisible, height: isVisible ? 320 : 0, duration: 250, timestamp: 0, target: -1, type: 'default', appearance: 'default' };
      return selector ? selector(state) : state;
    });

  afterEach(() => keyboardAt(false));

  const contentPadding = (res: any) =>
    StyleSheet.flatten(res.getByTestId('rating-scroll').props.contentContainerStyle).paddingBottom;

  it('scrolls rather than clipping, and a tap on Submit with the keyboard up still submits', async () => {
    const res: any = await render(<RatingModal visible errandId="E1" onDone={jest.fn()} />);
    const scroll = res.getByTestId('rating-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(StyleSheet.flatten(res.getByTestId('rating-comment').props.style).maxHeight).toBeGreaterThan(0);
  });

  it('keeps room for the nav bar with the keyboard closed, and gives it back while it is open', async () => {
    keyboardAt(false);
    const closed: any = await render(<RatingModal visible errandId="E1" onDone={jest.fn()} />);
    expect(contentPadding(closed)).toBeGreaterThanOrEqual(Spacing.huge);
    await closed.unmount();

    keyboardAt(true);
    const open: any = await render(<RatingModal visible errandId="E1" onDone={jest.fn()} />);
    expect(contentPadding(open)).toBe(Spacing.md);
  });

  it('reports a skip as a skip', async () => {
    const onDone = jest.fn();
    const res: any = await render(<RatingModal visible errandId="E1" onDone={onDone} />);
    await fireEvent.press(res.getByTestId('rating-skip'));
    expect(onDone).toHaveBeenCalledWith('skipped');
  });
});
