import { supabase } from './supabase';

/**
 * Everywhere something can be planned or fed, as one list.
 *
 * Growspaces and germination stations are separate tables and separate columns
 * on every row that points at them, but to a grower they are just the places
 * things are growing. Now that one calendar covers both, the forms it opens have
 * to let either be picked, so the two are read together and each carries the
 * type that decides which column it will be written to.
 */

export function placeIcon(type) {
  return type === 'station' ? 'sprout-outline' : 'flower-outline';
}

export function placeLabel(type) {
  return type === 'station' ? 'station' : 'growspace';
}

/** The id fields a place fills in on `scheduled_actions` or `feedings`. */
export function placeIds(place) {
  return {
    growspaceId: place?.type === 'growspace' ? place.id : null,
    stationId: place?.type === 'station' ? place.id : null,
  };
}

/** The place a row already points at, whichever column it used. */
export function placeOf(places, row) {
  if (!row) return null;
  const id = row.growspace_id ?? row.station_id;
  return places.find((place) => place.id === id) ?? null;
}

/**
 * Growspaces first, then stations, each in the order they were made — the same
 * order the two overview screens list them in.
 */
export async function fetchPlaces() {
  const [growspaces, stations] = await Promise.all([
    supabase.from('growspaces').select('id, name').order('created_at'),
    supabase.from('germination_stations').select('id, name').order('created_at'),
  ]);

  return [
    ...(growspaces.data ?? []).map((row) => ({ ...row, type: 'growspace' })),
    ...(stations.data ?? []).map((row) => ({ ...row, type: 'station' })),
  ];
}
