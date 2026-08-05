import { supabase } from './supabase';
import { toDateString } from '../components/DateField';
import { fetchActivity } from './activity';
import { photoperiodLabel } from './growLights';
import { totalSpots } from './growspaces';

/**
 * What the app opens on: what needs doing, how each space is standing, and what
 * was done lately.
 *
 * The order is the point. A grower opening the app in the morning is asking
 * "what have I got to do", not "what have I got" — so the work leads, the
 * spaces follow, and the log comes last as a record rather than a prompt.
 *
 * Nothing here is a new source of truth. Every figure is read from the same
 * tables the rest of the app writes, gathered in a handful of queries and put
 * together here rather than by asking each screen in turn.
 */

/** How far back the log is read, and how far ahead the plans are. */
export const RECENT_DAYS = 14;
export const SOON_DAYS = 7;

/** A `YYYY-MM-DD` moved by whole days, built from local parts like every date. */
export function shiftDate(dateString, days) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  return toDateString(new Date(year, month - 1, day + days));
}

/**
 * Open plans sorted into what they demand.
 *
 * Overdue is kept as its own group rather than folded into today: a sowing that
 * missed its day is a decision to make, and burying it among today's jobs is
 * how it gets missed twice. Nothing is rolled forward.
 */
export function splitSchedule(actions, today = toDateString(new Date())) {
  const open = (actions ?? []).filter((action) => !action.done_on);
  return {
    overdue: open.filter((action) => action.due_on < today),
    today: open.filter((action) => action.due_on === today),
    soon: open.filter((action) => action.due_on > today),
  };
}

/**
 * The photoperiod a space is running, from the lights hanging in it.
 *
 * Fixtures on the same cycle read as one figure; a space running two cycles
 * says so rather than picking a winner, because that is either deliberate or a
 * mistake worth seeing.
 */
export function photoperiodSummary(lights) {
  const cycles = [
    ...new Set(
      (lights ?? [])
        .map((row) => photoperiodLabel(row.hours_on))
        .filter(Boolean)
    ),
  ];
  if (cycles.length === 0) return null;
  if (cycles.length === 1) return `${cycles[0]} h`;
  return `${cycles.length} cycles`;
}

/** One growspace as the dashboard reads it: what is in it and how it is held. */
export function growspaceStats(growspace, { plants, grids, lights }) {
  const mine = (rows) => (rows ?? []).filter((row) => row.growspace_id === growspace.id);
  const spaceGrids = mine(grids);

  return {
    ...growspace,
    plantCount: mine(plants).length,
    spots: totalSpots(spaceGrids),
    gridCount: spaceGrids.length,
    photoperiod: photoperiodSummary(mine(lights)),
  };
}

/**
 * Plans still open and near enough to matter: everything overdue however old,
 * plus the next week.
 *
 * Bounded by being open rather than by a start date — an overdue job from two
 * months ago is exactly the one worth showing, and a window would hide it.
 */
export async function fetchOpenActions({ today, soonDays = SOON_DAYS }) {
  const { data, error } = await supabase
    .from('scheduled_actions')
    .select('*, growspace:growspaces(name), station:germination_stations(name)')
    .is('done_on', null)
    .lte('due_on', shiftDate(today, soonDays))
    .order('due_on', { ascending: true })
    .order('due_minutes', { ascending: true, nullsFirst: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    place: row.growspace?.name ?? row.station?.name ?? null,
    source: row.station_id ? 'station' : 'growspace',
  }));
}

/** Every growspace with the figures that describe it, in the order they're kept. */
export async function fetchGrowspaceOverview() {
  const [growspaces, plants, grids, lights] = await Promise.all([
    supabase.from('growspaces').select('*').order('created_at'),
    supabase.from('plants').select('id, growspace_id').not('growspace_id', 'is', null),
    supabase.from('growspace_grids').select('growspace_id, grid_rows, grid_cols'),
    supabase.from('growspace_lights').select('growspace_id, hours_on'),
  ]);

  return (growspaces.data ?? []).map((growspace) =>
    growspaceStats(growspace, {
      plants: plants.data,
      grids: grids.data,
      lights: lights.data,
    })
  );
}

/**
 * Everything the dashboard shows, in one pass.
 *
 * The three sections are fetched together rather than by section, so the screen
 * arrives whole instead of filling in around the reader.
 */
export async function fetchDashboard({
  today = toDateString(new Date()),
  recentDays = RECENT_DAYS,
  soonDays = SOON_DAYS,
} = {}) {
  const [actions, growspaces, activity] = await Promise.all([
    fetchOpenActions({ today, soonDays }),
    fetchGrowspaceOverview(),
    fetchActivity({ from: shiftDate(today, -recentDays), to: today }),
  ]);

  return {
    schedule: splitSchedule(actions, today),
    growspaces,
    // Newest first: the log is read backwards from now.
    recent: [...activity].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)),
  };
}
