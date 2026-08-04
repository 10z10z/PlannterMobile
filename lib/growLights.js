import { supabase } from './supabase';

export const LIGHT_TYPES = [
  { value: 'led', label: 'LED' },
  { value: 'cfl', label: 'CFL' },
  { value: 't5', label: 'T5' },
  { value: 'hps', label: 'HPS' },
  { value: 'mh', label: 'MH' },
  { value: 'cmh', label: 'CMH/LEC' },
  { value: 'floodlight', label: 'Floodlight' },
  { value: 'other', label: 'Other' },
];

export const SPECTRUMS = [
  { value: 'full', label: 'Full spectrum' },
  { value: 'veg', label: 'Veg' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'white_red', label: 'White + red' },
  { value: 'other', label: 'Other' },
];

export function lightTypeLabel(type) {
  return LIGHT_TYPES.find((entry) => entry.value === type)?.label ?? 'LED';
}

export function spectrumLabel(spectrum) {
  return SPECTRUMS.find((entry) => entry.value === spectrum)?.label ?? null;
}

/**
 * Whether a colour temperature means anything for this type.
 *
 * Discharge lamps emit whatever their chemistry gives them — an HPS is always
 * around 2000K and a metal halide around 4000K — so asking for a figure there
 * invites a made-up one. Everything that emits white light to a design is fair
 * game.
 */
export function hasColorTemp(type) {
  return type !== 'hps' && type !== 'mh';
}

/**
 * Grow lights plus how many of each group are hanging somewhere. The count is
 * summed from the assignment rows rather than stored, so it can't drift out of
 * sync with where the lights actually are — over a growspace or over a
 * germination station, both of which draw from the same shelf.
 */
export async function fetchGrowLightsWithUsage() {
  const [{ data: lights, error }, { data: overGrowspaces }, { data: overStations }] =
    await Promise.all([
      supabase.from('grow_lights').select('*').order('created_at', { ascending: false }),
      supabase.from('growspace_lights').select('grow_light_id, quantity'),
      supabase.from('station_lights').select('grow_light_id, quantity'),
    ]);

  if (error) throw error;

  const usage = new Map();
  for (const row of [...(overGrowspaces ?? []), ...(overStations ?? [])]) {
    usage.set(row.grow_light_id, (usage.get(row.grow_light_id) ?? 0) + row.quantity);
  }

  return (lights ?? []).map((light) => ({
    ...light,
    inUse: usage.get(light.id) ?? 0,
  }));
}
