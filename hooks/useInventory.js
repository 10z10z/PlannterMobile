import { useQuery } from '@tanstack/react-query';
import { shelfFor } from '../lib/inventory';
import { keys } from '../lib/queryKeys';
import { useDataMutation } from './useDataMutation';

/**
 * The inventory shelves, as the tabs consume them.
 *
 * Naming a shelf once picks both the cache key and the functions that fill it,
 * so the two can't drift apart — the failure mode this replaces is a list that
 * reads from one key while its own save writes to another, which shows up only
 * as a tab that won't refresh and gives no hint why.
 *
 * @typedef {import('../lib/inventory').ShelfName} ShelfName
 */

/** @param {ShelfName} name */
export function useInventory(name) {
  return useQuery({
    queryKey: keys.inventory[name](),
    queryFn: () => shelfFor(name).list(),
  });
}

/**
 * @param {ShelfName} name
 * @param {{ onSuccess?: () => void }} [options]
 */
export function useSaveInventoryItem(name, { onSuccess } = {}) {
  return useDataMutation({
    mutationFn: (variables) => shelfFor(name).save(variables),
    // The whole inventory root, not just this shelf: a fertilizer feeds the
    // calculator, a tray is counted by the sowings using it, and a light's
    // "in use" is summed across growspaces and stations.
    affects: 'inventoryChanged',
    onSuccess,
  });
}

/**
 * @param {ShelfName} name
 * @param {{ onSuccess?: () => void }} [options]
 */
export function useDeleteInventoryItem(name, { onSuccess } = {}) {
  return useDataMutation({
    mutationFn: (id) => shelfFor(name).remove(id),
    affects: 'inventoryChanged',
    onSuccess,
  });
}
