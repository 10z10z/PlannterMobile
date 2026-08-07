import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Whether there is a connection, read from the same place the queries read it.
 *
 * Deliberately not a second NetInfo subscription. `lib/queryClient.js` already
 * turns NetInfo into `onlineManager`, with a rule about what counts as online
 * that took some care to get right — `isInternetReachable` is the honest signal
 * but is null until the first probe answers. A banner with its own copy of that
 * rule would eventually disagree with the queries it is meant to be explaining,
 * and a banner saying "offline" over a screen that is loading fine is worse than
 * no banner.
 *
 * So there is one definition of online in the app, and this reads it.
 */
export default function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(() => onChange()),
    () => onlineManager.isOnline(),
    // Assumed online before the first NetInfo event lands, which matches how
    // `onlineManager` itself starts.
    () => true
  );
}
