import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AFFECTED_BY, invalidateFor } from '../lib/queryKeys';

/**
 * A write, plus the one thing every write in this app has to remember.
 *
 * Any mutation that doesn't invalidate leaves a screen somewhere showing the
 * old number — the seed pack that still reads 40 after sowing 24 of them, the
 * dashboard still listing a job that was ticked off. Rather than trust two
 * dozen call sites to each recall which caches they dirtied, a mutation names
 * the *action* it performs and `AFFECTED_BY` in `lib/queryKeys.js` decides what
 * that means.
 *
 * The payoff is that adding a screen never means revisiting the invalidation:
 * a second way to record a feeding invalidates exactly what the first one did,
 * because they both say `feedingRecorded`.
 *
 * @template TData, TVariables
 * @param {object} params
 * @param {(variables: TVariables) => Promise<TData>} params.mutationFn
 * @param {keyof typeof import('../lib/queryKeys').AFFECTED_BY} params.affects
 *   Which action this is, in the data's own terms.
 * @param {(queryClient: import('@tanstack/react-query').QueryClient, variables: TVariables) => void}
 *   [params.optimistic] Move the screen before the write lands. For the actions
 *   cheap enough that waiting on a round trip is the whole cost of doing them —
 *   ticking a job off, watering a plant. See the note above the snapshot below
 *   for why rollback needs nothing from the caller.
 * @param {(data: TData, variables: TVariables) => void | Promise<void>} [params.onSuccess]
 *   Anything this particular caller wants afterwards — closing its dialog,
 *   showing a message. Runs once the caches are already marked stale.
 * @param {(error: any, variables: TVariables) => void} [params.onError]
 *   For the writes that can half-succeed. A caller that needs to remember what
 *   *did* land — so a retry finishes the job rather than starting a second one —
 *   reads it off the error here. Showing the message is not this: every screen
 *   already renders `messageFor(mutation.error)`.
 */
export function useDataMutation({ mutationFn, affects, optimistic, onSuccess, onError }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    onMutate: optimistic
      ? async (variables) => {
          const affected = AFFECTED_BY[affects];

          // A refetch already in flight would land after the edit below and
          // put back what the server said before the write — the tick coming
          // undone a second after it was made, which reads as the app losing
          // the press rather than as a slow network.
          await Promise.all(affected.map((queryKey) => queryClient.cancelQueries({ queryKey })));

          /**
           * Everything the action declares it touches — which is, by
           * definition, everything the edit below is allowed to touch. So the
           * rollback is exact and the caller writes none of it: an optimistic
           * update here can only be as wrong as its `affects` is, and that is
           * already the thing every mutation has to get right.
           */
          const snapshot = affected.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));

          optimistic(queryClient, variables);
          return { snapshot };
        }
      : undefined,

    onSuccess: async (data, variables) => {
      // Awaited before the caller's own handler so that a dialog closing onto a
      // list finds a refetch already under way, rather than the stale row it
      // just changed sitting there until the next focus.
      await invalidateFor(queryClient, affects);
      await onSuccess?.(data, variables);
    },

    onError: async (error, variables, context) => {
      // Put back exactly what was there, before the refetch rather than
      // instead of it: restoring is instant and the invalidation below is what
      // makes it true.
      for (const [queryKey, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      // A half-failed write still changed something, so the caches are stale
      // whichever way it ended.
      await invalidateFor(queryClient, affects);
      onError?.(error, variables);
    },
  });
}
