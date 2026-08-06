/**
 * Growth-phase guidelines per crop, counted in days since the seed came up.
 *
 * These are rules of thumb, not a schedule: a pepper under weak light takes
 * longer to flower than the same pepper under a good fixture, and a variety can
 * be a fortnight either side of its type. They are here to say roughly where a
 * plant is in its life, which is enough to read a growspace at a glance, and the
 * screens present them as such rather than as a verdict.
 *
 * `until` is the day the phase gives way to the next; the last phase runs on
 * with no end, since a plant in fruit stays in fruit until it is pulled.
 */

export const PHASE_LABELS = {
  seedling: 'Seedling',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  fruiting: 'Fruiting',
  harvest: 'Ready to harvest',
};

/**
 * Fruiting crops run the full course; leaf and root crops never fruit at all,
 * so they end at a harvest window instead of being given flowering phases they
 * are only ever reaching by accident. Basil is the odd one: it does flower, and
 * that's the point at which the leaves turn bitter, so it's worth flagging.
 */
export const SPECIES = {
  pepper: {
    label: 'Pepper',
    icon: 'chili-mild',
    phases: [
      { key: 'seedling', until: 30 },
      { key: 'vegetative', until: 70 },
      { key: 'flowering', until: 95 },
      { key: 'fruiting' },
    ],
  },
  tomato: {
    label: 'Tomato',
    icon: 'fruit-cherries',
    phases: [
      { key: 'seedling', until: 25 },
      { key: 'vegetative', until: 55 },
      { key: 'flowering', until: 75 },
      { key: 'fruiting' },
    ],
  },
  cucumber: {
    label: 'Cucumber',
    icon: 'sprout',
    phases: [
      { key: 'seedling', until: 15 },
      { key: 'vegetative', until: 35 },
      { key: 'flowering', until: 48 },
      { key: 'fruiting' },
    ],
  },
  basil: {
    label: 'Basil',
    icon: 'leaf',
    phases: [
      { key: 'seedling', until: 20 },
      { key: 'vegetative', until: 60 },
      // Basil flowering is a warning rather than a milestone: the leaves go
      // bitter once it bolts, so it is picked before this if it can be.
      { key: 'flowering' },
    ],
  },
  arugula: {
    label: 'Arugula',
    icon: 'leaf',
    phases: [{ key: 'seedling', until: 12 }, { key: 'vegetative', until: 30 }, { key: 'harvest' }],
  },
  lettuce: {
    label: 'Lettuce',
    icon: 'leaf',
    phases: [{ key: 'seedling', until: 15 }, { key: 'vegetative', until: 45 }, { key: 'harvest' }],
  },
  radish: {
    label: 'Radish',
    icon: 'carrot',
    phases: [{ key: 'seedling', until: 10 }, { key: 'vegetative', until: 22 }, { key: 'harvest' }],
  },
};

/**
 * What a crop with no guidelines of its own is read against — the same shape as
 * a fruiting crop, on the slow side, so an unknown plant is never told it should
 * be fruiting when it may not be.
 */
export const DEFAULT_PHASES = [
  { key: 'seedling', until: 30 },
  { key: 'vegetative', until: 70 },
  { key: 'flowering', until: 100 },
  { key: 'fruiting' },
];

/** The species keys offered in the pickers, in the order they're shown. */
export const SPECIES_KEYS = Object.keys(SPECIES);

/**
 * Matches free text to a known crop. Seed packs and plants carry whatever the
 * grower typed, so "Cherry Tomato", "tomatoes" and "TOMATO" all have to land on
 * the same guidelines — anything else and the phase silently disappears for a
 * plant that plainly has one.
 */
export function speciesFor(plantType) {
  if (!plantType) return null;
  const text = String(plantType).trim().toLowerCase();
  if (!text) return null;
  if (SPECIES[text]) return SPECIES[text];

  return (
    SPECIES_KEYS.map((key) => SPECIES[key]).find((entry) => {
      const name = entry.label.toLowerCase();
      // Matches "tomato", "tomatoes" and "cherry tomato" without matching a
      // word that merely contains the name.
      return new RegExp(`(^|\\s)${name}(es|s)?(\\s|$)`).test(text);
    }) ?? null
  );
}

/** What to call a crop: its proper name when known, else whatever was typed. */
export function speciesLabel(plantType) {
  return speciesFor(plantType)?.label ?? (plantType || null);
}

export function speciesIcon(plantType) {
  return speciesFor(plantType)?.icon ?? 'leaf';
}

/**
 * The phase a plant is in, `days` after it came up, or null when there is no
 * germination date to count from — a guess at the phase would be worse than
 * saying nothing.
 */
export function phaseFor(plantType, days) {
  if (days === null || days === undefined || days < 0) return null;

  const phases = speciesFor(plantType)?.phases ?? DEFAULT_PHASES;
  const phase = phases.find((entry) => entry.until === undefined || days < entry.until);
  if (!phase) return null;

  return { key: phase.key, label: PHASE_LABELS[phase.key] };
}

/**
 * How long until the next phase, for the detail screen. Null on the last one,
 * which has nothing to count towards.
 */
export function daysToNextPhase(plantType, days) {
  if (days === null || days === undefined || days < 0) return null;
  const phases = speciesFor(plantType)?.phases ?? DEFAULT_PHASES;
  const phase = phases.find((entry) => entry.until === undefined || days < entry.until);
  return phase?.until === undefined ? null : phase.until - days;
}
