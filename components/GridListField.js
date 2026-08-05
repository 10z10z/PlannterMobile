import { StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Text, TextInput } from 'react-native-paper';
import { gridLabel, plantsOutsideGrid } from '../lib/growspaces';

/**
 * The grids a growspace is divided into: a shelf, a bench, the floor under the
 * light. Each is named and sized on its own.
 *
 * Rows already saved keep their id, which is what lets the form tell an edit
 * from a new grid — deleting and recreating them would send every plant on them
 * back to the holding tray.
 */
export default function GridListField({ value, onChange, plants = [] }) {
  const update = (index, changes) =>
    onChange(value.map((grid, position) => (position === index ? { ...grid, ...changes } : grid)));

  const add = () =>
    onChange([
      ...value,
      { id: null, name: `Grid ${value.length + 1}`, grid_rows: 4, grid_cols: 4 },
    ]);

  const remove = (index) => onChange(value.filter((_, position) => position !== index));

  /** What removing or resizing this grid would send back to the tray. */
  const loosedBy = (grid) => {
    if (!grid.id) return 0;
    return plantsOutsideGrid(plants, grid.id, grid.grid_rows, grid.grid_cols).length;
  };

  const onGridCount = (grid, key) => (text) => {
    const count = parseInt(text, 10);
    update(value.indexOf(grid), { [key]: Number.isNaN(count) ? '' : count });
  };

  return (
    <View style={styles.wrapper}>
      <Text variant="labelLarge" style={styles.label}>
        Grids
      </Text>

      {value.map((grid, index) => {
        const loose = loosedBy(grid);
        return (
          <View key={grid.id ?? `new-${index}`} style={styles.grid}>
            <View style={styles.row}>
              <TextInput
                label="Name"
                value={grid.name}
                onChangeText={(name) => update(index, { name })}
                style={styles.name}
                dense
              />
              <IconButton icon="close" onPress={() => remove(index)} />
            </View>
            <View style={styles.row}>
              <TextInput
                label="Rows"
                value={String(grid.grid_rows)}
                onChangeText={onGridCount(grid, 'grid_rows')}
                keyboardType="number-pad"
                style={styles.count}
                dense
              />
              <TextInput
                label="Columns"
                value={String(grid.grid_cols)}
                onChangeText={onGridCount(grid, 'grid_cols')}
                keyboardType="number-pad"
                style={styles.count}
                dense
              />
            </View>
            <HelperText type={loose ? 'error' : 'info'} visible>
              {loose
                ? `${loose} plant${loose === 1 ? '' : 's'} would go back to the holding tray.`
                : grid.grid_rows > 0 && grid.grid_cols > 0
                  ? gridLabel(grid)
                  : 'Needs at least one row and one column.'}
            </HelperText>
          </View>
        );
      })}

      {value.length === 0 && (
        <HelperText type="info" visible>
          No grids yet — plants will wait in the holding tray until there's somewhere to put them.
        </HelperText>
      )}

      <Button mode="outlined" icon="view-grid-plus-outline" onPress={add} style={styles.addButton}>
        Add a grid
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.7,
  },
  grid: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
  },
  count: {
    flex: 1,
  },
  addButton: {
    marginTop: 4,
  },
});
