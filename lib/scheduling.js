import { supabase } from './supabase';
import { toDateString } from '../components/DateField';
import { SCHEDULE_CHANNEL, cancelReminder, scheduleReminderAt } from './notifications';

/**
 * Actions a grower has decided to do on a day, and the reminders that go with
 * them.
 *
 * Scheduling never performs the work. A scheduled sowing is a note saying which
 * crop goes in and when — the tray, the cells and the seed count are decided on
 * the day, in the form the sowing is normally made through, because by then the
 * pack may have run low and the tray may be in use. So what is stored here is an
 * intention, and marking it done is the grower's own act rather than a side
 * effect of the date passing.
 */

/**
 * What each kind of action is aimed at.
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

function kindEntry(kind) {
  return SCHEDULE_KINDS.find((entry) => entry.value === kind);
}

export function scheduleKindLabel(kind) {
  return kindEntry(kind)?.label ?? 'Action';
}

export function scheduleKindIcon(kind) {
  return kindEntry(kind)?.icon ?? 'calendar-check-outline';
}

/**
 * Whether this kind, in this sort of place, has anything to pick from.
 *
 * A growspace holds plants and a station holds sowings, so what a feed can be
 * aimed at depends on where it is being fed. A kind that names no targets at
 * all — sowing something, or an "other" job described in words — has nothing to
 * offer either way.
 */
export function targetKindFor(kind, placeType) {
  const targets = kindEntry(kind)?.targets;
  if (!targets) return null;
  if (targets === 'sowings') return placeType === 'station' ? 'sowings' : null;
  return placeType === 'station' ? 'sowings' : 'plants';
}

/** Whether picking nothing means the whole place rather than nothing decided. */
export function allowsWholePlace(kind) {
  return kindEntry(kind)?.whole === true;
}

/**
 * The targets as a line of text: a couple of names, or a count once there are
 * too many to read. Null when the plan is for the whole place, which the screens
 * say in their own words rather than by listing everything in it.
 */
export function targetSummary(targets, { limit = 2 } = {}) {
  const labels = (targets ?? []).map((target) => target.label).filter(Boolean);
  if (labels.length === 0) return null;
  if (labels.length <= limit) return labels.join(', ');
  return `${labels.slice(0, limit).join(', ')} +${labels.length - limit}`;
}

/** Minutes past midnight as a 24-hour clock reading: 510 -> "08:30". */
export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return null;
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The clock part of a picked time, as the offset the schema stores. */
export function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/** A date string and a minute offset as one local moment, for the reminder. */
export function dueAt(action) {
  if (!action?.due_on) return null;
  const [year, month, day] = String(action.due_on).split('-').map(Number);
  if (!year || !month || !day) return null;
  const minutes = action.due_minutes ?? 0;
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
}

/**
 * Where an action stands: ticked off, past its day, due today, or still ahead.
 * Overdue is kept visible rather than rolled forward — a sowing that missed its
 * day is a decision to make, not a task to silently move.
 */
export function scheduleStatus(action, today = toDateString(new Date())) {
  if (action?.done_on) return 'done';
  if (action?.due_on < today) return 'overdue';
  if (action?.due_on === today) return 'due';
  return 'upcoming';
}

/** "Sow · 08:30", or just the kind when no reminder time was set. */
export function scheduleSummary(action) {
  const time = formatMinutes(action?.due_minutes);
  return [scheduleKindLabel(action?.kind), time].filter(Boolean).join(' · ');
}

/** What the reminder says when it fires. */
export function reminderText(action) {
  return {
    title: `${scheduleKindLabel(action.kind)}: ${action.subject}`,
    body: action.note?.trim() || 'Scheduled in Plannter for today.',
  };
}

/**
 * Books the local reminder for an action, if it has a time and is still open.
 * The notification is identified by the action's own id, so saving it again
 * replaces the old one rather than stacking a second alert on the same job.
 */
export async function scheduleReminder(action) {
  if (!action?.id) return false;
  if (action.done_on || action.due_minutes === null || action.due_minutes === undefined) {
    await cancelReminder(action.id);
    return false;
  }

  const { title, body } = reminderText(action);
  return scheduleReminderAt({
    id: action.id,
    title,
    body,
    date: dueAt(action),
    channelId: SCHEDULE_CHANNEL,
  });
}

/** The scheduled actions falling in a date range, both sides unless scoped. */
export async function fetchScheduled({ from, to, scope }) {
  let query = supabase
    .from('scheduled_actions')
    .select(
      '*, growspace:growspaces(name), station:germination_stations(name), targets:scheduled_action_targets(*)'
    )
    .gte('due_on', from)
    .lte('due_on', to)
    .order('due_on', { ascending: true })
    .order('due_minutes', { ascending: true, nullsFirst: true });

  if (scope === 'station') query = query.not('station_id', 'is', null);
  else if (scope === 'growspace') query = query.not('growspace_id', 'is', null);
  else query = query.or('growspace_id.not.is.null,station_id.not.is.null');

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    place: row.growspace?.name ?? row.station?.name ?? null,
    source: row.station_id ? 'station' : 'growspace',
    targets: row.targets ?? [],
  }));
}

/**
 * Anything still open and already past its day, so the calendar can say so on
 * the month it is showing rather than only on the day it was missed.
 */
export function overdueActions(actions, today = toDateString(new Date())) {
  return (actions ?? []).filter((action) => scheduleStatus(action, today) === 'overdue');
}

/**
 * Replaces what an action is aimed at.
 *
 * Cleared and rewritten rather than diffed: a handful of plants is a small
 * enough set that matching the picker exactly is worth more than saving a round
 * trip, and it is the same shape a feed's plants are saved in.
 */
async function saveTargets({ userId, actionId, targets }) {
  const { error: clearError } = await supabase
    .from('scheduled_action_targets')
    .delete()
    .eq('action_id', actionId);
  if (clearError) throw clearError;

  if (!targets?.length) return;

  const { error } = await supabase.from('scheduled_action_targets').insert(
    targets.map((target) => ({
      user_id: userId,
      action_id: actionId,
      plant_id: target.plantId ?? null,
      sowing_id: target.sowingId ?? null,
      label: target.label,
    }))
  );
  if (error) throw error;
}

/**
 * Creates or updates a scheduled action with what it is aimed at, and books its
 * reminder either way.
 */
export async function saveScheduledAction({ userId, id, targets, ...fields }) {
  const payload = {
    kind: fields.kind,
    due_on: fields.dueOn,
    due_minutes: fields.dueMinutes ?? null,
    growspace_id: fields.growspaceId ?? null,
    station_id: fields.stationId ?? null,
    subject: fields.subject,
    note: fields.note?.trim() || null,
    seed_pack_id: fields.seedPackId ?? null,
  };

  const query = id
    ? supabase.from('scheduled_actions').update(payload).eq('id', id)
    : supabase.from('scheduled_actions').insert({ ...payload, user_id: userId });

  const { data, error } = await query.select().single();
  if (error) throw error;

  await saveTargets({ userId, actionId: data.id, targets });

  await scheduleReminder(data);
  return data;
}

/**
 * Ticks an action off on the day it was actually done, which need not be the
 * day it was due for. Its reminder goes with it.
 */
export async function completeScheduledAction(actionId, doneOn = toDateString(new Date())) {
  const { data, error } = await supabase
    .from('scheduled_actions')
    .update({ done_on: doneOn })
    .eq('id', actionId)
    .select()
    .single();
  if (error) throw error;

  await cancelReminder(actionId);
  return data;
}

/** Puts a ticked-off action back on the list, reminder and all. */
export async function reopenScheduledAction(actionId) {
  const { data, error } = await supabase
    .from('scheduled_actions')
    .update({ done_on: null })
    .eq('id', actionId)
    .select()
    .single();
  if (error) throw error;

  await scheduleReminder(data);
  return data;
}

export async function deleteScheduledAction(actionId) {
  await cancelReminder(actionId);
  const { error } = await supabase.from('scheduled_actions').delete().eq('id', actionId);
  if (error) throw error;
}
