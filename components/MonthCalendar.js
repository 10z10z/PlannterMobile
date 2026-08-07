import { StyleSheet, View } from 'react-native';
import { IconButton, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { WEEKDAYS, monthLabel, monthWeeks, shiftMonth } from '../lib/activity';
import { toDateString } from '../lib/dates';

/**
 * A month at a glance: which days something was done on, and which have
 * something planned.
 *
 * A day carries at most three dots for what was recorded, so a busy day reads
 * as busy without the grid turning into a chart, and a ring for anything still
 * scheduled — a plan and a record are different claims about a day, and the
 * calendar shouldn't blur them.
 *
 * The dots are coloured by which side of the grow the entry came from, since one
 * calendar now shows both: a day of sowing and a day in the tent shouldn't look
 * the same from the month view.
 */
/**
 * Anything the app worked out for itself stays grey, whichever side it came
 * from — the muted dot is saying "this was inferred", which outranks where.
 */
function dotColor(theme, entry) {
  if (entry.derived) return theme.colors.outline;
  return entry.source === 'station' ? theme.colors.secondary : theme.colors.primary;
}

export default function MonthCalendar({
  month,
  entriesByDay,
  scheduledByDay,
  selected,
  onSelect,
  onChangeMonth,
}) {
  const theme = useTheme();
  const today = toDateString(new Date());
  const weeks = monthWeeks(month);

  return (
    <View>
      <View style={styles.header}>
        {/* Named after the month they land on rather than "previous" and
            "next", so the announcement says where the press goes. */}
        <IconButton
          icon="chevron-left"
          accessibilityLabel={monthLabel(shiftMonth(month, -1))}
          onPress={() => onChangeMonth(shiftMonth(month, -1))}
        />
        <Text variant="titleMedium">{monthLabel(month)}</Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel={monthLabel(shiftMonth(month, 1))}
          onPress={() => onChangeMonth(shiftMonth(month, 1))}
        />
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((day) => (
          <Text key={day} variant="labelSmall" style={[styles.weekday, styles.cell]}>
            {day}
          </Text>
        ))}
      </View>

      {weeks.map((days) => (
        <View key={days[0].dateString} style={styles.week}>
          {days.map((day) => {
            const entries = entriesByDay?.[day.dateString] ?? [];
            const planned = scheduledByDay?.[day.dateString] ?? [];
            const isSelected = day.dateString === selected;
            const isToday = day.dateString === today;
            const open = planned.some((action) => !action.done_on);

            return (
              <View key={day.dateString} style={styles.cell}>
                <TouchableRipple
                  borderless
                  onPress={() => onSelect(day.dateString)}
                  style={[
                    styles.day,
                    isSelected && { backgroundColor: theme.colors.primaryContainer },
                    // Today is ringed rather than filled, so the fill can go on
                    // saying "this is the day you're looking at".
                    !isSelected && isToday && { borderColor: theme.colors.primary, borderWidth: 1 },
                    open && !isSelected && { borderColor: theme.colors.tertiary, borderWidth: 1 },
                  ]}
                >
                  <View style={styles.dayInner}>
                    <Text
                      variant="bodyMedium"
                      style={[
                        !day.inMonth && styles.muted,
                        isSelected && { color: theme.colors.onPrimaryContainer },
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                    <View style={styles.dots}>
                      {entries.slice(0, 3).map((entry) => (
                        <View
                          key={entry.id}
                          style={[styles.dot, { backgroundColor: dotColor(theme, entry) }]}
                        />
                      ))}
                    </View>
                  </View>
                </TouchableRipple>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  week: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  weekday: {
    opacity: 0.6,
    marginBottom: 4,
  },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    opacity: 0.35,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 5,
    marginTop: 1,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
