import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { useThemePreference } from '../contexts/ThemeContext';
import { daysSince, germinatedCellColors } from '../lib/germination';

const CELL_SIZE = 56;

/**
 * The grid of a sowing: one square per cell, reading "germinated / planted".
 * Anything above zero is tinted green. A single-container sowing is a 1 x 1
 * grid, so it draws as one square rather than as a special case.
 *
 * Tapping a cell opens it for marking; holding the card around it is what marks
 * the whole sowing at once.
 */
export default function SowingGrid({ grid, onCellPress, onHold }) {
  const { isDark } = useThemePreference();
  const green = germinatedCellColors(isDark);
  const cols = grid[0]?.length ?? 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={cols > 6}
      contentContainerStyle={styles.content}
    >
      <View>
        {grid.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((cell, colIndex) => {
              const germinated = cell?.germinated ?? 0;
              const planted = cell?.seeds_planted ?? 0;
              const isGreen = germinated > 0;
              const days = daysSince(cell?.germinated_on);

              return (
                <TouchableRipple
                  key={colIndex}
                  onPress={() => cell && onCellPress(cell)}
                  // The cell owns the touch, so the card's own long-press never
                  // fires over the grid — most of the card — unless it's passed
                  // down to here.
                  onLongPress={onHold}
                  delayLongPress={1000}
                  style={[
                    styles.cell,
                    isGreen && { backgroundColor: green.background, borderColor: green.border },
                    planted === 0 && !isGreen && styles.emptyCell,
                  ]}
                >
                  <View style={styles.cellContent}>
                    <Text
                      variant="labelLarge"
                      style={isGreen ? { color: green.text } : undefined}
                    >
                      {germinated}/{planted}
                    </Text>
                    {days !== null && (
                      <Text
                        variant="labelSmall"
                        style={[styles.days, isGreen ? { color: green.text } : undefined]}
                      >
                        {days}d
                      </Text>
                    )}
                  </View>
                </TouchableRipple>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#9e9e9e',
    justifyContent: 'center',
  },
  // A cell whose seedlings have all been transplanted out.
  emptyCell: {
    opacity: 0.4,
    borderStyle: 'dashed',
  },
  cellContent: {
    alignItems: 'center',
  },
  days: {
    opacity: 0.7,
  },
});
