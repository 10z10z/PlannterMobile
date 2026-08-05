import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Divider, useTheme } from 'react-native-paper';
import {
  EVENT_GROUPS,
  PLACE_FILTERS,
  RECORD_FILTERS,
  isFiltered,
} from '../lib/calendarFilters';

/**
 * The row of chips above the calendar, saying what it is showing.
 *
 * Three dimensions share one scrolling row, separated by rules rather than by
 * labels: where, plan or record, and what sort of job. Labelling them would cost
 * a line of screen each on a bar that has to stay out of the calendar's way, and
 * the chips say what they are.
 *
 * They are always on screen rather than behind a filter button, because a
 * calendar that is quietly hiding half the grow should look like it is.
 */
export default function CalendarFilterBar({ filters, onToggle, onReset }) {
  const theme = useTheme();

  const chip = (dimension, entry, selected) => (
    <Chip
      key={`${dimension}:${entry.value}`}
      compact
      icon={entry.icon}
      mode={selected ? 'flat' : 'outlined'}
      selected={selected}
      showSelectedCheck={false}
      onPress={() => onToggle(dimension, entry.value)}
      style={[styles.chip, !selected && styles.chipOff]}
    >
      {entry.label}
    </Chip>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {PLACE_FILTERS.map((entry) =>
        chip('places', entry, filters.places.includes(entry.value))
      )}

      <Divider style={[styles.rule, { backgroundColor: theme.colors.outlineVariant }]} />

      {RECORD_FILTERS.map((entry) =>
        chip('records', entry, filters.records.includes(entry.value))
      )}

      <Divider style={[styles.rule, { backgroundColor: theme.colors.outlineVariant }]} />

      {EVENT_GROUPS.map((group) =>
        chip('groups', group, filters.groups.includes(group.value))
      )}

      {isFiltered(filters) && (
        <View style={styles.reset}>
          <Chip compact icon="filter-off-outline" mode="outlined" onPress={onReset}>
            Show all
          </Chip>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chip: {
    // A chip that is switched off keeps its width, so the row doesn't shuffle
    // under the finger as it is tapped.
    minHeight: 32,
  },
  chipOff: {
    opacity: 0.55,
  },
  rule: {
    width: 1,
    height: 20,
    marginHorizontal: 2,
  },
  reset: {
    marginLeft: 2,
  },
});
