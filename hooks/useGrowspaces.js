import { useQuery } from '@tanstack/react-query';
import {
  createPlant,
  deletePlant,
  fetchGrids,
  fetchGrowspace,
  fetchGrowspaceLights,
  fetchGrowspaces,
  fetchPlant,
  fetchPlants,
  saveGrowspace,
  updatePlant,
  waterPlant,
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

/**
 * @param {{ onSuccess?: (growspace: any) => void, onError?: (error: any) => void }} [options]
 *   `onError` matters here: a save that got the growspace in but not its grids
 *   throws with the growspace attached, and the form has to remember it so a
 *   retry finishes the job instead of creating a second tent.
 */
export function useSaveGrowspace({ onSuccess, onError } = {}) {
  return useDataMutation({
    mutationFn: saveGrowspace,
    // Lights are counted across growspaces and stations, so assigning one here
    // moves a number on the inventory tab too.
    affects: 'lightsAssigned',
    onSuccess,
    onError,
  });
}

/** One plant, for its own screen. */
export function usePlant(plantId) {
  return useQuery({
    queryKey: keys.plants.detail(plantId),
    queryFn: () => fetchPlant(plantId),
    enabled: !!plantId,
  });
}

/** @param {{ onSuccess?: (plant: any) => void }} [options] */
export function useCreatePlant({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: createPlant,
    // A plant added by hand can claim a container, which the inventory counts.
    affects: 'plantSaved',
    onSuccess,
  });
}

/** @param {{ onSuccess?: (plant: any) => void }} [options] */
export function useUpdatePlant({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: updatePlant,
    affects: 'plantSaved',
    onSuccess,
  });
}

/** @param {{ onSuccess?: (plant: any) => void }} [options] */
export function useWaterPlant({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: waterPlant,
    affects: 'plantWatered',
    onSuccess,
  });
}

/** @param {{ onSuccess?: () => void }} [options] */
export function useDeletePlant({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: deletePlant,
    affects: 'plantDeleted',
    onSuccess,
  });
}
