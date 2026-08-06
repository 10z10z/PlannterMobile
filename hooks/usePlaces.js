import { useQuery } from '@tanstack/react-query';
import { fetchPlaces } from '../lib/places';
import { keys } from '../lib/queryKeys';

/**
 * Growspaces and germination stations as one list.
 *
 * Several screens ask "where?" and mean either — a feeding goes to a tent or to
 * a station, a planned sowing names one of each. Read through a single cache
 * entry so opening three dialogs in a row doesn't fetch the same two tables
 * three times.
 */
export function usePlaces() {
  return useQuery({
    queryKey: keys.places.list(),
    queryFn: fetchPlaces,
  });
}
