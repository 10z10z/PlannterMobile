import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { describeError, isRetryable } from './errors';

/**
 * The cache the whole app reads through, and the two bits of wiring React
 * Native needs before it behaves.
 *
 * TanStack Query was written for the browser, where "the tab came back" and
 * "the network came back" are events it can subscribe to itself. On a phone
 * neither exists, so both are handed to it below — without them, queries never
 * refresh after the app has been in the background and, worse, keep failing
 * against a network that isn't there instead of waiting for one.
 */

/**
 * Foreground and background stand in for a browser tab gaining focus.
 *
 * Web is excluded because there the library's own listener is the better one —
 * it knows about visibility as well as focus.
 */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

/**
 * Whether there is a connection at all.
 *
 * `isInternetReachable` is the honest signal and the one worth waiting for, but
 * it is null until the first probe resolves — during which `isConnected` alone
 * is the best guess available. Reading it as "connected, unless we have been
 * told otherwise" keeps the app usable in that first second rather than
 * declaring itself offline on launch.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
  })
);

/**
 * Logged, never shown.
 *
 * Every failure passes through here on its way to a screen, which is the one
 * place guaranteed to see the raw error before `messageFor` replaces it with a
 * sentence. Development only: a released build has nowhere useful to put this,
 * and shipping it would only slow the device down.
 */
function logFailure(scope) {
  return (error) => {
    if (__DEV__) console.warn(`[${scope}] ${describeError(error)}`);
  };
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: logFailure('query') }),
  mutationCache: new MutationCache({ onError: logFailure('mutation') }),
  defaultOptions: {
    queries: {
      /**
       * Only what could plausibly succeed next time is tried again, and only
       * twice — a unique violation will fail identically however long the
       * screen is left spinning, and saying so quickly is the kinder answer.
       */
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),

      /**
       * Half a minute of trust. This grow belongs to one person on one phone,
       * so what is on screen is almost always current; refetching on every tab
       * change would spend battery to confirm what it already knows. Anything
       * the user changes is invalidated explicitly, which is what actually
       * keeps the screens honest.
       */
      staleTime: 30_000,
      gcTime: 10 * 60_000,

      refetchOnReconnect: true,
      // The app coming back to the foreground is worth a refresh; a stale
      // "due today" list is exactly the thing someone opens the app to check.
      refetchOnWindowFocus: true,
    },
    mutations: {
      /**
       * Never retried. Not one write in this app is idempotent — sowing spends
       * seeds, feeding files an entry, transplanting creates plants — and a
       * dropped connection does not say whether the request arrived. Retrying
       * on a lost *response* would sow the tray twice.
       *
       * So a failed write says so and the grower presses save again, which is
       * both what they would do anyway and the only version of this that can't
       * quietly duplicate their work.
       */
      retry: false,
    },
  },
});
