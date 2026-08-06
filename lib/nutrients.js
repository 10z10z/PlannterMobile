/**
 * Nutrient maths for the NPK calculator.
 *
 * Fertilizer nutrient columns are percentages of the product, as printed on the
 * label (see the schema notes in 0001_init.sql). Doses are stored per litre —
 * ml/L for liquids, g/L for crystals. Treating a liquid label as w/v (1 ml of
 * product weighs ~1 g) makes both forms collapse to the same conversion:
 *
 *   ppm = percent / 100 * dose_per_liter * 1000  =  percent * dose * 10
 *
 * That w/v assumption is what fertilizer labels normally mean, and it is the
 * only way to get ppm out of a label without knowing the product's density.
 */

export const MACRO_KEYS = ['n', 'p', 'k'];
export const MICRO_KEYS = ['ca', 'mg', 's', 'fe', 'mn', 'zn', 'b', 'cu', 'mo'];
const ALL_KEYS = [...MACRO_KEYS, ...MICRO_KEYS];

export const NUTRIENT_LABELS = {
  n: 'Nitrogen (N)',
  p: 'Phosphorus (P)',
  k: 'Potassium (K)',
  ca: 'Calcium (Ca)',
  mg: 'Magnesium (Mg)',
  s: 'Sulfur (S)',
  fe: 'Iron (Fe)',
  mn: 'Manganese (Mn)',
  zn: 'Zinc (Zn)',
  b: 'Boron (B)',
  cu: 'Copper (Cu)',
  mo: 'Molybdenum (Mo)',
};

export const STAGE_KEYS = ['germination', 'seedling', 'vegetative', 'flowering', 'fruiting'];

export const STAGE_LABELS = {
  germination: 'Germination',
  seedling: 'Seedling',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  fruiting: 'Fruiting',
};

/**
 * Recommended solution strength per growth stage, in ppm [min, max].
 *
 * These are the typical hydroponic ranges, not a recommendation for any
 * particular plant — species, medium, source water and light all move them, so
 * the screens present them as a starting point rather than a verdict.
 */
export const STAGE_TARGETS = {
  germination: { n: [0, 50], p: [0, 30], k: [0, 50] },
  seedling: { n: [50, 70], p: [30, 50], k: [50, 70] },
  vegetative: { n: [150, 200], p: [50, 80], k: [150, 200] },
  flowering: { n: [100, 150], p: [80, 120], k: [200, 250] },
  fruiting: { n: [80, 120], p: [60, 100], k: [220, 280] },
};

/**
 * Recommended secondary/trace levels in ppm [min, max].
 *
 * Unlike the macros these barely move between stages — a plant needs roughly
 * the same trace metals whether it is leafing out or setting fruit — so one
 * band per nutrient covers every stage.
 */
export const MICRO_TARGETS = {
  ca: [120, 180],
  mg: [40, 70],
  s: [50, 90],
  fe: [2, 4],
  mn: [0.5, 1],
  zn: [0.2, 0.5],
  b: [0.3, 0.6],
  cu: [0.05, 0.15],
  mo: [0.03, 0.08],
};

/** Full-scale end of each macro bar, so the target zones sit in a sane place. */
const BAR_SCALE_MAX = { n: 300, p: 180, k: 320 };

/** Same, for the micros — their bands span three orders of magnitude. */
const MICRO_BAR_SCALE = {
  ca: 250,
  mg: 100,
  s: 130,
  fe: 6,
  mn: 1.5,
  zn: 0.8,
  b: 1,
  cu: 0.3,
  mo: 0.15,
};

/** ppm of total dissolved solids per 1 mS/cm — the "700 scale" hydro meters use. */
const PPM_PER_EC = 700;

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percent(fertilizer, key) {
  const value = Number(fertilizer?.[key]);
  return Number.isFinite(value) ? value : 0;
}

/** Raw (unrounded) ppm one product contributes at `dosePerLiter`. */
function contributions(fertilizer, dosePerLiter) {
  const dose = Number(dosePerLiter);
  const factor = Number.isFinite(dose) && dose > 0 ? dose * 10 : 0;

  /** @type {Record<string, number>} */
  const values = {};
  ALL_KEYS.forEach((key) => {
    values[key] = percent(fertilizer, key) * factor;
  });
  return values;
}

/**
 * @typedef {object} NutrientResult
 * @property {number} n
 * @property {number} p
 * @property {number} k
 * @property {Record<string, number>} micros Keyed by `MICRO_KEYS`.
 * @property {number} macroTotal
 * @property {number} microTotal
 * @property {number} total ppm of everything dissolved.
 * @property {number} ec Estimated conductivity, mS/cm.
 */

/**
 * Rounds a flat key -> ppm map into the shape the screens read, and derives the
 * totals from it. Micros carry an extra decimal because their bands run down to
 * hundredths of a ppm, where 2dp would round molybdenum away entirely.
 *
 * The returned shape is spelled out above rather than inferred: both key groups
 * are walked from their constant lists, and a loop over `MACRO_KEYS` builds `{}`
 * as far as the type checker is concerned.
 *
 * @param {Record<string, number>} values
 * @returns {NutrientResult}
 */
function buildResult(values) {
  /** @type {Record<string, number>} */
  const macros = {};
  let macroTotal = 0;
  MACRO_KEYS.forEach((key) => {
    const value = round(values[key] ?? 0);
    macros[key] = value;
    macroTotal += value;
  });

  /** @type {Record<string, number>} */
  const micros = {};
  let microTotal = 0;
  MICRO_KEYS.forEach((key) => {
    const value = round(values[key] ?? 0, 3);
    micros[key] = value;
    microTotal += value;
  });

  const total = round(macroTotal + microTotal);
  return {
    // Named rather than spread: `macros` is filled by walking MACRO_KEYS, and
    // the three keys every caller reads off the result are worth stating.
    n: macros.n,
    p: macros.p,
    k: macros.k,
    micros,
    macroTotal: round(macroTotal),
    microTotal: round(microTotal),
    total,
    ec: round(total / PPM_PER_EC),
  };
}

/**
 * What one dose per litre of `fertilizer` puts into the water.
 * Returns ppm per nutrient plus totals and an EC estimate.
 */
export function ppmFromDose(fertilizer, dosePerLiter) {
  return buildResult(contributions(fertilizer, dosePerLiter));
}

/**
 * The same figures for a tank several products went into.
 *
 * Nutrients from different bottles simply add up in solution, so a mix is the
 * sum of each product's contribution at its own dose — which is also why the
 * bars have to be read against the mix rather than any single bottle.
 *
 * `entries` is a list of `{ fertilizer, dosePerLiter }`. `water` is the source
 * water's own `{ ca, mg }`, already in the tank before anything is poured —
 * ignoring it understates Ca and Mg on hard water, which is exactly the case
 * where it matters. Where those two figures came from, a hardness estimate or
 * a lab report, is the caller's business.
 */
export function ppmFromMix(entries, water) {
  /** @type {Record<string, number>} */
  const values = {};
  ALL_KEYS.forEach((key) => {
    values[key] = 0;
  });

  const source = waterFromReport(water?.ca, water?.mg);
  if (source) {
    values.ca += source.ca;
    values.mg += source.mg;
  }

  (entries ?? []).forEach(({ fertilizer, dosePerLiter }) => {
    const contribution = contributions(fertilizer, dosePerLiter);
    ALL_KEYS.forEach((key) => {
      values[key] += contribution[key];
    });
  });

  return buildResult(values);
}

/**
 * What the tap water brings before any fertilizer goes in.
 *
 * A hardness reading is quoted in ppm as CaCO3, which is a stand-in for the
 * calcium and magnesium actually dissolved — so it has to be split back out
 * before it can join the nutrient figures. Two assumptions are baked in, and
 * both are the conventional ones for domestic supplies:
 *
 *   * three quarters of the hardness is calcium, one quarter magnesium;
 *   * the rest of the reading is carbonate, which is not a nutrient and so
 *     contributes nothing beyond the Ca and Mg derived here.
 *
 * A water report naming actual Ca and Mg figures beats this estimate every
 * time, which is why the settings sheet says so.
 */
export const HARDNESS_CALCIUM_SHARE = 0.75;

/** Mass of each element per unit mass of CaCO3, from their molar masses. */
const CA_PER_CACO3 = 40.08 / 100.09;
const MG_PER_CACO3 = 24.31 / 100.09;

/** The id the source water carries when it appears as a part of the mix. */
export const WATER_PART_ID = 'water';

/** Ca and Mg in ppm from a hardness reading, or null when the water is soft/unset. */
export function waterContribution(hardnessPpm) {
  const hardness = Number(hardnessPpm);
  if (!Number.isFinite(hardness) || hardness <= 0) return null;

  return {
    ca: hardness * HARDNESS_CALCIUM_SHARE * CA_PER_CACO3,
    mg: hardness * (1 - HARDNESS_CALCIUM_SHARE) * MG_PER_CACO3,
  };
}

/**
 * Ca and Mg straight off a water report, no estimating involved — the figures
 * a lab or utility publishes are the real thing, so they bypass the hardness
 * split entirely. Null when neither is given.
 */
export function waterFromReport(ca, mg) {
  const calcium = Math.max(0, Number(ca) || 0);
  const magnesium = Math.max(0, Number(mg) || 0);
  if (calcium <= 0 && magnesium <= 0) return null;

  return { ca: calcium, mg: magnesium };
}

/** A total amount poured into a tank, expressed as a dose per litre. */
export function perLiterDose(totalDose, volumeLiters) {
  const volume = Number(volumeLiters);
  const dose = Number(totalDose);
  if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(dose)) return 0;
  return dose / volume;
}

/**
 * Where a value sits against its band.
 *
 * Annotated rather than inferred: without it the three literals widen to
 * `string` the moment the result is stored on an object, and the bar's own
 * `status` stops being checkable.
 *
 * @param {number} value
 * @param {[number, number]} band
 * @returns {'below' | 'on' | 'above'}
 */
export function statusForValue(value, [min, max]) {
  if (value < min) return 'below';
  if (value > max) return 'above';
  return 'on';
}

export const STATUS_LABELS = {
  below: 'Below target',
  on: 'On target',
  above: 'Above target',
};

/**
 * @typedef {object} NutrientSegment
 * @property {string} id The fertilizer that contributed this slice.
 * @property {number} value ppm from that one product.
 * @property {number} widthPct Its share of the bar, on the bar's own scale.
 */

/**
 * @typedef {object} NutrientBar
 * @property {string} key
 * @property {string} label
 * @property {number} value Delivered ppm.
 * @property {number} min Bottom of the target band.
 * @property {number} max Top of the target band.
 * @property {NutrientSegment[]} segments
 * @property {number} fillPct
 * @property {number} zoneLeftPct
 * @property {number} zoneWidthPct
 * @property {'below' | 'on' | 'above'} status
 */

/**
 * One bar's geometry: where the value sits, and where the target band sits,
 * both as percentages of the bar's full width.
 *
 * `parts` are the individual products behind the figure, in mix order. They
 * become stacked segments so the bar shows not just how much is in the water
 * but which bottle put it there. Segment widths use the same scale as the bar,
 * so they add up to the fill; when the mix overshoots the scale the track's
 * own clipping takes care of the overflow.
 */
function buildBar(key, value, [min, max], scale, parts, pick) {
  const segments = (parts ?? [])
    .map((part) => ({ id: part.id, value: pick(part.result) }))
    .filter((segment) => segment.value > 0)
    .map((segment) => ({ ...segment, widthPct: (segment.value / scale) * 100 }));

  return {
    key,
    label: NUTRIENT_LABELS[key],
    value,
    min,
    max,
    segments,
    fillPct: Math.min(100, (value / scale) * 100),
    zoneLeftPct: (min / scale) * 100,
    zoneWidthPct: Math.max(2, ((max - min) / scale) * 100),
    status: statusForValue(value, [min, max]),
  };
}

/**
 * The per-contributor breakdown behind a mix, in the order things went in —
 * the source water first, since it was in the tank before any of it.
 */
export function mixParts(entries, water) {
  const source = waterFromReport(water?.ca, water?.mg);
  const parts = source ? [{ id: WATER_PART_ID, result: buildResult(source) }] : [];

  (entries ?? []).forEach(({ fertilizer, dosePerLiter }) => {
    parts.push({ id: fertilizer?.id, result: ppmFromDose(fertilizer, dosePerLiter) });
  });

  return parts;
}

/** The three macro bars, against the selected stage's bands. */
export function macroBars(result, stage, parts) {
  const targets = STAGE_TARGETS[stage];
  if (!targets) return [];

  return MACRO_KEYS.map((key) =>
    buildBar(key, result[key], targets[key], BAR_SCALE_MAX[key], parts, (part) => part[key])
  );
}

/** The secondary and trace bars, against their stage-independent bands. */
export function microBars(result, parts) {
  return MICRO_KEYS.map((key) =>
    buildBar(
      key,
      result.micros[key],
      MICRO_TARGETS[key],
      MICRO_BAR_SCALE[key],
      parts,
      (part) => part.micros[key]
    )
  );
}

/**
 * The dose that lands closest to the middle of every macro band at once.
 *
 * Each macro the product actually contains suggests its own perfect dose; they
 * rarely agree, since a 3-1-4 feed can't hit a 2-1-3 target. So each candidate
 * is scored across all three macros and the best compromise wins, with ties
 * broken toward the weaker dose — underfeeding is the recoverable mistake.
 */
export function suggestedDose(fertilizer, stage) {
  const targets = STAGE_TARGETS[stage];
  if (!fertilizer || !targets) return null;

  const candidates = MACRO_KEYS.map((key) => {
    const pct = percent(fertilizer, key);
    if (pct <= 0) return null;
    const mid = (targets[key][0] + targets[key][1]) / 2;
    return round(mid / (pct * 10), 1);
  }).filter((dose) => dose !== null && dose > 0);

  if (!candidates.length) return null;

  const score = (dose) => {
    const result = ppmFromDose(fertilizer, dose);
    return MACRO_KEYS.reduce((sum, key) => {
      const [min, max] = targets[key];
      const mid = (min + max) / 2;
      const spread = Math.max(max - min, 1);
      const inRange = result[key] >= min && result[key] <= max;
      return sum + Math.abs(result[key] - mid) / spread + (inRange ? 0 : 1);
    }, 0);
  };

  return candidates.slice().sort((a, b) => score(a) - score(b) || a - b)[0];
}
