import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Divider, Menu, Text } from 'react-native-paper';
import MonthCalendar from '../../components/MonthCalendar';
import CalendarFilterBar from '../../components/CalendarFilterBar';
import {
  useActivity,
  useCompleteAction,
  useReopenAction,
  useScheduled,
} from '../../hooks/useDashboard';
import { useDataMutation } from '../../hooks/useDataMutation';
import useRefresh from '../../hooks/useRefresh';
import useCalendarFilters from '../../hooks/useCalendarFilters';
import { useSnackbar } from '../../contexts/SnackbarContext';
import ScreenTitle from '../../components/ScreenTitle';
import { formatDateString, toDateString } from '../../lib/dates';
import { fromDateString, groupByDay, monthOf, monthRange } from '../../lib/activity';
import { filterActions, filterEntries, isFiltered } from '../../lib/calendarFilters';
import { deleteScheduledAction } from '../../lib/scheduling';
import SowingFormDialog from '../germination/SowingFormDialog';
import ScheduleActionDialog from './ScheduleActionDialog';
import FeedingDialog from './FeedingDialog';
import DayEntryRow from './DayEntryRow';
import DayPlanRow from './DayPlanRow';

/**
 * A month of what was done and what is planned, across the whole grow.
 *
 * There is one calendar rather than one per side of the app. A transplant leaves
 * a station and arrives in a growspace, and splitting the two meant reading half
 * the move on each of two screens; here it is one week's work in one place, and
 * the chips above narrow it to whatever is being looked for.
 *
 * Entries the app worked out from the data itself are marked as such rather
 * than dressed up as a diary: "sown on the 5th" is something the sowing already
 * knew, and saying so is more honest than implying it was written down at the
 * time.
 */
export default function CalendarScreen({ navigation, route }) {
  // Opened on a particular day when something was tapped to get here — the
  // dashboard hands over the day the job or the entry belongs to.
  const opensOn = route?.params?.date ?? toDateString(new Date());

  const [month, setMonth] = useState(() => monthOf(fromDateString(opensOn)));
  const [selected, setSelected] = useState(opensOn);
  const range = useMemo(() => monthRange(month), [month]);
  // Two reads rather than one: what was done and what is planned are separate
  // questions, and one of them failing shouldn't empty the month of the other.
  const activityQuery = useActivity(range);
  const scheduledQuery = useScheduled(range);

  // Both halves of the month: what was recorded and what is planned.
  const refresh = useRefresh([activityQuery, scheduledQuery]);

  const entries = useMemo(() => activityQuery.data ?? [], [activityQuery.data]);
  const scheduled = useMemo(() => scheduledQuery.data ?? [], [scheduledQuery.data]);
  const loading = activityQuery.isPending || scheduledQuery.isPending;
  const { filters, toggle: toggleChip, clear: clearFilters } = useCalendarFilters();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [feedingPreset, setFeedingPreset] = useState(null);
  // The scheduled sowing being carried out, so it can be ticked off on save.
  const [sowingFor, setSowingFor] = useState(null);

  const entriesByDay = useMemo(
    () => groupByDay(filterEntries(entries, filters)),
    [entries, filters]
  );
  const scheduledByDay = useMemo(
    () =>
      groupByDay(
        filterActions(scheduled, filters).map((action) => ({
          ...action,
          occurred_on: action.due_on,
        }))
      ),
    [scheduled, filters]
  );

  const dayEntries = entriesByDay[selected] ?? [];
  const dayPlans = scheduledByDay[selected] ?? [];

  // Whether the day is empty because nothing happened on it, or because the
  // chips are hiding what did — two different things to tell someone.
  const dayHasHidden =
    entries.some((entry) => entry.occurred_on === selected) ||
    scheduled.some((action) => action.due_on === selected);

  const openSchedule = (action = null) => {
    setEditingAction(action);
    setScheduleOpen(true);
  };

  const complete = useCompleteAction();
  const reopen = useReopenAction();
  const { notify } = useSnackbar();
  const removePlan = useDataMutation({
    mutationFn: deleteScheduledAction,
    affects: 'scheduleChanged',
  });

  const handleComplete = (action) => {
    complete.mutate({ actionId: action.id, doneOn: selected });
    // The same offer the dashboard makes, since it is the same press.
    notify(`${action.subject} — done`, {
      label: 'Undo',
      onPress: () => reopen.mutate(action.id),
    });
  };
  const handleReopen = (action) => reopen.mutate(action.id);
  const handleDeletePlan = (action) => removePlan.mutate(action.id);

  /**
   * Carrying out a plan opens the real form. Sowing has one; feeding has the
   * same dialog the calendar logs feeds through. Anything else is ticked off by
   * hand, because there is no single form that could stand in for it.
   */
  const startAction = (action) => {
    if (action.kind === 'sow' && action.station_id) {
      setSowingFor(action);
      return;
    }
    if (action.kind === 'feed') {
      setFeedingPreset({
        placeId: action.growspace_id ?? action.station_id,
        actionId: action.id,
        // The plants the plan named arrive already picked out, which is the
        // whole point of having named them a fortnight ago.
        plants: (action.targets ?? [])
          .filter((target) => target.plant_id)
          .map((target) => ({ id: target.plant_id, name: target.label })),
      });
      return;
    }
    handleComplete(action);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={<ScreenTitle icon="calendar-month-outline" label="Calendar" />} />
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            // It opens a menu rather than doing one thing, so it says so — "Add"
            // on its own promises an action that isn't coming.
            <Appbar.Action
              icon="plus"
              accessibilityLabel="Add to the calendar"
              onPress={() => setMenuOpen(true)}
            />
          }
        >
          <Menu.Item
            title="Schedule an action"
            leadingIcon="calendar-plus"
            onPress={() => {
              setMenuOpen(false);
              openSchedule();
            }}
          />
          <Menu.Item
            title="Log a feeding"
            leadingIcon="cup-water"
            onPress={() => {
              setMenuOpen(false);
              setFeedingPreset({});
            }}
          />
        </Menu>
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl {...refresh} />}
      >
        <CalendarFilterBar filters={filters} onToggle={toggleChip} onReset={clearFilters} />

        <MonthCalendar
          month={month}
          entriesByDay={entriesByDay}
          scheduledByDay={scheduledByDay}
          selected={selected}
          onSelect={setSelected}
          onChangeMonth={setMonth}
        />

        <Divider style={styles.divider} />

        <Text variant="titleMedium" style={styles.dayHeading}>
          {formatDateString(selected)}
        </Text>

        {dayPlans.length > 0 && (
          <>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Planned
            </Text>
            {dayPlans.map((action) => (
              <DayPlanRow
                key={action.id}
                action={action}
                onOpen={openSchedule}
                onStart={startAction}
                onComplete={handleComplete}
                onReopen={handleReopen}
                onRemove={handleDeletePlan}
              />
            ))}
          </>
        )}

        {dayEntries.length > 0 && (
          <>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Done
            </Text>
            {dayEntries.map((entry) => (
              <DayEntryRow key={entry.id} entry={entry} />
            ))}
          </>
        )}

        {!loading &&
          dayEntries.length === 0 &&
          dayPlans.length === 0 &&
          // Two different empty days needing two different ways out: one where
          // the day really is bare, and one where the chips are hiding it. The
          // second used to say so and leave the grower to work out that the fix
          // was above them rather than behind the + button.
          (dayHasHidden && isFiltered(filters) ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>Nothing on this day matches the chips above.</Text>
              <Button mode="contained-tonal" icon="filter-remove-outline" onPress={clearFilters}>
                Show everything
              </Button>
            </View>
          ) : (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>Nothing recorded on this day.</Text>
              <Button mode="contained-tonal" icon="calendar-plus" onPress={() => openSchedule()}>
                Plan something
              </Button>
            </View>
          ))}
      </ScrollView>

      <ScheduleActionDialog
        visible={scheduleOpen}
        action={editingAction}
        defaultDate={selected}
        onDismiss={() => setScheduleOpen(false)}
        onDone={() => {
          setScheduleOpen(false);
          setEditingAction(null);
        }}
      />

      <FeedingDialog
        visible={!!feedingPreset}
        preset={feedingPreset}
        onDismiss={() => setFeedingPreset(null)}
        onDone={() => {
          // A feed done from a plan ticks the plan off with it.
          if (feedingPreset?.actionId) {
            complete.mutate({ actionId: feedingPreset.actionId, doneOn: selected });
          }
          setFeedingPreset(null);
        }}
      />

      <SowingFormDialog
        visible={!!sowingFor}
        stationId={sowingFor?.station_id}
        seedPackId={sowingFor?.seed_pack_id}
        onDismiss={() => setSowingFor(null)}
        onSaved={() => {
          complete.mutate({ actionId: sowingFor.id, doneOn: selected });
          setSowingFor(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  divider: {
    marginTop: 12,
  },
  dayHeading: {
    marginTop: 12,
    marginHorizontal: 16,
  },
  sectionLabel: {
    marginTop: 12,
    marginHorizontal: 16,
    opacity: 0.7,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    marginHorizontal: 24,
    opacity: 0.6,
  },
});
