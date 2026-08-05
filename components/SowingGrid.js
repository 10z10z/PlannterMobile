import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useThemePreference } from '../contexts/ThemeContext';
import { daysSince, germinatedCellColors, isSelectable } from '../lib/germination';

const CELL_SIZE = 56;

/**
 * The grid of a sowing: one square per cell, reading "germinated / planted".
 * Anything above zero is tinted green. A single-container sowing is a 1 x 1
 * grid, so it draws as one square rather than as a special case.
 *
 * Tapping a cell opens it for marking; holding one that has seedlings in it
 * starts a selection, for transplanting part of a tray. Holding anywhere else —
 * an empty cell, or the card around the grid — still marks the whole sowing.
 */
export default function SowingGrid({
  grid,
  onCellPress,
  onHold,
  onCellLongPress,
  selectionMode = false,
  selectedIds = [],
}) {
  const { isDark } = useThemePreference();
  const theme = useTheme();
  const green = germinatedCellColors(isDark);
  const cols = grid[0]?.length ?? 0;
  const selected = new Set(selectedIds);

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
              const selectable = isSelectable(cell);
              const isSelected = selectable && selected.has(cell.id);

              // In selection mode a tap picks the cell instead of opening it,
              // and cells with nothing to move stop responding — tapping one
              // mid-selection almost always means the user missed.
              const handlePress = selectionMode
                ? selectable
                  ? () => onCellLongPress(cell)
                  : undefined
                : () => cell && onCellPress(cell);

              return (
                <TouchableRipple
                  key={colIndex}
                  onPress={handlePress}
                  // The cell owns the touch, so the card's own long-press never
                  // fires over the grid — most of the card — unless it's passed
                  // down to here.
                  onLongPress={selectable && onCellLongPress ? () => onCellLongPress(cell) : onHold}
                  delayLongPress={1000}
                  style={[
                    styles.cell,
                    isGreen && { backgroundColor: green.background, borderColor: green.border },
                    planted === 0 && !isGreen && styles.emptyCell,
                    isSelected && { borderColor: theme.colors.primary, borderWidth: 3 },
                    selectionMode && !selectable && styles.unselectableCell,
                  ]}
                >
                  <View style={styles.cellContent}>
                    {isSelected && (
                      <View style={[styles.check, { backgroundColor: theme.colors.primary }]}>
                        <Icon source="check" size={12} color={theme.colors.onPrimary} />
                      </View>
                    )}
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
  // A cell that has nothing to contribute to the selection being made.
  unselectableCell: {
    opacity: 0.35,
  },
  // Fills the cell so the selection badge can sit in its corner rather than
  // being pushed outside by the text it would otherwise be anchored to.
  cellContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  days: {
    opacity: 0.7,
  },
});
