import { StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { kindIcon, kindLabel } from '../../lib/activity';

/**
 * One thing that happened on a day.
 *
 * The tag is the point of it. Half these entries were written down when the
 * thing was done, and half are the app reading a date off a row it already
 * had — a sowing knows when it was sown, so the calendar can say so without
 * anyone having kept a diary. Marking the second kind as derived is more
 * honest than a log that implies someone was writing in it all along, and it
 * explains why those entries can't be edited or deleted.
 *
 * @param {object} props
 * @param {any} props.entry
 */
export default function DayEntryRow({ entry }) {
  return (
    <List.Item
      title={`${kindLabel(entry.kind)} · ${entry.subject}`}
      description={[entry.detail, entry.place].filter(Boolean).join(' · ')}
      left={(props) => <List.Icon {...props} icon={kindIcon(entry.kind)} />}
      right={
        entry.derived
          ? (props) => (
              <Text {...props} variant="labelSmall" style={styles.derivedTag}>
                from records
              </Text>
            )
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  derivedTag: {
    alignSelf: 'center',
    opacity: 0.5,
  },
});
