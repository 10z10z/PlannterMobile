import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Divider, List, Menu, Text } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import MonthCalendar from "../../components/MonthCalendar";
import { formatDateString, toDateString } from "../../components/DateField";
import {
  fetchActivity,
  groupByDay,
  kindIcon,
  kindLabel,
  monthOf,
  monthRange,
} from "../../lib/activity";
import {
  completeScheduledAction,
  deleteScheduledAction,
  fetchScheduled,
  reopenScheduledAction,
  scheduleKindIcon,
  scheduleStatus,
  scheduleSummary,
} from "../../lib/scheduling";
import SowingFormDialog from "../germination/SowingFormDialog";
import ScheduleActionDialog from "./ScheduleActionDialog";
import FeedingDialog from "./FeedingDialog";

/**
 * A month of what was done and what is planned, for one side of the app.
 *
 * `scope` decides which: 'station' shows the sowing side, 'growspace' the
 * growing side. They read the same log — a transplant leaves one and arrives in
 * the other, and shows up on both calendars from its own end.
 *
 * Entries the app worked out from the data itself are marked as such rather
 * than dressed up as a diary: "sown on the 5th" is something the sowing already
 * knew, and saying so is more honest than implying it was written down at the
 * time.
 */
export default function CalendarScreen({ navigation, route }) {
  const scope = route.params?.scope ?? "growspace";

  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [selected, setSelected] = useState(() => toDateString(new Date()));
  const [entries, setEntries] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [feedingPreset, setFeedingPreset] = useState(null);
  // The scheduled sowing being carried out, so it can be ticked off on save.
  const [sowingFor, setSowingFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const range = monthRange(month);
    try {
      const [activity, plans] = await Promise.all([
        fetchActivity({ ...range, scope }),
        fetchScheduled({ ...range, scope }),
      ]);
      setEntries(activity);
      setScheduled(plans);
    } catch {
      // Leave the month as it was; changing month or reopening retries.
    }
    setLoading(false);
  }, [month, scope]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const entriesByDay = useMemo(() => groupByDay(entries), [entries]);
  const scheduledByDay = useMemo(
    () =>
      groupByDay(
        (scheduled ?? []).map((action) => ({
          ...action,
          occurred_on: action.due_on,
        })),
      ),
    [scheduled],
  );

  const dayEntries = entriesByDay[selected] ?? [];
  const dayPlans = scheduledByDay[selected] ?? [];

  const openSchedule = (action = null) => {
    setEditingAction(action);
    setScheduleOpen(true);
  };

  const handleComplete = async (action) => {
    await completeScheduledAction(action.id, selected);
    load();
  };

  const handleReopen = async (action) => {
    await reopenScheduledAction(action.id);
    load();
  };

  const handleDeletePlan = async (action) => {
    await deleteScheduledAction(action.id);
    load();
  };

  /**
   * Carrying out a plan opens the real form. Sowing has one; feeding has the
   * same dialog the calendar logs feeds through. Anything else is ticked off by
   * hand, because there is no single form that could stand in for it.
   */
  const startAction = (action) => {
    if (action.kind === "sow" && action.station_id) {
      setSowingFor(action);
      return;
    }
    if (action.kind === "feed") {
      setFeedingPreset({
        placeId: action.growspace_id ?? action.station_id,
        actionId: action.id,
      });
      return;
    }
    handleComplete(action);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={`${route.params?.scope === "station" ? "Sowing" : "Growspace"} Calendar`}
        />
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action icon="plus" onPress={() => setMenuOpen(true)} />
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

      <ScrollView contentContainerStyle={styles.content}>
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
            {dayPlans.map((action) => {
              const status = scheduleStatus(action);
              return (
                <View key={action.id}>
                  <List.Item
                    title={action.subject}
                    description={[
                      scheduleSummary(action),
                      action.place,
                      action.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    titleStyle={
                      status === "done" ? styles.doneTitle : undefined
                    }
                    left={(props) => (
                      <List.Icon
                        {...props}
                        icon={
                          status === "done"
                            ? "check-circle-outline"
                            : scheduleKindIcon(action.kind)
                        }
                      />
                    )}
                    onPress={() => openSchedule(action)}
                  />
                  <View style={styles.planActions}>
                    {status === "done" ? (
                      <Button
                        compact
                        mode="text"
                        onPress={() => handleReopen(action)}
                      >
                        Undo
                      </Button>
                    ) : (
                      <>
                        <Button
                          compact
                          mode="text"
                          onPress={() => startAction(action)}
                        >
                          Do it now
                        </Button>
                        <Button
                          compact
                          mode="text"
                          onPress={() => handleComplete(action)}
                        >
                          Mark done
                        </Button>
                      </>
                    )}
                    <Button
                      compact
                      mode="text"
                      onPress={() => handleDeletePlan(action)}
                    >
                      Remove
                    </Button>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {dayEntries.length > 0 && (
          <>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Done
            </Text>
            {dayEntries.map((entry) => (
              <List.Item
                key={entry.id}
                title={`${kindLabel(entry.kind)} · ${entry.subject}`}
                description={[entry.detail, entry.place]
                  .filter(Boolean)
                  .join(" · ")}
                left={(props) => (
                  <List.Icon {...props} icon={kindIcon(entry.kind)} />
                )}
                right={
                  entry.derived
                    ? (props) => (
                        <Text
                          {...props}
                          variant="labelSmall"
                          style={styles.derivedTag}
                        >
                          from records
                        </Text>
                      )
                    : undefined
                }
              />
            ))}
          </>
        )}

        {!loading && dayEntries.length === 0 && dayPlans.length === 0 && (
          <Text style={styles.emptyText}>
            Nothing recorded on this day. Tap + to plan something or log a
            feeding.
          </Text>
        )}
      </ScrollView>

      <ScheduleActionDialog
        visible={scheduleOpen}
        scope={scope}
        action={editingAction}
        defaultDate={selected}
        onDismiss={() => setScheduleOpen(false)}
        onDone={() => {
          setScheduleOpen(false);
          setEditingAction(null);
          load();
        }}
      />

      <FeedingDialog
        visible={!!feedingPreset}
        scope={scope}
        preset={feedingPreset}
        onDismiss={() => setFeedingPreset(null)}
        onDone={async () => {
          // A feed done from a plan ticks the plan off with it.
          if (feedingPreset?.actionId)
            await completeScheduledAction(feedingPreset.actionId, selected);
          setFeedingPreset(null);
          load();
        }}
      />

      <SowingFormDialog
        visible={!!sowingFor}
        stationId={sowingFor?.station_id}
        seedPackId={sowingFor?.seed_pack_id}
        onDismiss={() => setSowingFor(null)}
        onSaved={async () => {
          await completeScheduledAction(sowingFor.id, selected);
          setSowingFor(null);
          load();
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
  planActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingRight: 8,
    marginTop: -8,
  },
  doneTitle: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  derivedTag: {
    alignSelf: "center",
    opacity: 0.5,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 32,
    marginHorizontal: 24,
    opacity: 0.6,
  },
});
