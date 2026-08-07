jest.mock('../../lib/supabase');

import { Text } from 'react-native-paper';
import { fake } from '../../test/fakeSupabase';
import { act, createTestQueryClient, renderWithProviders, screen } from '../../test/render';
import { useAuth } from '../AuthContext';

/**
 * Two things that only happen when a session ends, and neither of which is
 * visible from the auth call that ended it.
 *
 * The first is telling a sign-out somebody asked for apart from one that
 * happened to them. They arrive at the same screen by the same event, so the
 * only thing that distinguishes them is whether this app was the one that
 * asked — which is why the flag is set by `signOut` rather than read off the
 * event.
 *
 * The second is the cache. It outlives the session by its ten-minute `gcTime`,
 * so without emptying it a second account on the same phone opens onto the
 * first one's growspaces.
 */

function Probe() {
  const { session, sessionExpired, signOut } = useAuth();

  return (
    <>
      <Text testID="state">{sessionExpired ? 'expired' : 'fine'}</Text>
      <Text testID="session">{session ? 'signed in' : 'signed out'}</Text>
      <Text testID="signout" onPress={signOut}>
        Sign out
      </Text>
    </>
  );
}

const state = () => screen.getByTestId('state').props.children;

async function mount() {
  const queryClient = createTestQueryClient();
  // Something in the cache that belongs to whoever is signed in now.
  queryClient.setQueryData(['growspaces', 'list'], [{ id: 'tent-a', name: 'Tent A' }]);

  const view = await renderWithProviders(<Probe />, { queryClient });
  return { ...view, queryClient };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    fake.reset();
  });

  it('flags a sign-out that nobody asked for', async () => {
    await mount();

    // What a dead refresh token looks like from here, whether supabase-js gave
    // up on its own or `sessionGuard` signed out after a rejected request.
    await act(async () => {
      fake.setSession(null);
    });

    expect(state()).toBe('expired');
  });

  it('does not flag the one the grower pressed', async () => {
    await mount();

    await act(async () => {
      screen.getByTestId('signout').props.onPress();
    });

    expect(screen.getByTestId('session').props.children).toBe('signed out');
    // Being told your session expired when you just pressed Sign out is the
    // app not knowing what it did a moment ago.
    expect(state()).toBe('fine');
  });

  it('empties the cache so the next person does not see the last one’s data', async () => {
    const { queryClient } = await mount();

    await act(async () => {
      fake.setSession(null);
    });

    expect(queryClient.getQueryData(['growspaces', 'list'])).toBeUndefined();
  });

  it('empties the cache on a deliberate sign-out too', async () => {
    const { queryClient } = await mount();

    await act(async () => {
      screen.getByTestId('signout').props.onPress();
    });

    expect(queryClient.getQueryData(['growspaces', 'list'])).toBeUndefined();
  });

  it('stops saying it once somebody signs in', async () => {
    await mount();

    await act(async () => {
      fake.setSession(null);
    });
    expect(state()).toBe('expired');

    await act(async () => {
      fake.setSession({ user: { id: 'user-2' }, access_token: 't' });
    });

    expect(state()).toBe('fine');
  });
});
