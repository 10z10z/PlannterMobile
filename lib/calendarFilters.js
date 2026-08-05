/**
 * What the one calendar is currently showing.
 *
 * The calendar covers the whole grow — both sides of the app, everything
 * recorded and everything planned — which is more than anyone wants to read at
 * once. So it is narrowed by three independent questions: where it happened,
 * whether it is a plan or a record, and what sort of job it was.
 *
 * The fifteen kinds the app writes are gathered into five groups here. A grower
 * looking for "when did I last feed" does not care whether the row said `fed` or
 * a plan said `feed`, and a row of fifteen chips would be a worse way to ask.
 */

/** Which side of the app an entry belongs to. */
export const PLACE_FILTERS = [
  { value: 'growspace', label: 'Growspaces', icon: 'flower-outline' },
  { value: 'station', label: 'Stations', icon: 'sprout-outline' },
];

/**
 * Plans and records are different claims about a day, so they are hidden
 * separately: "Planned" governs the scheduled actions, "Done" the activity log.
 * A ticked-off plan stays under Planned — it is still the plan it always was,
 * and the thing it produced is its own entry in the log.
 */
export const RECORD_FILTERS = [
  { value: 'planned', label: 'Planned', icon: 'calendar-clock' },
  { value: 'done', label: 'Done', icon: 'check-circle-outline' },
];

/** The kinds of job, gathered into what a grower would actually go looking for. */
export const EVENT_GROUPS = [
  {
    value: 'sowing',
    label: 'Sowing',
    icon: 'seed-outline',
    kinds: ['sown', 'germinated'],
    scheduleKinds: ['sow'],
  },
  {
    value: 'transplant',
    label: 'Transplants',
    icon: 'export',
    kinds: ['transplanted', 'planted', 'moved'],
    scheduleKinds: ['transplant'],
  },
  {
    value: 'water',
    label: 'Watering',
    icon: 'water-outline',
    kinds: ['watered'],
    scheduleKinds: ['water'],
  },
  {
    value: 'feed',
    label: 'Feeding',
    icon: 'cup-water',
    kinds: ['fed'],
    scheduleKinds: ['feed'],
  },
  {
    value: 'other',
    label: 'Other',
    icon: 'calendar-check-outline',
    kinds: ['thinned', 'removed'],
    scheduleKinds: ['thin', 'other'],
  },
];

/** The group an activity kind falls in; anything unrecognised counts as Other. */
const GROUP_BY_KIND = Object.fromEntries(
  EVENT_GROUPS.flatMap((group) => group.kinds.map((kind) => [kind, group.value]))
);

const GROUP_BY_SCHEDULE_KIND = Object.fromEntries(
  EVENT_GROUPS.flatMap((group) => group.scheduleKinds.map((kind) => [kind, group.value]))
);

export function entryGroup(kind) {
  return GROUP_BY_KIND[kind] ?? 'other';
}

export function actionGroup(kind) {
  return GROUP_BY_SCHEDULE_KIND[kind] ?? 'other';
}

const ALL_PLACES = PLACE_FILTERS.map((entry) => entry.value);
const ALL_RECORDS = RECORD_FILTERS.map((entry) => entry.value);
const ALL_GROUPS = EVENT_GROUPS.map((group) => group.value);

/** A calendar opened for the first time shows everything. */
export const DEFAULT_FILTERS = {
  places: ALL_PLACES,
  records: ALL_RECORDS,
  groups: ALL_GROUPS,
};

/**
 * Stored filters read back as something usable.
 *
 * Anything unknown is dropped rather than trusted: the saved set outlives the
 * version that wrote it, and a chip that no longer exists must not be able to
 * hide a whole category of work with no way left to switch it back on.
 */
export function normalizeFilters(stored) {
  if (!stored || typeof stored !== 'object') return DEFAULT_FILTERS;

  const keep = (values, allowed, fallback) =>
    Array.isArray(values) ? values.filter((value) => allowed.includes(value)) : fallback;

  return {
    places: keep(stored.places, ALL_PLACES, ALL_PLACES),
    records: keep(stored.records, ALL_RECORDS, ALL_RECORDS),
    groups: keep(stored.groups, ALL_GROUPS, ALL_GROUPS),
  };
}

/** Turns a chip on or off, leaving the other two dimensions alone. */
export function toggleFilter(filters, dimension, value) {
  const current = filters[dimension] ?? [];
  return {
    ...filters,
    [dimension]: current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value],
  };
}

/** Whether anything at all is being hidden, for the "Show everything" escape. */
export function isFiltered(filters) {
  return (
    filters.places.length < ALL_PLACES.length ||
    filters.records.length < ALL_RECORDS.length ||
    filters.groups.length < ALL_GROUPS.length
  );
}

/** Recorded entries the filters admit. */
export function filterEntries(entries, filters) {
  if (!filters.records.includes('done')) return [];
  return (entries ?? []).filter(
    (entry) =>
      filters.places.includes(entry.source ?? 'growspace') &&
      filters.groups.includes(entryGroup(entry.kind))
  );
}

/** Scheduled actions the filters admit. */
export function filterActions(actions, filters) {
  if (!filters.records.includes('planned')) return [];
  return (actions ?? []).filter(
    (action) =>
      filters.places.includes(action.source ?? 'growspace') &&
      filters.groups.includes(actionGroup(action.kind))
  );
}
