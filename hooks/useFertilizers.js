import { useQuery } from '@tanstack/react-query';
import { deleteFertilizer, fetchFertilizers, saveFertilizer } from '../lib/fertilizers';
import { keys } from '../lib/queryKeys';
import { useDataMutation } from './useDataMutation';

/**
 * The fertilizer shelf, as the screens consume it.
 *
 * This layer exists to keep a cache key and the function that fills it in one
 * place. A screen calling `useQuery` itself can pair the wrong two — read under
 * `['inventory','fertilizers']` and write under `['fertilizers']` — and the bug
 * that follows is a stale list that nothing appears to have caused.
 *
 * It is also the seam that keeps `lib/` free of React, so the shelf can be
 * tested without rendering anything.
 */

export function useFertilizers() {
  return useQuery({
    queryKey: keys.inventory.fertilizers(),
    queryFn: fetchFertilizers,
  });
}

/** @param {{ onSuccess?: () => void }} [options] */
export function useSaveFertilizer({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: saveFertilizer,
    affects: 'inventoryChanged',
    onSuccess,
  });
}

/** @param {{ onSuccess?: () => void }} [options] */
export function useDeleteFertilizer({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: deleteFertilizer,
    // Not just the shelf: the calculator reads its products from here, and a
    // recorded feeding names the fertilizer it used.
    affects: 'inventoryChanged',
    onSuccess,
  });
}
