import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * A top tab's name with its icon beside it.
 *
 * Beside rather than above: a row of tabs stacking icon over label would cost
 * the height twice over on screens that already scroll, and these tabs are read
 * along the row, not down it. The colour is handed in by the navigator so the
 * icon fades with the label on the tabs that aren't selected.
 */
export default function TabLabel({ icon, label, color }) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text variant="labelLarge" style={[styles.label, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    textTransform: 'uppercase',
  },
});
