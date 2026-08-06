import { useQuery } from '@tanstack/react-query';
import {
  deleteSowing,
  fetchSowings,
  fetchStation,
  fetchStationLights,
  fetchStations,
  saveStation,
} from '../lib/germination';
import { keys } from '../lib/queryKeys';
import { useDataMutation } from './useDataMutation';

/**
 * Germination stations and what is sown in them.
 *
 * Split the same way growspaces are: the station's own row, the lights over it
 * and the sowings inside it are three reads, because marking one cell
 * germinated shouldn't re-read the fixtures hanging above it.
 */

export function useStations() {
  return useQuery({
    queryKey: keys.stations.list(),
    queryFn: fetchStations,
  });
}

export function useStation(stationId) {
  return useQuery({
    queryKey: keys.stations.detail(stationId),
    queryFn: () => fetchStation(stationId),
    enabled: !!stationId,
  });
}

export function useStationSowings(stationId) {
  return useQuery({
    queryKey: keys.stations.sowings(stationId),
    queryFn: () => fetchSowings(stationId),
    enabled: !!stationId,
  });
}

export function useStationLights(stationId) {
  return useQuery({
    queryKey: keys.stations.lights(stationId),
    queryFn: () => fetchStationLights(stationId),
    enabled: !!stationId,
  });
}

/** @param {{ onSuccess?: () => void }} [options] */
export function useDeleteSowing({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: deleteSowing,
    // The tray it was in goes back to being free, which the inventory counts.
    affects: 'sowingDeleted',
    onSuccess,
  });
}

/**
 * @param {{ onSuccess?: (station: any) => void, onError?: (error: any) => void }} [options]
 *   `onError` matters here: a save that got the station in but not its lights
 *   throws with the station attached, and the form has to remember it so that
 *   pressing save again finishes the job instead of creating a second station.
 */
export function useSaveStation({ onSuccess, onError } = {}) {
  return useDataMutation({
    mutationFn: saveStation,
    // Not just the stations: a light's "in use" is summed across growspaces and
    // stations, so assigning one here moves a number on the inventory tab.
    affects: 'stationSaved',
    onSuccess,
    onError,
  });
}
