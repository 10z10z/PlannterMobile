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

/** Drops trailing zeroes so 3500.0 reads as 3500 and 4.5 stays 4.5. */
function trim(value) {
  return String(Math.round(Number(value) * 10) / 10);
}

/**
 * "18/6" — hours lit against hours dark. Null when no cycle has been set, and
 * "24/0" is a real answer for a propagator run around the clock, so zero off
 * hours is kept rather than treated as unset.
 */
/**
 * A typed run cycle as a number for storage, or null when the field is empty.
 *
 * The form keeps whatever was typed rather than a number, so that half-finished
 * input survives: coercing on each keystroke turns "18." straight back into
 * "18" and the decimal can never be reached.
 */
export function parseHours(input) {
  if (input === null || input === undefined) return null;
  const text = String(input).trim().replace(',', '.');
  if (text === '') return null;
  const hours = Number(text);
  return Number.isFinite(hours) ? hours : null;
}

export function photoperiodLabel(hoursOn) {
  // Checked before the cast, because Number(null) and Number('') are both 0 —
  // and here zero is a real answer, so an unset cycle can't be told apart from
  // "never on" once it has been through Number().
  if (hoursOn === null || hoursOn === undefined || hoursOn === '') return null;

  const on = Number(hoursOn);
  if (!Number.isFinite(on) || on < 0 || on > 24) return null;
  return `${trim(on)}/${trim(24 - on)}`;
}

/**
 * The figures worth reading at a glance, in the order a grower would want them.
 *
 * Most fixtures publish only the first two or three of these, and a row that
 * listed everything would be a spec sheet rather than a summary — so whatever is
 * known is taken in order and the rest is left for the inventory screen.
 */
export function lightSpecs(light, { limit = 4 } = {}) {
  if (!light) return [];

  const specs = [
    light.watts ? `${trim(light.watts)} W` : null,
    hasColorTemp(light.type) && light.color_temp_k ? `${trim(light.color_temp_k)}K` : null,
    spectrumLabel(light.spectrum),
    // PPFD means nothing without the distance it was measured at, so the two
    // are shown together or not at all.
    light.ppfd_umol_m2_s && light.ppfd_distance_cm
      ? `${trim(light.ppfd_umol_m2_s)} PPFD @ ${trim(light.ppfd_distance_cm)}cm`
      : null,
    light.ppf_umol_s ? `${trim(light.ppf_umol_s)} µmol/s` : null,
    light.efficacy_umol_j ? `${trim(light.efficacy_umol_j)} µmol/J` : null,
  ].filter(Boolean);

  return specs.slice(0, limit);
}

/**
 * One assigned fixture, read as a line: how many, what they are, how long they
 * run, and the couple of figures that say how hard they push.
 */
export function assignmentSummary(row) {
  const light = row?.light;
  const cycle = photoperiodLabel(row?.hours_on);

  return [cycle ? `${cycle} h` : null, ...lightSpecs(light, { limit: 3 })]
    .filter(Boolean)
    .join(' · ');
}

/** "2 x Mars TS", or the fixture type when the group was never named. */
export function assignmentTitle(row) {
  return `${row?.quantity ?? 1} x ${row?.light?.name ?? lightTypeLabel(row?.light?.type)}`;
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
