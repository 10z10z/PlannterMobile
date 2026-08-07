jest.mock('../supabase');

import { fake } from '../../test/fakeSupabase';
import { endExpiredSession, resetSessionGuard } from '../sessionGuard';

/**
 * The decision, on its own: does this failure mean the session is over, and if
 * so, end it.
 *
 * Kept out of `lib/queryClient.js` so it can be asked that question directly.
 * The wiring there is one call in a cache callback; the judgement is here, and
 * the judgement is the part that can be wrong — signing out on the wrong error
 * would throw away someone's session because a row was missing.
 */

const expired = { code: 'PGRST301', message: 'JWT expired' };

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('endExpiredSession', () => {
  beforeEach(() => {
    fake.reset();
    resetSessionGuard();
  });

  it('signs out when the server has stopped accepting the token', async () => {
    expect(endExpiredSession(expired)).toBe(true);
    await settle();

    // Signing out is the whole mechanism: AuthProvider is listening for it and
    // RootNavigator swaps to the login stack. Nothing navigates directly.
    expect(fake.client.auth.signOut).toHaveBeenCalled();
  });

  it('leaves every other failure alone', async () => {
    const others = [
      { code: '23505', message: 'duplicate key value violates unique constraint' },
      { code: 'PGRST116', message: 'no rows returned' },
      { code: 'invalid_credentials', message: 'Invalid login credentials' },
      new TypeError('Network request failed'),
      null,
    ];

    for (const error of others) {
      expect(endExpiredSession(error)).toBe(false);
    }
    await settle();

    // A missing row or a bad password must never cost a session. This is the
    // assertion that stops a widened `isAuthExpired` signing people out.
    expect(fake.client.auth.signOut).not.toHaveBeenCalled();
  });

  it('signs out once when a screenful of queries fails together', async () => {
    // Five parallel reads share one dead token, so they all fail the same way
    // within a frame of each other. Five sign-outs would be five SIGNED_OUT
    // events, each emptying a cache the last one already emptied.
    for (let i = 0; i < 5; i += 1) expect(endExpiredSession(expired)).toBe(true);
    await settle();

    expect(fake.client.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('is ready again once the sign-out has finished', async () => {
    endExpiredSession(expired);
    await settle();
    endExpiredSession(expired);
    await settle();

    expect(fake.client.auth.signOut).toHaveBeenCalledTimes(2);
  });
});
