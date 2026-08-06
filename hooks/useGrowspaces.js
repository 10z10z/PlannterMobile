import { useQuery } from '@tanstack/react-query';
import {
  fetchGrids,
  fetchGrowspace,
  fetchGrowspaceLights,
  fetchGrowspaces,
  fetchPlants,
  saveGrowspace,
} from '../lib/growspaces';
import { keys } from '../lib/queryKeys';
import { useDataMutation } from './useDataMutation';

/**
 * Growspaces, and the three things hung off each one.
 *
 * A space is read as four queries rather than one join because they change at
 * quite different rates: the tent's name and temperature are edited now and
 * then, its grids less often still, and its plants every time one is watered or
 * dragged a square. Splitting them means rearranging a shelf refetches the
 * plants and leaves the rest of the screen alone.
 *
 * All four sit under `['growspaces', 'detail', id]`, so anything that changes a
 * space wholesale still invalidates the lot with one prefix.
 */

export function useGrowspaces() {
  return useQuery({
    queryKey: keys.growspaces.list(),
    queryFn: fetchGrowspaces,
  });
}

export function useGrowspace(growspaceId) {
  return useQuery({
    queryKey: keys.growspaces.detail(growspaceId),
    queryFn: () => fetchGrowspace(growspaceId),
    enabled: !!growspaceId,
  });
}

export function useGrowspacePlants(growspaceId) {
  return useQuery({
    queryKey: keys.growspaces.plants(growspaceId),
    queryFn: () => fetchPlants(growspaceId),
    // Nothing to ask for until a space has been picked — a feeding dialog opens
    // before one is chosen, and a query with no id would fetch every plant.
    enabled: !!growspaceId,
  });
}

export function useGrowspaceGrids(growspaceId) {
  return useQuery({
    queryKey: keys.growspaces.grids(growspaceId),
    queryFn: () => fetchGrids(growspaceId),
    enabled: !!growspaceId,
  });
}

export function useGrowspaceLights(growspaceId) {
  return useQuery({
    queryKey: keys.growspaces.lights(growspaceId),
    queryFn: () => fetchGrowspaceLights(growspaceId),
    enabled: !!growspaceId,
  });
}

/** @param {{ onSuccess?: (growspace: any) => void }} [options] */
export function useSaveGrowspace({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: saveGrowspace,
    affects: 'growspaceSaved',
    onSuccess,
  });
}
