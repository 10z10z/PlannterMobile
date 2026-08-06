import { supabase } from './supabase';
import { toDateString } from '../components/DateField';

/**
 * The activity log behind the calendar: what was done, on which day, and where.
 *
 * Two kinds of entry end up on the same calendar. Recorded events are rows in
 * `activity_events`, written as each action is performed. Derived entries are
 * read back out of the data itself — a sowing knows the day it was sown, a cell
 * knows the day it came up, a plant knows the day it was potted on — so a
 * calendar opened for the first time already has the history the app was
 * keeping all along, rather than starting blank. A recorded event always wins
 * over the derived entry for the same thing on the same day.
 */

/** How each kind of entry is labelled and drawn. */
export const ACTIVITY_KINDS = {
  sown: { label: 'Sown', icon: 'seed-outline' },
  germinated: { label: 'Germinated', icon: 'sprout-outline' },
  thinned: { label: 'Thinned', icon: 'content-cut' },
  transplanted: { label: 'Transplanted out', icon: 'export' },
  planted: { label: 'Planted', icon: 'flower-outline' },
  moved: { label: 'Moved', icon: 'cursor-move' },
  watered: { label: 'Watered', icon: 'water-outline' },
  fed: { label: 'Fed', icon: 'cup-water' },
  removed: { label: 'Removed', icon: 'delete-outline' },
};

export function kindLabel(kind) {
  return ACTIVITY_KINDS[kind]?.label ?? 'Activity';
}

export function kindIcon(kind) {
  return ACTIVITY_KINDS[kind]?.icon ?? 'calendar-blank-outline';
}

/**
 * Weeks start on Monday: growing weeks are counted that way in most of the
 * world the app is used in, and a fixed start keeps the grid stable rather than
 * shifting with the device locale between renders.
 */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday = 0 … Sunday = 6, from JavaScript's Sunday-first day numbers. */
function weekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

/** Built from local date parts, so a day step never lands on a DST hour. */
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** A stored `YYYY-MM-DD` as local midnight, never as UTC midnight. */
export function fromDateString(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The month a date falls in, as the `{ year, month }` the calendar works in. */
export function monthOf(date) {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Steps a month forward or back, rolling over the year. */
export function shiftMonth({ year, month }, delta) {
  const shifted = new Date(year, month + delta, 1);
  return monthOf(shifted);
}

export function monthLabel({ year, month }) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** The first and last day of a month, as the `YYYY-MM-DD` the queries take. */
export function monthRange({ year, month }) {
  return {
    from: toDateString(new Date(year, month, 1)),
    to: toDateString(new Date(year, month + 1, 0)),
  };
}

/**
 * The month laid out as whole weeks, each day carrying its date string and
 * whether it belongs to the month being shown — the days either side are drawn
 * dimmed rather than left blank, so the grid keeps its shape.
 */
export function monthWeeks({ year, month }) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Back up to the Monday on or before the first, so the grid starts on a whole
  // week. Rows run out with the month: a February starting on a Monday needs
  // four, not the six a fixed grid would draw.
  const start = addDays(first, -weekdayIndex(first));
  const weeks = [];

  for (let cursor = start; cursor <= last; cursor = addDays(cursor, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, day) => {
        const date = addDays(cursor, day);
        return { date, dateString: toDateString(date), inMonth: date.getMonth() === month };
      })
    );
  }

  return weeks;
}

/** Entries grouped by the day they belong to, keyed `YYYY-MM-DD`. */
export function groupByDay(entries) {
  const days = {};
  for (const entry of entries ?? []) {
    if (!days[entry.occurred_on]) days[entry.occurred_on] = [];
    days[entry.occurred_on].push(entry);
  }
  return days;
}

/** "2 cells", "3 seedlings" — the plural rule used across the descriptions. */
export function countLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * What a recorded event and its derived twin have in common: the same kind of
 * thing, about the same row, on the same day. Recording an event for something
 * the data already implies would otherwise show it twice.
 */
function entryKey(entry) {
  return `${entry.kind}:${entry.sowing_id ?? entry.plant_id ?? entry.id}:${entry.occurred_on}`;
}

/**
 * Recorded events with the derived entries they don't already cover. What was
 * logged leads, most recent first, and what the data remembers follows.
 */
export function mergeEntries(recorded, derived) {
  const seen = new Set((recorded ?? []).map(entryKey));
  return [...(recorded ?? []), ...(derived ?? []).filter((entry) => !seen.has(entryKey(entry)))];
}

/** The user whose log is being written, read from the cached session. */
async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/**
 * Writes one entry to the log.
 *
 * Recording is deliberately best-effort: a failure here must never take down
 * the action it was describing, since a sowing that happened but went unlogged
 * is a far better outcome than a sowing refused because its diary entry
 * wouldn't save.
 */
export async function recordEvent({
  // Falls back to the signed-in user, so a caller that already has the id can
  // save the round trip and one that doesn't can leave it out.
  userId = null,
  kind,
  subject,
  detail = null,
  occurredOn = null,
  growspaceId = null,
  stationId = null,
  sowingId = null,
  plantId = null,
  feedingId = null,
}) {
  try {
    const owner = userId ?? (await currentUserId());
    if (!owner) return null;

    const { data, error } = await supabase
      .from('activity_events')
      .insert({
        user_id: owner,
        kind,
        subject,
        detail,
        occurred_on: occurredOn ?? toDateString(new Date()),
        growspace_id: growspaceId,
        station_id: stationId,
        sowing_id: sowingId,
        plant_id: plantId,
        feeding_id: feedingId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

/**
 * Records a plant being moved about the grid, folding repeats together.
 *
 * Rearranging a growspace is a handful of drags in a row, and a day that reads
 * "moved Basil 1" nine times says less than one line saying where it ended up.
 * So the day's existing entry for that plant is rewritten rather than added to.
 */
export async function recordMove({ plant, detail, growspaceId }) {
  try {
    const owner = await currentUserId();
    if (!owner) return null;

    const today = toDateString(new Date());
    const { data: existing } = await supabase
      .from('activity_events')
      .select('id')
      .eq('kind', 'moved')
      .eq('plant_id', plant.id)
      .eq('occurred_on', today)
      .limit(1);

    if (existing?.length) {
      await supabase.from('activity_events').update({ detail }).eq('id', existing[0].id);
      return existing[0];
    }

    return await recordEvent({
      userId: owner,
      kind: 'moved',
      subject: plant.name,
      detail,
      growspaceId,
      plantId: plant.id,
    });
  } catch {
    return null;
  }
}

/** An `activity_events` row as the calendar reads it. */
function toEntry(row) {
  return {
    ...row,
    place: embeddedName(row.growspace) ?? embeddedName(row.station),
    source: row.station_id ? 'station' : 'growspace',
    derived: false,
  };
}

/**
 * The name off an embedded parent row.
 *
 * PostgREST returns a to-one embed as an object but a to-many as an array, and
 * which one a given select produces is decided by the foreign key rather than
 * by the query — so both are read here rather than assumed.
 *
 * @param {{ name?: string } | { name?: string }[] | null | undefined} relation
 * @returns {string | null}
 */
function embeddedName(relation) {
  if (!relation) return null;
  const row = Array.isArray(relation) ? relation[0] : relation;
  return row?.name ?? null;
}

/**
 * The events recorded in a date range.
 *
 * Without a scope both sides come back together, which is what the calendar
 * asks for — it sorts the two apart itself, by the filters the grower set,
 * rather than by which screen they arrived from.
 *
 * @param {{ from: string, to: string, scope?: 'station' | 'growspace' | null }} range
 */
export async function fetchEvents({ from, to, scope = null }) {
  let query = supabase
    .from('activity_events')
    .select('*, growspace:growspaces(name), station:germination_stations(name)')
    .gte('occurred_on', from)
    .lte('occurred_on', to)
    .order('created_at', { ascending: false });

  if (scope === 'station') query = query.not('station_id', 'is', null);
  else if (scope === 'growspace') query = query.not('growspace_id', 'is', null);
  else query = query.or('growspace_id.not.is.null,station_id.not.is.null');

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

/**
 * The sowing side's history, read back out of the sowings themselves: the day
 * each went in, and the days its cells came up.
 */
async function derivedStationEntries({ from, to }) {
  const [{ data: sowings }, { data: cells }] = await Promise.all([
    supabase
      .from('sowings')
      .select(
        'id, station_id, seed_pack_name, sown_on, grid_rows, grid_cols, station:germination_stations(name)'
      )
      .gte('sown_on', from)
      .lte('sown_on', to),
    supabase
      .from('sowing_cells')
      .select(
        'sowing_id, germinated, germinated_on, sowing:sowings(id, station_id, seed_pack_name, station:germination_stations(name))'
      )
      .gte('germinated_on', from)
      .lte('germinated_on', to),
  ]);

  const entries = (sowings ?? []).map((sowing) => ({
    id: `derived:sown:${sowing.id}`,
    kind: 'sown',
    occurred_on: sowing.sown_on,
    subject: sowing.seed_pack_name,
    detail:
      sowing.grid_rows * sowing.grid_cols > 1
        ? `${sowing.grid_rows} x ${sowing.grid_cols} tray`
        : 'One container',
    station_id: sowing.station_id,
    growspace_id: null,
    sowing_id: sowing.id,
    plant_id: null,
    place: embeddedName(sowing.station),
    source: 'station',
    derived: true,
  }));

  // A tray comes up over several days, so its cells are gathered per sowing per
  // day: one line saying how much of it appeared, not one line per cell.
  const grouped = new Map();
  for (const cell of cells ?? []) {
    if (!cell.sowing) continue;
    const key = `${cell.sowing_id}:${cell.germinated_on}`;
    const current = grouped.get(key) ?? { cell, cells: 0, seedlings: 0 };
    current.cells += 1;
    current.seedlings += cell.germinated;
    grouped.set(key, current);
  }

  for (const [key, group] of grouped) {
    const { sowing, germinated_on: on } = group.cell;
    entries.push({
      id: `derived:germinated:${key}`,
      kind: 'germinated',
      occurred_on: on,
      subject: sowing.seed_pack_name,
      detail: `${countLabel(group.cells, 'cell')} came up · ${countLabel(
        group.seedlings,
        'seedling'
      )}`,
      station_id: sowing.station_id,
      growspace_id: null,
      sowing_id: sowing.id,
      plant_id: null,
      place: embeddedName(sowing.station),
      source: 'station',
      derived: true,
    });
  }

  return entries;
}

/**
 * The growspace side's history: the day each plant arrived, and the last time
 * each was watered.
 *
 * Watering is the one place the derived reading is thinner than it looks — a
 * plant stores only its most recent watering, so this shows that one and
 * nothing before it. Everything from here on is recorded properly as it happens.
 */
async function derivedGrowspaceEntries({ from, to }) {
  // Watering is a timestamp rather than a date, so the range is turned into the
  // local midnights either side of it — built from date parts, like every other
  // date in the app, so it doesn't slide a day for anyone behind UTC.
  const startOfDay = fromDateString(from);
  const dayAfter = addDays(fromDateString(to), 1);

  const [{ data: planted }, { data: watered }] = await Promise.all([
    supabase
      .from('plants')
      .select('id, name, species, growspace_id, transplanted_on, growspace:growspaces(name)')
      .gte('transplanted_on', from)
      .lte('transplanted_on', to),
    supabase
      .from('plants')
      .select('id, name, growspace_id, last_watered_at, growspace:growspaces(name)')
      .gte('last_watered_at', startOfDay.toISOString())
      .lt('last_watered_at', dayAfter.toISOString()),
  ]);

  const entries = (planted ?? []).map((plant) => ({
    id: `derived:planted:${plant.id}`,
    kind: 'planted',
    occurred_on: plant.transplanted_on,
    subject: plant.name,
    detail: plant.species ?? null,
    growspace_id: plant.growspace_id,
    station_id: null,
    sowing_id: null,
    plant_id: plant.id,
    place: embeddedName(plant.growspace),
    source: 'growspace',
    derived: true,
  }));

  for (const plant of watered ?? []) {
    entries.push({
      id: `derived:watered:${plant.id}`,
      kind: 'watered',
      occurred_on: toDateString(new Date(plant.last_watered_at)),
      subject: plant.name,
      detail: 'Last watering on record',
      growspace_id: plant.growspace_id,
      station_id: null,
      sowing_id: null,
      plant_id: plant.id,
      place: embeddedName(plant.growspace),
      source: 'growspace',
      derived: true,
    });
  }

  return entries;
}

/**
 * Everything that belongs on the calendar for one month: what was recorded,
 * plus whatever the data itself remembers and the log doesn't already say.
 *
 * With no scope both sides are read, since one calendar now shows the whole
 * grow. A transplant leaves the station side and arrives in the growspace side,
 * and on a single calendar it can finally be read as the one move it was.
 *
 * @param {{ from: string, to: string, scope?: 'station' | 'growspace' | null }} range
 */
export async function fetchActivity({ from, to, scope = null }) {
  const derivedFor = [];
  if (scope !== 'growspace') derivedFor.push(derivedStationEntries({ from, to }));
  if (scope !== 'station') derivedFor.push(derivedGrowspaceEntries({ from, to }));

  const [recorded, ...derived] = await Promise.all([
    fetchEvents({ from, to, scope }),
    ...derivedFor,
  ]);

  return mergeEntries(recorded, derived.flat());
}

/** Removes a recorded entry. Derived ones have nothing to delete. */
export async function deleteEvent(eventId) {
  const { error } = await supabase.from('activity_events').delete().eq('id', eventId);
  if (error) throw error;
}
