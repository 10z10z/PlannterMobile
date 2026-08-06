import { useQuery } from '@tanstack/react-query';
import { fetchSowings, fetchStation, fetchStationLights, fetchStations } from '../lib/germination';
import { keys } from '../lib/queryKeys';

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
