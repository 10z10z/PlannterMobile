import { StyleSheet } from 'react-native';
import { TouchableRipple, useTheme } from 'react-native-paper';
import { isPlaced } from '../../lib/growspaces';

/** Where a plant is standing, counted from one the way a person would say it. */
export function spotName(row, col) {
  return `row ${row + 1}, spot ${col + 1}`;
}

/** The same for a plant, including the ones still waiting in the tray. */
export function plantWhere(plant) {
  return isPlaced(plant) ? spotName(plant.grid_row, plant.grid_col) : 'not placed';
}

/**
 * A plant as a button, for rearranging without a drag.
 *
 * The drag is a `PanResponder` reading finger coordinates, which is no use to
 * anyone running TalkBack or a switch — the grid's whole point, moving things
 * about, was reachable only by people who could press and drag accurately. So
 * rearranging has a second path: pick a plant, then pick where it goes, both as
 * ordinary buttons that announce themselves.
 *
 * The drag stays exactly as it was. This is an alternative, not a replacement:
 * dragging is quicker for anyone who can do it.
 */
export default function PlantButton({ size, left, top, label, hint, onPress, selected, children }) {
  const theme = useTheme();

  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[
        styles.tile,
        { width: size, height: size, left, top },
        selected && [styles.picked, { borderColor: theme.colors.primary }],
      ]}
    >
      {children}
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
  },
  // The plant waiting to be told where to go, outlined so the choice is visible
  // rather than only announced.
  picked: {
    borderWidth: 2,
    borderRadius: 10,
  },
});
