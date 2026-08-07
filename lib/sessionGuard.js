import { supabase } from './supabase';
import { isAuthExpired } from './errors';

/**
 * What to do when the server stops accepting the session.
 *
 * A refresh token can die while the app is asleep — revoked, expired, or the
 * account signed out elsewhere. supabase-js notices this on its own *if* it
 * happens to try a refresh; what it doesn't notice is a request going out with
 * a JWT the server has already stopped honouring, which comes back as PGRST301
 * and nothing more. Before this, that failure reached the screen as a sentence
 * saying to sign in again, on a screen with nothing to sign in with. The grower
 * was told the answer and given no way to act on it.
 *
 * Signing out is the whole mechanism: `AuthProvider` is listening, and
 * `RootNavigator` swaps to the login stack the moment the session goes. Nothing
 * here navigates.
 */

/**
 * Guards against a screenful of queries all failing at once. Five parallel
 * reads with the same dead token would otherwise fire five sign-outs and five
 * `SIGNED_OUT` events, each one emptying a cache the last one already emptied.
 */
let ending = false;

/**
 * @param {unknown} error A failure from any query or mutation.
 * @returns {boolean} Whether this was the end of the session.
 */
export function endExpiredSession(error) {
  if (!isAuthExpired(error)) return false;
  if (ending) return true;

  ending = true;
  // Not awaited: this is called from a cache callback, whose job is to observe
  // the failure and get out of the way of the error that is still on its way to
  // the screen.
  Promise.resolve(supabase.auth.signOut()).finally(() => {
    ending = false;
  });
  return true;
}

/** Test seam: the latch outlives a test otherwise, being module state. */
export function resetSessionGuard() {
  ending = false;
}
