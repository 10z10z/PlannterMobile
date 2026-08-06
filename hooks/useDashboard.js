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

/** @param {{ onSuccess?: () => void }} [options] */
export function useCompleteAction({ onSuccess } = {}) {
  return useDataMutation({
    mutationFn: ({ actionId, doneOn }) => completeScheduledAction(actionId, doneOn),
    affects: 'scheduleChanged',
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
