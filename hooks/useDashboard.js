import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../lib/dashboard';
import { completeScheduledAction, fetchScheduled, reopenScheduledAction } from '../lib/scheduling';
import { fetchActivity } from '../lib/activity';
import { keys } from '../lib/queryKeys';
import { useDataMutation } from './useDataMutation';

/**
 * The landing screen, and the calendar behind it.
 *
 * Both are summaries of everything else, which is why nearly every action in
 * the app names them in `AFFECTED_BY` — watering a plant, sowing a tray or
 * ticking a job off all change what the dashboard should say.
 *
 * Keyed by the day they were asked about, so the summary rolls over at midnight
 * rather than showing yesterday's "due today" until the app is reopened.
 */
export function useDashboard(today) {
  return useQuery({
    queryKey: keys.dashboard.summary(today),
    queryFn: () => fetchDashboard({ today }),
  });
}

/**
 * Every open plan except the one just ticked off.
 *
 * The dashboard holds them already sorted into overdue / today / soon, so a
 * completed job leaves whichever group it was in rather than being marked done
 * in place — the screen has no "done" row to show it in.
 */
function withoutAction(schedule, actionId) {
  const drop = (group) => (group ?? []).filter((action) => action.id !== actionId);
  return {
    ...schedule,
    overdue: drop(schedule.overdue),
    today: drop(schedule.today),
    soon: drop(schedule.soon),
  };
}

/** @param {{ onSuccess?: () => void }} [options] */
export function useCompleteAction({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: ({ actionId, doneOn }) => completeScheduledAction(actionId, doneOn),
    affects: 'scheduleChanged',
    /**
     * One tap with one meaning: the job goes away. Waiting a round trip to see
     * that makes the tap feel unregistered — and the next thing a grower does
     * is tick the one below it, against a list that hasn't moved yet.
     */
    optimistic: (queryClient, { actionId, doneOn }) => {
      queryClient.setQueriesData({ queryKey: keys.dashboard.all }, (current) =>
        current?.schedule
          ? { ...current, schedule: withoutAction(current.schedule, actionId) }
          : current
      );

      // The calendar holds the rows themselves, where being done is a date
      // rather than an absence — the same job, shown as a different thing.
      queryClient.setQueriesData({ queryKey: keys.calendar.all }, (current) =>
        Array.isArray(current)
          ? current.map((row) => (row.id === actionId ? { ...row, done_on: doneOn } : row))
          : current
      );
    },
    onSuccess,
  });
}

/** @param {{ onSuccess?: () => void }} [options] */
export function useReopenAction({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: reopenScheduledAction,
    affects: 'scheduleChanged',
    onSuccess,
  });
}

/** What was recorded in a month, plus what the data itself remembers. */
export function useActivity({ from, to }) {
  return useQuery({
    queryKey: keys.calendar.activity(from, to),
    queryFn: () => fetchActivity({ from, to }),
    enabled: !!from && !!to,
  });
}

/** What is planned in a month. */
export function useScheduled({ from, to }) {
  return useQuery({
    queryKey: keys.calendar.scheduled(from, to),
    queryFn: () => fetchScheduled({ from, to }),
    enabled: !!from && !!to,
  });
}
