import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateFor } from '../lib/queryKeys';

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
 * @param {(data: TData, variables: TVariables) => void | Promise<void>} [params.onSuccess]
 *   Anything this particular caller wants afterwards — closing its dialog,
 *   showing a message. Runs once the caches are already marked stale.
 */
export function useDataMutation({ mutationFn, affects, onSuccess }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      // Awaited before the caller's own handler so that a dialog closing onto a
      // list finds a refetch already under way, rather than the stale row it
      // just changed sitting there until the next focus.
      await invalidateFor(queryClient, affects);
      await onSuccess?.(data, variables);
    },
  });
}
