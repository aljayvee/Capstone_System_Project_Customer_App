import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  fetchBackendMerchantCategories,
  BackendMerchantCategory,
} from '../services/merchantCategories';
import { getSocket } from '../services/socketClient';

/**
 * The active merchant categories, kept current without the customer doing
 * anything.
 *
 * Every screen that needed the catalogue used to fetch it once on mount and
 * then never again. That is why deactivating a category in the owner portal did
 * not remove it from the Bento grid: the app had already loaded the list and
 * nothing existed to tell it otherwise. Leaving the tab and coming back
 * remounted the screen, which is why a manual refresh appeared to "fix" it.
 *
 * Two things keep it fresh now:
 *
 *  - `merchant-category:changed`, broadcast by the server whenever a category is
 *    created, edited, activated, deactivated, or has its photo changed. The
 *    payload is only a signal; the list is re-fetched through the endpoint that
 *    applies the active-only filter server-side, so the client never has to
 *    reimplement that rule.
 *  - A reconnect, because any change made while the socket was down was missed
 *    entirely and no further event is coming to announce it.
 *
 * State lives at module scope rather than per-component. The Home grid and the
 * "See More" sheet are mounted at the same time and both need this list; a
 * per-component fetch meant two identical requests on every Home mount and,
 * worse, two independent copies that could disagree about which categories
 * exist — exactly the inconsistency this hook is supposed to remove.
 */

let cachedCategories: BackendMerchantCategory[] = [];
let hasLoaded = false;
let inFlight: Promise<BackendMerchantCategory[]> | null = null;
const subscribers = new Set<(items: BackendMerchantCategory[]) => void>();
let socketWired = false;

function publish(items: BackendMerchantCategory[]) {
  cachedCategories = items;
  hasLoaded = true;
  subscribers.forEach((notify) => notify(items));
}

/** Single-flight: concurrent callers share one request rather than racing. */
function loadCategories(): Promise<BackendMerchantCategory[]> {
  if (!inFlight) {
    inFlight = fetchBackendMerchantCategories()
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        publish(list);
        return list;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Attach the realtime listeners once for the whole app.
 *
 * Deliberately failure-tolerant: the catalogue must render from HTTP even when
 * the socket cannot connect at all. Realtime is what keeps the list current, not
 * what makes it appear.
 */
function ensureSocketWired() {
  if (socketWired) return;
  socketWired = true;

  void getSocket()
    .then((socket) => {
      const resync = () => {
        void loadCategories();
      };
      socket.on('merchant-category:changed', resync);
      // A change that landed while this device was offline produced an event
      // nobody here received. Re-syncing on reconnect closes that window.
      socket.on('connect', resync);
    })
    .catch(() => {
      // Allow a later mount to try again rather than wiring off permanently.
      socketWired = false;
    });
}

export function useMerchantCategories() {
  const [categories, setCategories] = useState<BackendMerchantCategory[]>(cachedCategories);
  const [isLoading, setIsLoading] = useState(!hasLoaded);

  const reload = useCallback(() => loadCategories(), []);

  useEffect(() => {
    let active = true;

    const onChange = (items: BackendMerchantCategory[]) => {
      if (active) setCategories(items);
    };
    subscribers.add(onChange);

    ensureSocketWired();

    void loadCategories().finally(() => {
      if (active) setIsLoading(false);
    });

    // Belt and braces. The socket is the fast path, not the only one: a
    // handshake can fail, a carrier can block the upgrade, or the app can be
    // resumed after the connection quietly died. Re-syncing whenever the app
    // returns to the foreground means the worst case is a slightly stale grid
    // for as long as the phone was asleep — never a grid that stays wrong until
    // the customer thinks to pull down on it.
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') void loadCategories();
    };
    const appStateSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      active = false;
      subscribers.delete(onChange);
      appStateSub.remove();
    };
  }, []);

  return { categories, isLoading, reload };
}

/** Test seam: drops the shared cache so suites do not leak state into each other. */
export function __resetMerchantCategoriesCache() {
  cachedCategories = [];
  hasLoaded = false;
  inFlight = null;
  subscribers.clear();
  socketWired = false;
}
