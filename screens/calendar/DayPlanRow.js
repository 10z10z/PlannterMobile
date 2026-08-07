import { StyleSheet, View } from 'react-native';
import { Button, List } from 'react-native-paper';
import {
  scheduleKindIcon,
  scheduleStatus,
  scheduleSummary,
  targetSummary,
} from '../../lib/scheduling';

/**
 * One planned job on a day, and what can be done about it.
 *
 * The three buttons are the whole of this screen's writing, and which of them
 * appear is the one decision on the row: an open plan can be carried out or
 * ticked off, a finished one can only be undone, and either can be removed.
 * "Do it now" and "Mark done" are different things — the first opens the form
 * that does the work properly, the second says it was done elsewhere.
 *
 * @param {object} props
 * @param {any} props.action
 * @param {(action: any) => void} props.onOpen Edit the plan itself.
 * @param {(action: any) => void} props.onStart Carry it out.
 * @param {(action: any) => void} props.onComplete Tick it off without doing it here.
 * @param {(action: any) => void} props.onReopen
 * @param {(action: any) => void} props.onRemove
 */
export default function DayPlanRow({ action, onOpen, onStart, onComplete, onReopen, onRemove }) {
  const status = scheduleStatus(action);
  const done = status === 'done';

  return (
    <View>
      <List.Item
        title={action.subject}
        description={[
          scheduleSummary(action),
          // What it is aimed at, or the place when it is aimed at all of it.
          targetSummary(action.targets) ?? action.place,
          action.note,
        ]
          .filter(Boolean)
          .join(' · ')}
        titleStyle={done ? styles.doneTitle : undefined}
        left={(props) => (
          <List.Icon
            {...props}
            icon={done ? 'check-circle-outline' : scheduleKindIcon(action.kind)}
          />
        )}
        onPress={() => onOpen(action)}
      />
      <View style={styles.actions}>
        {done ? (
          <Button compact mode="text" onPress={() => onReopen(action)}>
            Undo
          </Button>
        ) : (
          <>
            <Button compact mode="text" onPress={() => onStart(action)}>
              Do it now
            </Button>
            <Button compact mode="text" onPress={() => onComplete(action)}>
              Mark done
            </Button>
          </>
        )}
        <Button compact mode="text" onPress={() => onRemove(action)}>
          Remove
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 8,
    marginTop: -8,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
});
