/**
 * One schema per entity, and the limits they hold things to.
 *
 * The numbers here are the point of the module. Most are not correctness — a
 * 40,000 K grow light is a typo, not a constraint violation — but a field with
 * no upper bound is a field that accepts a mis-keyed digit, and the app then
 * carries that figure into a dose calculation or a grid it tries to render. So
 * every range is a stated opinion about what a home grow looks like, wide
 * enough not to argue with anyone real.
 *
 * Schemas that involve a measurement are functions of the unit system rather
 * than constants, because a range has to be expressed in the unit the field is
 * labelled with: telling someone typing Fahrenheit that a value must be between
 * -20 and 60 is worse than not checking at all.
 */

import {
  CONTAINER_MATERIALS,
  FEED_TARGETS,
  FERTILIZER_FORMS,
  FERTILIZER_ORIGINS,
  GROWSPACE_ENVIRONMENTS,
  LIGHT_TYPES,
  SCHEDULE_KINDS,
  SOW_TARGETS,
  SPECTRUMS,
  STATION_ENVIRONMENTS,
} from './enums';
import { parseDose, parseLength, parseTemperature, parseVolume } from './units';
import {
  LIMITS,
  choice,
  decimal,
  email,
  list,
  passthrough,
  secret,
  text,
  whole,
} from './validation';

/**
 * Sanity ranges that are the same wherever the quantity appears, kept together
 * so a figure means the same thing in every form that asks for it.
 */
export const RANGES = {
  /** Frost to a closed greenhouse in August, in each unit. */
  TEMP_C: { min: -20, max: 60 },
  TEMP_F: { min: -4, max: 140 },
  HUMIDITY: { min: 0, max: 100 },
  /** A day is 24 hours, and the answer is about a spot rather than a latitude. */
  SUN_HOURS: { min: 0, max: 24 },
  /** A windowsill CFL to a 1000 W HPS, with headroom for a whole-room figure. */
  WATTS: { min: 0, max: 10000 },
  /** Below 1000 K nothing emits usefully; above 12000 is aquarium territory. */
  COLOR_TEMP_K: { min: 1000, max: 12000 },
  PPF: { min: 0, max: 10000 },
  /** Physics caps efficacy near 5; the best fixtures sold are about 3.5. */
  EFFICACY: { min: 0, max: 5 },
  /** Full midday sun is about 2000, so this is generous. */
  PPFD: { min: 0, max: 3000 },
  BEAM_ANGLE: { min: 0, max: 360 },
  /** Percentages by weight, as printed on a fertiliser label. */
  NUTRIENT_PCT: { min: 0, max: 100 },
  PH: { min: 0, max: 14 },
  EC: { min: 0, max: 10 },
  /** Days from sowing to a sprout; a month is already slow, a year is a typo. */
  GERMINATION_DAYS: { min: 0, max: 365 },
  /** Watering intervals, in days. */
  INTERVAL_DAYS: { min: 1, max: 365 },
  /**
   * Seeds in one cell. Two or three is normal and gets thinned; a hundred is
   * someone typing a whole packet into the wrong field.
   */
  SEEDS_PER_CELL: { min: 1, max: 100 },
};

/**
 * Volume in litres or gallons, whichever the user is typing.
 *
 * A required volume has to be more than nothing — a 0 L pot is not a pot — so
 * `required` moves the floor off zero rather than only rejecting a blank field.
 */
export function volumeField(label, system, { required = false, max = 1000 } = {}) {
  return decimal({
    label,
    required,
    min: required ? 0.01 : 0,
    max: system === 'imperial' ? Math.round(max / 3.785411784) : max,
    transform: (value) => parseVolume(value, system),
  });
}

/** Length in centimetres or inches, whichever the user is typing. */
export function lengthField(label, system, { max = 500 } = {}) {
  return decimal({
    label,
    min: 0,
    max: system === 'imperial' ? Math.round(max / 2.54) : max,
    transform: (value) => parseLength(value, system),
  });
}

/** Temperature in °C or °F, checked in the unit shown and stored in °C. */
export function temperatureField(label, system) {
  const range = system === 'imperial' ? RANGES.TEMP_F : RANGES.TEMP_C;
  return decimal({
    label,
    min: range.min,
    max: range.max,
    unit: system === 'imperial' ? '°F' : '°C',
    transform: (value) => parseTemperature(value, system),
  });
}

/**
 * A dose per litre or per gallon, checked as typed and stored per litre.
 *
 * A required dose has to be more than nothing: a product in a mix at 0 is a
 * product that isn't in the mix.
 */
export function doseField(label, system, { max = 1000, required = false } = {}) {
  return decimal({
    label,
    required,
    min: required ? 0.001 : 0,
    max,
    transform: (value) => parseDose(value, system),
  });
}

/** A count of identical things — pots, trays, fixtures, packets. */
export function quantityField(label = 'Quantity') {
  return whole({ label, required: true, min: 1, max: LIMITS.QUANTITY });
}

/** The nutrient percentage fields shared by fertilisers and pre-charged mediums. */
export function nutrientFields(keys) {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      decimal({
        label: key.toUpperCase(),
        min: RANGES.NUTRIENT_PCT.min,
        max: RANGES.NUTRIENT_PCT.max,
        unit: '%',
      }),
    ])
  );
}

/**
 * A growspace, and the grids inside it.
 *
 * Sun hours are validated whatever the environment, and dropped by the form
 * when the space is indoors — a rule that fires on a field nobody can see would
 * be unfixable.
 *
 * @param {string} system
 */
export function growspaceSchema(system) {
  return {
    name: text({ label: 'Name', required: true }),
    description: text({ label: 'Description', max: LIMITS.DESCRIPTION }),
    environment: choice({ label: 'Environment', options: GROWSPACE_ENVIRONMENTS }),
    temp: temperatureField('Temperature', system),
    humidity: decimal({
      label: 'Humidity',
      min: RANGES.HUMIDITY.min,
      max: RANGES.HUMIDITY.max,
      unit: '%',
    }),
    sunHours: decimal({
      label: 'Hours of direct sun',
      min: RANGES.SUN_HOURS.min,
      max: RANGES.SUN_HOURS.max,
    }),
  };
}

/**
 * Sowing a pack into a tray or a single container.
 *
 * Which of the two ids is required depends on what's being sown into, so that
 * pairing is a check rather than a rule on either field.
 */
export const sowingSchema = {
  seed_pack_id: passthrough({ required: true, label: 'A seed pack' }),
  target: choice({ label: 'Sow into', options: SOW_TARGETS }),
  tray_id: passthrough(),
  container_id: passthrough(),
  seeds_per_cell: whole({
    label: 'Seeds',
    required: true,
    min: RANGES.SEEDS_PER_CELL.min,
    max: RANGES.SEEDS_PER_CELL.max,
  }),
  sown_on: passthrough({ required: true, label: 'A sowing date' }),
};

/**
 * Whatever it's being sown into has to have been picked.
 *
 * @type {import('./validation').Check}
 */
export const sowingTargetCheck = (values) => {
  if (values.target === 'tray' && !values.tray_id) {
    return { field: 'tray_id', message: 'Pick a tray' };
  }
  if (values.target === 'container' && !values.container_id) {
    return { field: 'container_id', message: 'Pick a container' };
  }
  return null;
};

/**
 * Whether the pack holds as many seeds as the sowing is about to take.
 *
 * The pack and the number of cells aren't fields on the form — they're rows
 * looked up from the shelf — so they're closed over rather than validated.
 * A pack with no count recorded says nothing, since an unknown quantity is not
 * the same as none.
 *
 * @param {{ seed_count?: number|null, name?: string }|null} seedPack
 * @param {number|null} cellCount
 * @returns {import('./validation').Check}
 */
export function seedsAvailableCheck(seedPack, cellCount) {
  return (values) => {
    const available = seedPack?.seed_count;
    if (available === null || available === undefined || !cellCount) return null;

    const needed = cellCount * values.seeds_per_cell;
    if (needed <= available) return null;
    return {
      field: 'seeds_per_cell',
      message: `That needs ${needed} seeds and the pack has ${available}`,
    };
  };
}

/**
 * Moving germinated seedlings into a growspace.
 *
 * The ceiling on seedlings is however many have actually come up in the cells
 * being moved, so this too is built per use rather than shared.
 *
 * @param {number} available
 */
export function transplantSchema(available) {
  return {
    seedlings: whole({ label: 'Seedlings to move', required: true, min: 1, max: available }),
    container_count: whole({
      label: 'Containers to use',
      required: true,
      min: 1,
      max: LIMITS.QUANTITY,
    }),
    growspace_id: passthrough({ required: true, label: 'A growspace' }),
    container_id: passthrough(),
    name: text({ label: 'Plant name', required: true }),
  };
}

/**
 * Seedlings can share a pot, but a pot cannot hold a fraction of one — so there
 * can't be more containers than there are seedlings to put in them.
 *
 * @type {import('./validation').Check}
 */
export const containersFitSeedlingsCheck = (values) => {
  if (values.container_count <= values.seedlings) return null;
  return {
    field: 'container_count',
    message: 'There cannot be more containers than seedlings',
  };
};

/**
 * How many of a cell's seeds came up — the only figure a cell carries.
 *
 * The ceiling is the number sown, which differs per cell, and when a whole tray
 * is marked at once it's the fullest cell in it. So the schema is built for the
 * cell or tray in hand rather than shared.
 *
 * @param {number} seedsPlanted
 * @param {string} [label]
 */
export function cellSchema(seedsPlanted, label = 'Germinated') {
  return {
    germinated: whole({ label, required: true, min: 0, max: seedsPlanted }),
  };
}

/**
 * An action planned for a day.
 *
 * `subject` is optional here rather than required, because the form fills it in
 * from what the plan is aimed at when nothing was typed — "Basil, Chilli" under
 * a picker that already says so is not worth typing. Whether that fallback
 * produced anything is a check, since the schema can't see it.
 */
export const scheduledActionSchema = {
  kind: choice({ label: 'Action', options: SCHEDULE_KINDS }),
  place_id: passthrough({ required: true, label: 'A growspace or station' }),
  subject: text({ label: 'What' }),
  seed_pack_id: passthrough(),
  due_on: passthrough({ required: true, label: 'A date' }),
  due_minutes: passthrough(),
  note: text({ label: 'Note', max: LIMITS.NOTE }),
  target_ids: list({ label: 'Targets' }),
};

/**
 * A plan has to be called something, whether typed or implied by what it's
 * aimed at.
 *
 * @param {string|null|undefined} implied
 * @returns {import('./validation').Check}
 */
export function subjectCheck(implied) {
  return (values) => {
    if (values.subject || implied?.trim()) return null;
    return { field: 'subject', message: 'Say what this is for' };
  };
}

/**
 * Kinds that can't be aimed at a whole place have to be aimed at something.
 *
 * Transplanting or thinning "the whole tent" isn't a decision anyone has made
 * yet, while feeding or watering it plainly is — which is the difference
 * `allowsWholePlace` carries.
 *
 * @param {string|null} targetKind What there is to pick from, if anything.
 * @param {boolean} wholeAllowed Whether picking none means the whole place.
 * @param {boolean} anyToPick Whether the place has anything in it to pick.
 * @returns {import('./validation').Check}
 */
export function targetsRequiredCheck(targetKind, wholeAllowed, anyToPick) {
  return (values) => {
    if (!targetKind || wholeAllowed || !anyToPick) return null;
    if (values.target_ids.length > 0) return null;
    return {
      field: 'target_ids',
      message: targetKind === 'plants' ? 'Pick the plants' : 'Pick what to work on',
    };
  };
}

/** Where a fertilizer's dose lives on the feeding form. */
export const doseKey = (fertilizerId) => `dose:${fertilizerId}`;

/**
 * A feeding: which products at which rates, into what, on what day.
 *
 * The dose fields exist only for the products actually picked, so the schema is
 * rebuilt as the mix changes. A product dropped from the mix takes its rule with
 * it, and whatever was typed into it stops counting — which is what makes
 * removing a product a way to fix its complaint.
 *
 * @param {string} system
 * @param {{ id: string, name: string }[]} selectedFertilizers
 */
export function feedingSchema(system, selectedFertilizers) {
  return {
    place_id: passthrough({ required: true, label: 'A growspace or station' }),
    target: choice({ label: 'Fed', options: FEED_TARGETS }),
    fertilizer_ids: list({
      label: 'Fertilizers',
      min: 1,
      message: 'Pick at least one fertilizer',
    }),
    plant_ids: list({ label: 'Plants' }),
    volume_liters: volumeField('Batch mixed', system),
    note: text({ label: 'Note', max: LIMITS.NOTE }),
    fed_on: passthrough({ required: true, label: 'A date' }),
    ...Object.fromEntries(
      (selectedFertilizers ?? []).map((fertilizer) => [
        doseKey(fertilizer.id),
        doseField(fertilizer.name, system, { required: true }),
      ])
    ),
  };
}

/**
 * Feeding named plants means naming at least one.
 *
 * Only growspaces can be fed plant by plant — a station holds cells of a tray,
 * not plants that could be picked out — so which question is being asked
 * depends on the place, which isn't a field.
 *
 * @param {{ type?: string }|null|undefined} place
 * @returns {import('./validation').Check}
 */
export function feedingPlantsCheck(place) {
  return (values) => {
    if (values.target !== 'plants' || place?.type !== 'growspace') return null;
    if (values.plant_ids.length > 0) return null;
    return { field: 'plant_ids', message: 'Pick the plants that were fed' };
  };
}

/**
 * A germination station. The same conditions a growspace records, minus the
 * ones that only mean something outdoors.
 *
 * @param {string} system
 */
export function stationSchema(system) {
  return {
    name: text({ label: 'Name', required: true }),
    environment: choice({ label: 'Environment', options: STATION_ENVIRONMENTS }),
    temp: temperatureField('Temperature', system),
    humidity: decimal({
      label: 'Humidity',
      min: RANGES.HUMIDITY.min,
      max: RANGES.HUMIDITY.max,
      unit: '%',
    }),
  };
}

/**
 * Logging in. The password is only checked for being there: an account made
 * before any rule below existed still has to be able to get in, and the server
 * is the one that decides whether it's right.
 */
export const loginSchema = {
  email: email(),
  password: secret(),
};

/**
 * Signing up, where the password rule does apply because this is the moment it
 * is chosen. Eight rather than the six the auth service allows by default —
 * six is short enough to be worth refusing at the point someone picks it.
 */
export const signupSchema = {
  email: email(),
  password: secret({ min: 8 }),
};

/**
 * A plant standing in a growspace.
 *
 * The watering interval is what the reminder is booked from, so a nonsense
 * figure here is a notification at a nonsense time rather than a bad-looking
 * record.
 */
export const plantSchema = {
  name: text({ label: 'Name', required: true }),
  species: text({ label: 'Species' }),
  plant_type: text({ label: 'Crop' }),
  watering_interval_days: whole({
    label: 'Watering interval',
    required: true,
    min: RANGES.INTERVAL_DAYS.min,
    max: RANGES.INTERVAL_DAYS.max,
  }),
  image_url: passthrough(),
  container_id: passthrough(),
};

/**
 * The same plant, being edited rather than created.
 *
 * Germination date is only on this one because a plant created by hand hasn't
 * germinated anywhere the app watched — a transplant brings the date with it,
 * and otherwise it's filled in afterwards.
 */
export const plantEditSchema = {
  ...plantSchema,
  germinated_on: passthrough(),
};

/** One grid within a growspace, or the grid of a tray. */
export const gridSchema = {
  name: text({ label: 'Grid name', required: true }),
  grid_rows: whole({ label: 'Rows', required: true, min: 1, max: LIMITS.GRID_SIDE }),
  grid_cols: whole({ label: 'Columns', required: true, min: 1, max: LIMITS.GRID_SIDE }),
};

/**
 * Whether a grid is small enough to draw.
 *
 * Rows and columns are each within their own limit long before the two of them
 * multiplied are, which is why this is a check rather than a range: 50 x 50
 * passes both fields and is 2500 views.
 *
 * @param {string} [field] Which field carries the message.
 * @returns {import('./validation').Check}
 */
export function gridSizeCheck(field = 'grid_cols') {
  return (values) => {
    const cells = values.grid_rows * values.grid_cols;
    if (!Number.isFinite(cells) || cells <= LIMITS.GRID_CELLS) return null;
    return {
      field,
      message: `That is ${cells} cells — ${LIMITS.GRID_CELLS} is the most that can be drawn`,
    };
  };
}

/**
 * A tray. Cell volume stays in millilitres in both systems — the figure is
 * printed on the tray in ml wherever it was made, and a cell measured in
 * gallons would be a strange thing to ask for.
 */
export const traySchema = {
  name: text({ label: 'Name', required: true }),
  image_url: passthrough(),
  grid_rows: gridSchema.grid_rows,
  grid_cols: gridSchema.grid_cols,
  cell_volume_ml: decimal({ label: 'Cell volume', min: 0, max: 10000, unit: ' ml' }),
  quantity: quantityField(),
};

/** @param {string} system */
export function containerSchema(system) {
  return {
    material: choice({ label: 'Material', options: CONTAINER_MATERIALS }),
    image_url: passthrough(),
    volume_liters: volumeField('Volume', system, { required: true }),
    quantity: quantityField(),
  };
}

export const seedPackSchema = {
  name: text({ label: 'Name', required: true }),
  image_url: passthrough(),
  plant_type: text({ label: 'Plant type' }),
  germination_days_min: whole({
    label: 'Minimum germination time',
    min: RANGES.GERMINATION_DAYS.min,
    max: RANGES.GERMINATION_DAYS.max,
  }),
  germination_days_max: whole({
    label: 'Maximum germination time',
    min: RANGES.GERMINATION_DAYS.min,
    max: RANGES.GERMINATION_DAYS.max,
  }),
  packaged_on: passthrough(),
  seed_count: whole({ label: 'Seed count', min: 0, max: LIMITS.SEED_COUNT }),
};

/**
 * A germination window has to be a window. Both ends are optional, so this only
 * has something to say when both were given.
 *
 * @type {import('./validation').Check}
 */
export const germinationWindowCheck = (values) => {
  const { germination_days_min: min, germination_days_max: max } = values;
  if (min === null || max === null || min <= max) return null;
  return {
    field: 'germination_days_max',
    message: 'The longest germination time cannot be shorter than the shortest',
  };
};

/**
 * A pH range has to be a range, for the same reason.
 *
 * @type {import('./validation').Check}
 */
export const phRangeCheck = (values) => {
  const { ph_min: min, ph_max: max } = values;
  if (min === null || max === null || min === undefined || max === undefined || min <= max) {
    return null;
  }
  return { field: 'ph_max', message: 'The top of the pH range cannot be below the bottom' };
};

/**
 * @param {string} system
 * @param {readonly string[]} nutrientKeys
 */
export function mediumSchema(system, nutrientKeys) {
  return {
    name: text({ label: 'Name', required: true }),
    image_url: passthrough(),
    quantity: quantityField('How many'),
    volume_liters: volumeField('Volume each', system),
    low_stock: passthrough(),
    ...nutrientFields(nutrientKeys),
    ec: decimal({ label: 'EC', min: RANGES.EC.min, max: RANGES.EC.max }),
    ph_min: decimal({ label: 'Minimum pH', min: RANGES.PH.min, max: RANGES.PH.max }),
    ph_max: decimal({ label: 'Maximum pH', min: RANGES.PH.min, max: RANGES.PH.max }),
  };
}

/**
 * @param {string} system
 * @param {readonly string[]} nutrientKeys
 */
export function fertilizerSchema(system, nutrientKeys) {
  return {
    name: text({ label: 'Name', required: true }),
    image_url: passthrough(),
    form: choice({ label: 'Form', options: FERTILIZER_FORMS }),
    origin: choice({ label: 'Type', options: FERTILIZER_ORIGINS }),
    ...nutrientFields(nutrientKeys),
    foliar_dose_min: doseField('Minimum foliar dose', system),
    foliar_dose_max: doseField('Maximum foliar dose', system),
    fertigation_dose_min: doseField('Minimum fertigation dose', system),
    fertigation_dose_max: doseField('Maximum fertigation dose', system),
  };
}

/**
 * A dose range printed on a bottle runs low to high, and a form that lets it run
 * the other way feeds that pair straight into the calculator.
 *
 * @param {string} minField
 * @param {string} maxField
 * @param {string} what
 * @returns {import('./validation').Check}
 */
export function doseRangeCheck(minField, maxField, what) {
  return (values) => {
    const min = values[minField];
    const max = values[maxField];
    if (min === null || max === null || min === undefined || max === undefined || min <= max) {
      return null;
    }
    return { field: maxField, message: `The top of the ${what} range cannot be below the bottom` };
  };
}

/** @param {string} system */
export function growLightSchema(system) {
  return {
    name: text({ label: 'Name', required: true }),
    image_url: passthrough(),
    type: choice({ label: 'Type', options: LIGHT_TYPES }),
    quantity: quantityField(),
    watts: decimal({ label: 'Power', min: RANGES.WATTS.min, max: RANGES.WATTS.max, unit: ' W' }),
    color_temp_k: whole({
      label: 'Colour temperature',
      min: RANGES.COLOR_TEMP_K.min,
      max: RANGES.COLOR_TEMP_K.max,
      unit: ' K',
    }),
    spectrum: choice({ label: 'Spectrum', options: SPECTRUMS, required: false }),
    dimmable: passthrough(),
    ppf_umol_s: decimal({ label: 'PPF', min: RANGES.PPF.min, max: RANGES.PPF.max }),
    efficacy_umol_j: decimal({
      label: 'Efficacy',
      min: RANGES.EFFICACY.min,
      max: RANGES.EFFICACY.max,
    }),
    ppfd_umol_m2_s: decimal({ label: 'PPFD', min: RANGES.PPFD.min, max: RANGES.PPFD.max }),
    ppfd_distance_cm: lengthField('At distance', system),
    coverage_width_cm: lengthField('Coverage width', system),
    coverage_depth_cm: lengthField('Coverage depth', system),
    beam_angle_deg: whole({
      label: 'Beam angle',
      min: RANGES.BEAM_ANGLE.min,
      max: RANGES.BEAM_ANGLE.max,
      unit: '°',
    }),
    ip_rating: text({ label: 'IP rating', max: 10 }),
  };
}
