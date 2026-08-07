import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Divider, IconButton, List, Text, useTheme } from 'react-native-paper';
import ScreenTitle from '../../components/ScreenTitle';
import GrowspaceSummaryCard from '../../components/GrowspaceSummaryCard';
import { daysSince, formatDateString, toDateString } from '../../lib/dates';
import { kindIcon, kindLabel } from '../../lib/activity';
import { RECENT_DAYS, SOON_DAYS } from '../../lib/dashboard';
import { useCompleteAction, useDashboard } from '../../hooks/useDashboard';
import { scheduleKindIcon, scheduleSummary, targetSummary } from '../../lib/scheduling';

/** How much of the log the landing page carries before it becomes the calendar. */
const RECENT_SHOWN = 8;

/**
 * The landing page: what needs doing, how the spaces are standing, what was
 * done lately.
 *
 * Work leads because that is the question the app is opened with. Overdue jobs
 * are given their own heading above today's rather than mixed in, since a job
 * that already slipped once is the one most likely to slip again.
 *
 * Nothing here is a place to do the work properly — each row is a way into the
 * screen that is. The one exception is ticking a job off, which needs no form
 * and is most of what a morning round amounts to.
 */
export default function DashboardScreen({ navigation }) {
  const theme = useTheme();
  const today = toDateString(new Date());

  const dashboard = useDashboard(today);
  const data = dashboard.data ?? null;

  const complete = useCompleteAction();

  const openCalendar = (date) => navigation.navigate('Calendar', { date });

  // The growspace tabs are named by growspace id, so the card opens the one it
  // is showing rather than whichever tab happened to be left open.
  const openGrowspace = (growspace) =>
    navigation.navigate('Growspaces', {
      screen: 'GrowspacesOverview',
      params: { screen: growspace.id },
    });

  // Ticking a job off is the only thing this screen does itself; everything
  // else is a way into the screen that does the work properly.
  const markDone = (action) => complete.mutate({ actionId: action.id, doneOn: today });

  const schedule = data?.schedule;
  const growspaces = data?.growspaces ?? [];
  const recent = data?.recent ?? [];
  const nothingDue =
    schedule && !schedule.overdue.length && !schedule.today.length && !schedule.soon.length;

  /** A planned job as a row: what, where, and a tick to be done with it. */
  const planRow = (action, { late = false } = {}) => {
    const slipped = late ? daysSince(action.due_on) : null;

    return (
      <List.Item
        key={action.id}
        title={action.subject}
        description={[
          scheduleSummary(action),
          targetSummary(action.targets) ?? action.place,
          slipped ? `${slipped}d late` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        onPress={() => openCalendar(action.due_on)}
        left={(props) => (
          <List.Icon
            {...props}
            icon={scheduleKindIcon(action.kind)}
            color={late ? theme.colors.error : undefined}
          />
        )}
        right={() => (
          <IconButton
            icon="check"
            accessibilityLabel={`Mark ${action.subject} done`}
            onPress={() => markDone(action)}
          />
        )}
      />
    );
  };

  const heading = (text, trailing = null) => (
    <View style={styles.heading}>
      <Text variant="titleSmall" style={styles.headingText}>
        {text}
      </Text>
      {trailing}
    </View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title={<ScreenTitle icon="view-dashboard-outline" label="Dashboard" />} />
        <Appbar.Action
          icon="calendar-month-outline"
          accessibilityLabel="Calendar"
          onPress={() => openCalendar(today)}
        />
        <Appbar.Action
          icon="cog-outline"
          accessibilityLabel="Settings"
          onPress={() => navigation.navigate('Settings')}
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={dashboard.isRefetching} onRefresh={dashboard.refetch} />
        }
      >
        {schedule?.overdue.length > 0 && (
          <>
            {heading(
              `Overdue · ${schedule.overdue.length}`,
              <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                needs a decision
              </Text>
            )}
            {schedule.overdue.map((action) => planRow(action, { late: true }))}
          </>
        )}

        {schedule?.today.length > 0 && (
          <>
            {heading('Today')}
            {schedule.today.map((action) => planRow(action))}
          </>
        )}

        {schedule?.soon.length > 0 && (
          <>
            {heading(`Next ${SOON_DAYS} days`)}
            {schedule.soon.map((action) => (
              <List.Item
                key={action.id}
                title={action.subject}
                description={[
                  formatDateString(action.due_on),
                  targetSummary(action.targets) ?? action.place,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => openCalendar(action.due_on)}
                left={(props) => <List.Icon {...props} icon={scheduleKindIcon(action.kind)} />}
              />
            ))}
          </>
        )}

        {nothingDue && (
          <View style={styles.clear}>
            <Text variant="bodyMedium" style={styles.clearText}>
              Nothing due. Plan something from the calendar.
            </Text>
          </View>
        )}

        {growspaces.length > 0 && (
          <>
            <Divider style={styles.divider} />
            {heading('Growspaces')}
            <View style={styles.cards}>
              {growspaces.map((growspace) => (
                <GrowspaceSummaryCard
                  key={growspace.id}
                  growspace={growspace}
                  onPress={() => openGrowspace(growspace)}
                />
              ))}
            </View>
          </>
        )}

        {recent.length > 0 && (
          <>
            <Divider style={styles.divider} />
            {heading(
              'Recent activity',
              <Button compact mode="text" onPress={() => openCalendar(today)}>
                Calendar
              </Button>
            )}
            {recent.slice(0, RECENT_SHOWN).map((entry) => (
              <List.Item
                key={entry.id}
                title={`${kindLabel(entry.kind)} · ${entry.subject}`}
                description={[formatDateString(entry.occurred_on), entry.place]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => openCalendar(entry.occurred_on)}
                left={(props) => <List.Icon {...props} icon={kindIcon(entry.kind)} />}
              />
            ))}
          </>
        )}

        {!dashboard.isPending && !growspaces.length && !recent.length && (
          <Text style={styles.emptyText}>
            Nothing here yet. Add a growspace or sow something, and this page fills in.
          </Text>
        )}

        {!dashboard.isPending && recent.length === 0 && growspaces.length > 0 && (
          <Text variant="bodySmall" style={styles.quietText}>
            Nothing recorded in the last {RECENT_DAYS} days.
          </Text>
        )}
      </ScrollView>
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
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 4,
    marginHorizontal: 16,
  },
  headingText: {
    opacity: 0.7,
  },
  divider: {
    marginTop: 12,
  },
  cards: {
    marginHorizontal: 16,
  },
  clear: {
    marginTop: 24,
    marginHorizontal: 24,
  },
  clearText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    marginHorizontal: 24,
    opacity: 0.6,
  },
  quietText: {
    marginTop: 12,
    marginHorizontal: 16,
    opacity: 0.55,
  },
});
