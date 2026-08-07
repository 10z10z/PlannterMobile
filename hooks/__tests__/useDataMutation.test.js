import { act, waitFor } from '@testing-library/react-native';
import { createTestQueryClient, renderHookWithProviders } from '../../test/render';
import { keys } from '../../lib/queryKeys';
import { useDataMutation } from '../useDataMutation';

/**
 * The optimistic half, which is the part with something to get wrong.
 *
 * The invalidation half is covered wherever a mutation is driven through a
 * screen — every dialog test in the suite goes through it. What no screen test
 * can show is the window between the press and the reply, which is the entire
 * reason this exists, or what is left behind when the reply is a failure.
 *
 * The design worth holding to: a caller supplies the edit and nothing else. The
 * snapshot is taken from what the action declares it `affects`, so rollback
 * can't drift from the update, and an optimistic write is only ever as wrong as
 * its `affects` already was.
 */

const PLANT = keys.plants.detail('plant-1');
const before = { id: 'plant-1', name: 'Basil', last_watered_at: '2026-08-01T09:00:00.000Z' };

const optimistic = (queryClient) =>
  queryClient.setQueryData(PLANT, (current) => ({
    ...current,
    last_watered_at: '2026-08-07T09:00:00.000Z',
  }));

const wateredAt = (queryClient) =>
  /** @type {any} */ (queryClient.getQueryData(PLANT))?.last_watered_at;

async function mountMutation({ mutationFn, ...rest }) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(PLANT, before);

  const { result } = await renderHookWithProviders(
    () => useDataMutation({ mutationFn, affects: 'plantWatered', ...rest }),
    { queryClient }
  );

  return { result, queryClient };
}

describe('useDataMutation', () => {
  it('moves the screen before the write has landed', async () => {
    // Held open deliberately, and let go before the test ends — a promise that
    // never settles keeps the mutation pending, and jest's worker with it.
    let land;
    const inFlight = new Promise((resolve) => {
      land = resolve;
    });

    const mutationFn = jest.fn(() => inFlight);
    const { result, queryClient } = await mountMutation({ mutationFn, optimistic });

    await act(async () => {
      result.current.mutate({});
    });

    // The write has been sent and has not answered — `inFlight` is not released
    // until the end of this test. This is the frame the grower sees, and the
    // whole point: a tap whose effect waits on a round trip reads as one that
    // missed.
    expect(mutationFn).toHaveBeenCalled();
    expect(wateredAt(queryClient)).toBe('2026-08-07T09:00:00.000Z');

    await act(async () => {
      land({});
      await inFlight;
    });
  });

  it('keeps the edit when the write succeeds', async () => {
    const { result, queryClient } = await mountMutation({
      mutationFn: async () => ({ ok: true }),
      optimistic,
    });

    await act(async () => {
      await result.current.mutateAsync({});
    });

    expect(wateredAt(queryClient)).toBe('2026-08-07T09:00:00.000Z');
  });

  it('puts back exactly what was there when the write fails', async () => {
    const { result, queryClient } = await mountMutation({
      mutationFn: async () => {
        throw new Error('connection failure');
      },
      optimistic,
    });

    await act(async () => {
      await result.current.mutateAsync({}).catch(() => {});
    });

    // Not "close to what was there" — the same object's values. The rollback is
    // a snapshot rather than an inverse of the edit, so a caller can't write an
    // undo that doesn't quite undo.
    expect(queryClient.getQueryData(PLANT)).toEqual(before);
  });

  it('rolls back everything the action claims to touch, not just what was edited', async () => {
    const { result, queryClient } = await mountMutation({
      mutationFn: async () => {
        throw new Error('connection failure');
      },
      // Two trees, both named by `plantWatered`. A caller that edits three
      // caches doesn't have to remember three undos.
      optimistic: (client) => {
        optimistic(client);
        client.setQueryData(keys.dashboard.summary('2026-08-07'), { thirsty: 0 });
      },
    });

    queryClient.setQueryData(keys.dashboard.summary('2026-08-07'), { thirsty: 3 });

    await act(async () => {
      await result.current.mutateAsync({}).catch(() => {});
    });

    expect(queryClient.getQueryData(keys.dashboard.summary('2026-08-07'))).toEqual({ thirsty: 3 });
  });

  it('leaves the cache alone for a mutation with no optimistic edit', async () => {
    const { result, queryClient } = await mountMutation({
      mutationFn: async () => {
        throw new Error('connection failure');
      },
    });

    await act(async () => {
      await result.current.mutateAsync({}).catch(() => {});
    });

    // No snapshot was taken, so there is nothing to restore — and the restore
    // loop has to cope with that rather than throwing on an absent context.
    expect(queryClient.getQueryData(PLANT)).toEqual(before);
  });

  it('still tells the caller the write failed', async () => {
    const onError = jest.fn();
    const { result } = await mountMutation({
      mutationFn: async () => {
        throw new Error('connection failure');
      },
      optimistic,
      onError,
    });

    await act(async () => {
      await result.current.mutateAsync({}).catch(() => {});
    });

    // Rolling the screen back is not the same as saying so. The dialogs read
    // `mutation.error`, and this must keep reaching them.
    expect(onError).toHaveBeenCalled();
    // Waited for rather than read once: the render carrying the error state is
    // a commit behind the rejection, because `onError` awaits the invalidation
    // before the mutation settles.
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
