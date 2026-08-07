import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import Draggable from './grid/Draggable';
import PlantButton, { plantWhere, spotName } from './grid/PlantButton';
import PlantFace from './grid/PlantFace';
import usePlantDrag from '../hooks/usePlantDrag';
import {
  GRID_GAP,
  MIN_CELL,
  gridLabel,
  gridLayout,
  isPlaced,
  plantsInGrid,
  trayLayout,
} from '../lib/growspaces';

/**
 * A growspace laid out the way it stands: a grid of spots, with the plants that
 * haven't been given one waiting underneath.
 *
 * What is left here is the arrangement — which grids, which squares, and which
 * of the two ways of moving a plant is switched on. The three parts underneath
 * it each answer one question and are `./grid/`: `Draggable` is the gesture,
 * `PlantButton` is the same tile as something TalkBack can operate, and
 * `PlantFace` is what both of them draw. The maths that decides where a square
 * is — and therefore which square a finger landed on — is `gridLayout` and
 * `trayLayout` in `lib/growspaces.js`, so that drawing and dropping can't
 * disagree about it, and so it can be tested without a screen.
 */
export default function PlantGrid({ grids, plants, onPress, onMove, onUnplace }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // Grid ids folded away, so a space with several grids can be worked on one at
  // a time. A view preference rather than saved state — it starts open again on
  // the next visit.
  const [collapsed, setCollapsed] = useState({});

  // The drag-free way round the grid. `rearranging` swaps every tile from a
  // draggable into a button; `picked` is the plant waiting to be told where to
  // go. Both are off by default, so nothing changes for anyone dragging.
  const [rearranging, setRearranging] = useState(false);
  const [picked, setPicked] = useState(null);

  const { dragging, gridRefs, trayRef, measureAll, forgetGrid, onPickUp, onDrop } = usePlantDrag({
    grids,
    collapsed,
    width,
    onMove,
    onUnplace,
  });

  const stopRearranging = () => {
    setRearranging(false);
    setPicked(null);
  };

  /** Send the picked plant somewhere, and go back to waiting for the next one. */
  const placePicked = (cell) => {
    if (!picked) return;
    onMove(picked, cell);
    setPicked(null);
  };

  const unplacePicked = () => {
    if (!picked || !isPlaced(picked)) return;
    onUnplace(picked);
    setPicked(null);
  };

  const toggleCollapsed = (gridId) =>
    setCollapsed((current) => {
      const next = { ...current, [gridId]: !current[gridId] };
      if (next[gridId]) forgetGrid(gridId);
      return next;
    });

  // Tray tiles match the smallest cell of any grid, so a plant dragged out of
  // the tray never has to shrink to fit wherever it's dropped.
  const waiting = (plants ?? []).filter((plant) => !isPlaced(plant));
  const trayCell = (grids ?? []).length
    ? Math.min(...grids.map((grid) => gridLayout(grid.grid_cols, width).cellSize))
    : MIN_CELL;
  const tray = trayLayout(waiting.length, trayCell, width);

  return (
    <View style={styles.container}>
      {/* The way round the grid that doesn't need a drag. Visible to everyone
          rather than hidden behind an accessibility action, because a mode that
          only a screen reader can find is one nobody maintains. */}
      <View style={styles.rearrangeBar}>
        <Text variant="bodySmall" style={styles.rearrangeHint}>
          {rearranging
            ? picked
              ? `${picked.name} picked up — choose where it goes`
              : 'Choose a plant to move'
            : ''}
        </Text>
        <Button
          compact
          mode={rearranging ? 'contained-tonal' : 'text'}
          icon={rearranging ? 'check' : 'cursor-move'}
          onPress={() => (rearranging ? stopRearranging() : setRearranging(true))}
        >
          {rearranging ? 'Done' : 'Rearrange'}
        </Button>
      </View>

      {(grids ?? []).map((grid) => {
        const { cellSize, stride } = gridLayout(grid.grid_cols, width);
        const standing = plantsInGrid(plants, grid.id);
        const isCollapsed = !!collapsed[grid.id];
        const occupied = new Set(standing.map((p) => `${p.grid_row}:${p.grid_col}`));

        return (
          <View key={grid.id} style={styles.gridBlock}>
            <TouchableRipple
              onPress={() => toggleCollapsed(grid.id)}
              style={styles.gridHeader}
              borderless
            >
              <View style={styles.gridHeaderRow}>
                <Icon
                  source={isCollapsed ? 'chevron-right' : 'chevron-down'}
                  size={20}
                  color={theme.colors.onSurface}
                />
                <Text variant="labelLarge" style={styles.gridName}>
                  {grid.name}
                </Text>
                <Text variant="labelSmall" style={styles.gridSize}>
                  {isCollapsed
                    ? `${standing.length}/${grid.grid_rows * grid.grid_cols} filled`
                    : gridLabel(grid)}
                </Text>
              </View>
            </TouchableRipple>
            <View
              // Kept mounted but zero-sized when folded, so its plants don't
              // unmount mid-drag and the ref survives to be measured on reopen.
              style={isCollapsed ? styles.folded : undefined}
              pointerEvents={isCollapsed ? 'none' : 'auto'}
            >
              <View
                ref={(node) => {
                  gridRefs.current[grid.id] = node;
                }}
                onLayout={measureAll}
                style={{
                  width: grid.grid_cols * stride - GRID_GAP,
                  height: grid.grid_rows * stride - GRID_GAP,
                }}
              >
                {Array.from({ length: grid.grid_rows }).map((_, row) =>
                  Array.from({ length: grid.grid_cols }).map((__, col) => {
                    const slotStyle = [
                      styles.slot,
                      {
                        width: cellSize,
                        height: cellSize,
                        left: col * stride,
                        top: row * stride,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ];

                    // An empty square only becomes a button once a plant is
                    // waiting to go somewhere — otherwise the grid would
                    // announce a screenful of spots with nothing to do.
                    const free = !occupied.has(`${row}:${col}`);
                    if (!picked || !free) return <View key={`${row}:${col}`} style={slotStyle} />;

                    return (
                      <TouchableRipple
                        key={`${row}:${col}`}
                        onPress={() => placePicked({ gridId: grid.id, row, col })}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${picked.name} to ${spotName(row, col)} of ${grid.name}`}
                        style={slotStyle}
                      >
                        <View />
                      </TouchableRipple>
                    );
                  })
                )}

                {standing.map((plant) => {
                  if (!rearranging) {
                    return (
                      <Draggable
                        key={plant.id}
                        plant={plant}
                        size={cellSize}
                        left={plant.grid_col * stride}
                        top={plant.grid_row * stride}
                        onPress={onPress}
                        onPickUp={onPickUp}
                        onDrop={onDrop}
                      >
                        <PlantFace plant={plant} size={cellSize} />
                      </Draggable>
                    );
                  }

                  const isPicked = picked?.id === plant.id;
                  const cell = { gridId: grid.id, row: plant.grid_row, col: plant.grid_col };

                  return (
                    <PlantButton
                      key={plant.id}
                      size={cellSize}
                      left={plant.grid_col * stride}
                      top={plant.grid_row * stride}
                      selected={isPicked}
                      label={
                        isPicked
                          ? `${plant.name}, picked up`
                          : picked
                            ? `Swap ${picked.name} with ${plant.name}`
                            : `${plant.name}, ${plantWhere(plant)}`
                      }
                      hint={picked ? undefined : 'Double tap to pick this plant up'}
                      onPress={() => {
                        if (isPicked) setPicked(null);
                        else if (picked) placePicked(cell);
                        else setPicked(plant);
                      }}
                    >
                      <PlantFace plant={plant} size={cellSize} />
                    </PlantButton>
                  );
                })}
              </View>
            </View>
          </View>
        );
      })}

      {!(grids ?? []).length && (
        <Text variant="bodySmall" style={styles.trayHint}>
          No grids yet. Add one from the growspace settings to start arranging plants.
        </Text>
      )}

      <View style={styles.trayHeader}>
        <Text variant="labelLarge" style={styles.trayLabel}>
          {waiting.length ? `Not placed (${waiting.length})` : 'Not placed'}
        </Text>
        {rearranging && picked && isPlaced(picked) && (
          <Button compact mode="text" onPress={unplacePicked}>
            {`Take ${picked.name} off its grid`}
          </Button>
        )}
      </View>
      <View
        ref={trayRef}
        onLayout={measureAll}
        style={[styles.tray, { borderColor: theme.colors.outlineVariant, height: tray.height }]}
      >
        {waiting.length === 0 && (
          <Text variant="bodySmall" style={styles.trayHint}>
            {dragging
              ? 'Drop here to take a plant off its grid'
              : 'Every plant has a spot. Hold one to move it, or use Rearrange.'}
          </Text>
        )}

        {waiting.map((plant, index) => {
          const left = (index % tray.cols) * tray.stride;
          const top = Math.floor(index / tray.cols) * tray.stride;

          if (!rearranging) {
            return (
              <Draggable
                key={plant.id}
                plant={plant}
                size={trayCell}
                left={left}
                top={top}
                onPress={onPress}
                onPickUp={onPickUp}
                onDrop={onDrop}
              >
                <PlantFace plant={plant} size={trayCell} />
              </Draggable>
            );
          }

          const isPicked = picked?.id === plant.id;
          return (
            <PlantButton
              key={plant.id}
              size={trayCell}
              left={left}
              top={top}
              selected={isPicked}
              label={isPicked ? `${plant.name}, picked up` : `${plant.name}, ${plantWhere(plant)}`}
              hint={picked ? undefined : 'Double tap to pick this plant up'}
              // A plant already in the tray has nowhere to be put down here, so
              // tapping another one just moves the selection to it.
              onPress={() => setPicked(isPicked ? null : plant)}
            >
              <PlantFace plant={plant} size={trayCell} />
            </PlantButton>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  gridBlock: {
    marginBottom: 20,
  },
  gridHeader: {
    borderRadius: 6,
    marginBottom: 6,
    marginLeft: -4,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  gridName: {
    flex: 1,
  },
  gridSize: {
    opacity: 0.6,
  },
  // Folded away: height zero and clipped, rather than unmounted, so the plants
  // inside keep their state and the ref stays measurable.
  folded: {
    height: 0,
    overflow: 'hidden',
  },
  rearrangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  rearrangeHint: {
    flex: 1,
    opacity: 0.7,
  },
  trayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  slot: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  trayLabel: {
    marginTop: 20,
    marginBottom: 6,
    opacity: 0.7,
  },
  tray: {
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 8,
    justifyContent: 'center',
  },
  trayHint: {
    opacity: 0.6,
    textAlign: 'center',
  },
});
