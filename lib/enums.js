/**
 * The fixed sets of values the app offers, and nothing else.
 *
 * These lists used to live beside the queries for the tables they describe,
 * which was fine while only a screen wanted them: a screen already has the
 * Supabase client, expo-notifications and the rest loaded. Validation changed
 * that. `lib/schemas.js` needs to know what a valid environment or light type
 * is, and reaching for `lib/growspaces.js` to find out pulled in the client,
 * expo-device and the notification scheduler behind it — so a module of pure
 * data ended up unable to load without a device.
 *
 * So the lists live here, where there is nothing to import. Their original
 * homes re-export them, and every existing import still works.
 */

/** @typedef {{ value: string, label: string }} Option */

/** @type {Option[]} */
export const CONTAINER_MATERIALS = [
  { value: 'plastic', label: 'Plastic' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'terracotta', label: 'Terracotta' },
];

/** @type {Option[]} */
export const GROWSPACE_ENVIRONMENTS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
];

/** @type {Option[]} */
export const STATION_ENVIRONMENTS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
];

/** @type {Option[]} */
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

/** @type {Option[]} */
export const SPECTRUMS = [
  { value: 'full', label: 'Full spectrum' },
  { value: 'veg', label: 'Veg' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'white_red', label: 'White + red' },
  { value: 'other', label: 'Other' },
];

/**
 * Whether a feed went to a whole growspace or to particular plants in it. A
 * germination station is always fed whole, so this question is only asked of a
 * growspace.
 *
 * @type {Option[]}
 */
export const FEED_TARGETS = [
  { value: 'all', label: 'Whole space' },
  { value: 'plants', label: 'Some plants' },
];

/**
 * What a sowing goes into. A tray has cells and a container is one pot, which
 * is why the seed count means something different on each side.
 *
 * @type {Option[]}
 */
export const SOW_TARGETS = [
  { value: 'tray', label: 'Tray' },
  { value: 'container', label: 'Container' },
];

/**
 * Liquid or crystal. The choice also picks the unit a dose is quoted in, so it
 * is not only a label.
 *
 * @type {Option[]}
 */
export const FERTILIZER_FORMS = [
  { value: 'liquid', label: 'Liquid' },
  { value: 'solid', label: 'Crystal' },
];

/** @type {Option[]} */
export const FERTILIZER_ORIGINS = [
  { value: 'organic', label: 'Organic' },
  { value: 'synthetic', label: 'Synthetic' },
];

/**
 * What each kind of scheduled action is aimed at.
 *
 * `targets` says what can be picked out: the plants standing in a growspace, or
 * the sowings in a station. `whole` is what it means to pick none — a feed with
 * nothing selected goes to the entire space, while a transplant with nothing
 * selected has not been decided yet and is asking to be.
 */
export const SCHEDULE_KINDS = [
  { value: 'sow', label: 'Sow', icon: 'seed-outline', targets: null },
  { value: 'transplant', label: 'Transplant', icon: 'export', targets: 'sowings' },
  { value: 'thin', label: 'Thin', icon: 'content-cut', targets: 'sowings' },
  { value: 'feed', label: 'Feed', icon: 'cup-water', targets: 'both', whole: true },
  { value: 'water', label: 'Water', icon: 'water-outline', targets: 'both', whole: true },
  { value: 'other', label: 'Other', icon: 'calendar-check-outline', targets: null },
];
