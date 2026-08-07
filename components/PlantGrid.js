import { useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useThemePreference } from '../contexts/ThemeContext';
import { useUnits } from '../contexts/UnitsContext';
import { containerSize } from '../lib/containers';
import { cellFromPoint, gridLabel, isPlaced, plantsInGrid } from '../lib/growspaces';
import { daysSinceGermination, plantPhase, wateringColors, wateringStatus } from '../lib/plants';

const GAP = 8;
const MIN_CELL = 44;
const MAX_CELL = 96;
const HOLD_MS = 1000;
/** How far a finger may wander before a hold counts as a drag attempt instead. */
const HOLD_SLOP = 8;

/**
 * One plant, pickable up after a hold.
 *
 * The whole gesture lives here rather than in a library: with one plant per cell
 * and a snap on release there is no physics to run, so a PanResponder and an
 * offset are the entire interaction. Keeping it in one component is also what
 * makes it cheap to swap for a gesture-handler version later.
 */
function Draggable({ plant, size, left, top, onPress, onPickUp, onDrop, children }) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);

  // The responder is built once, so everything it reads has to come through a
  // ref — a captured prop would still be the one from the first render.
  const latest = useRef({ plant, onPress, onPickUp, onDrop });
  latest.current = { plant, onPress, onPickUp, onDrop };

  const state = useRef({ dragging: false, moved: false, timer: null }).current;

  const stop = () => {
    clearTimeout(state.timer);
    state.timer = null;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => state.dragging,
      onPanResponderGrant: () => {
        state.moved = false;
        state.timer = setTimeout(() => {
          state.dragging = true;
          setDragging(true);
          latest.current.onPickUp(latest.current.plant);
        }, HOLD_MS);
      },
      onPanResponderMove: (event, gesture) => {
        if (!state.dragging) {
          // Moving before the hold lands means this was never a pick-up.
          if (Math.hypot(gesture.dx, gesture.dy) > HOLD_SLOP) {
            state.moved = true;
            stop();
          }
          return;
        }
        pan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (event, gesture) => {
        stop();
        if (state.dragging) {
          state.dragging = false;
          setDragging(false);
          latest.current.onDrop(latest.current.plant, gesture.moveX, gesture.moveY);
          // Snapped home either way: a refused drop belongs where it started,
          // and an accepted one is redrawn from the reloaded plants.
          pan.setValue({ x: 0, y: 0 });
        } else if (!state.moved) {
          latest.current.onPress(latest.current.plant);
        }
      },
      onPanResponderTerminate: () => {
        stop();
        state.dragging = false;
        setDragging(false);
        pan.setValue({ x: 0, y: 0 });
      },
    })
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          left,
          top,
          transform: pan.getTranslateTransform(),
        },
        dragging && styles.dragging,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Where a plant is standing, counted from one the way a person would say it. */
function spotName(row, col) {
  return `row ${row + 1}, spot ${col + 1}`;
}

/** The same for a plant, including the ones still waiting in the tray. */
function plantWhere(plant) {
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
function PlantButton({ size, left, top, label, hint, onPress, selected, children }) {
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

/**
 * The face of a plant on the grid: its photo where it has one, its name, the
 * phase it's in, and a dot when it wants watering.
 *
 * The photo is a backdrop rather than the whole tile — a grid of pictures with
 * no names is pretty and unusable, so the name always sits on top of a scrim.
 */
function PlantFace({ plant, size }) {
  const theme = useTheme();
  const { isDark } = useThemePreference();
  const { system } = useUnits();
  const flag = wateringColors(wateringStatus(plant), isDark);
  const phase = plantPhase(plant);
  const pot = containerSize(plant.container, system);
  const age = daysSinceGermination(plant);

  // Age first, then pot, then phase — as much as the tile can hold without
  // clipping. A small cell shows the age alone rather than nothing at all,
  // which is what hiding the whole line used to do.
  const parts = [age !== null ? `${age}d` : null, pot, phase?.label].filter(Boolean);
  const room = size >= 88 ? 3 : size >= 64 ? 2 : 1;
  const detail = parts.slice(0, room).join(' · ');

  return (
    <View
      style={[
        styles.face,
        { backgroundColor: theme.colors.secondaryContainer, borderColor: theme.colors.outline },
      ]}
    >
      {!!plant.image_url && <Image source={{ uri: plant.image_url }} style={styles.faceImage} />}
      {!!flag && <View style={[styles.flag, { backgroundColor: flag }]} />}
      <Text
        variant={size > 64 ? 'labelMedium' : 'labelSmall'}
        numberOfLines={size >= 64 ? 2 : 1}
        style={[styles.faceText, { color: theme.colors.onSecondaryContainer }]}
      >
        {plant.name}
      </Text>
      {!!detail && (
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={[styles.facePhase, { color: theme.colors.onSecondaryContainer }]}
        >
          {detail}
        </Text>
      )}
    </View>
  );
}

/**
 * A growspace laid out the way it stands: a grid of spots, with the plants that
 * haven't been given one waiting underneath.
 *
 * Drops are worked out from where the finger ended up on the screen rather than
 * from which component it was over, so one rule covers dragging inside the grid,
 * out of it, and back in from the holding tray.
 */
export default function PlantGrid({ grids, plants, onPress, onMove, onUnplace }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [dragging, setDragging] = useState(null);
  // Grid ids folded away, so a space with several grids can be worked on one at
  // a time. A view preference rather than saved state — it starts open again on
  // the next visit.
  const [collapsed, setCollapsed] = useState({});

  // The drag-free way round the grid. `rearranging` swaps every tile from a
  // draggable into a button; `picked` is the plant waiting to be told where to
  // go. Both are off by default, so nothing changes for anyone dragging.
  const [rearranging, setRearranging] = useState(false);
  const [picked, setPicked] = useState(null);

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

  // Page coordinates of every drop target, measured on layout — the drag reports
  // where the finger is on the screen, not where it is in a view. Grids are
  // keyed by id so a drop can be tested against each in turn.
  const gridRects = useRef({});
  const trayRect = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const gridRefs = useRef({});
  const trayRef = useRef(null);

  const toggleCollapsed = (gridId) =>
    setCollapsed((current) => {
      const next = { ...current, [gridId]: !current[gridId] };
      // A folded grid stops being a drop target, so its rect has to go with it —
      // a stale one would swallow drops aimed at whatever moved up the screen.
      if (next[gridId]) delete gridRects.current[gridId];
      return next;
    });

  const layout = (grid) => {
    const cols = grid.grid_cols;
    const available = width - 32 - GAP * Math.max(0, cols - 1);
    const cellSize = Math.max(
      MIN_CELL,
      Math.min(MAX_CELL, Math.floor(available / Math.max(cols, 1)))
    );
    return { cellSize, stride: cellSize + GAP };
  };

  // Tray tiles match the smallest cell of any grid, so a plant dragged out of
  // the tray never has to shrink to fit wherever it's dropped.
  const trayCell = (grids ?? []).length
    ? Math.min(...grids.map((grid) => layout(grid).cellSize))
    : MIN_CELL;
  const trayStride = trayCell + GAP;

  const waiting = (plants ?? []).filter((plant) => !isPlaced(plant));

  // The tray's tiles are absolutely positioned, so it can't size itself: it
  // wraps onto as many rows as the waiting plants need and is given that height.
  const trayCols = Math.max(1, Math.floor((width - 48 + GAP) / trayStride));
  const trayHeight = waiting.length
    ? Math.ceil(waiting.length / trayCols) * trayStride - GAP + 16
    : 72;

  const measureInto = (node, store) => {
    node?.measureInWindow((x, y, w, h) => {
      store(x, y, w, h);
    });
  };

  const measureAll = () => {
    for (const grid of grids ?? []) {
      if (collapsed[grid.id]) continue;
      measureInto(gridRefs.current[grid.id], (x, y, w, h) => {
        gridRects.current[grid.id] = { x, y, width: w, height: h };
      });
    }
    measureInto(trayRef.current, (x, y, w, h) => {
      trayRect.current = { x, y, width: w, height: h };
    });
  };

  // Measured again on every pick-up, not just on layout: the screen scrolls, and
  // a rect from mount would put the drop on the wrong grid entirely.
  const handlePickUp = (plant) => {
    setDragging(plant);
    measureAll();
  };

  const handleDrop = (plant, pageX, pageY) => {
    setDragging(null);

    // Each grid is tried in turn; the first that claims the point wins, and they
    // can't overlap, so the order doesn't matter.
    for (const grid of grids ?? []) {
      const rect = gridRects.current[grid.id];
      if (!rect || collapsed[grid.id]) continue;
      const { cellSize } = layout(grid);
      const cell = cellFromPoint(pageX - rect.x, pageY - rect.y, {
        cellSize,
        gap: GAP,
        rows: grid.grid_rows,
        cols: grid.grid_cols,
      });
      if (cell) {
        onMove(plant, { gridId: grid.id, row: cell.row, col: cell.col });
        return;
      }
    }

    // Dropped over the holding tray: a placed plant is taken out of the grid,
    // and one already waiting simply stays there.
    const tray = trayRect.current;
    const overTray =
      tray.height > 0 &&
      pageX >= tray.x &&
      pageX <= tray.x + tray.width &&
      pageY >= tray.y &&
      pageY <= tray.y + tray.height;
    if (overTray && isPlaced(plant)) onUnplace(plant);
  };

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
        const { cellSize, stride } = layout(grid);
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
                  width: grid.grid_cols * stride - GAP,
                  height: grid.grid_rows * stride - GAP,
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
                        onPickUp={handlePickUp}
                        onDrop={handleDrop}
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
        style={[styles.tray, { borderColor: theme.colors.outlineVariant, height: trayHeight }]}
      >
        {waiting.length === 0 && (
          <Text variant="bodySmall" style={styles.trayHint}>
            {dragging
              ? 'Drop here to take a plant off its grid'
              : 'Every plant has a spot. Hold one to move it, or use Rearrange.'}
          </Text>
        )}

        {waiting.map((plant, index) => {
          const left = (index % trayCols) * trayStride;
          const top = Math.floor(index / trayCols) * trayStride;

          if (!rearranging) {
            return (
              <Draggable
                key={plant.id}
                plant={plant}
                size={trayCell}
                left={left}
                top={top}
                onPress={onPress}
                onPickUp={handlePickUp}
                onDrop={handleDrop}
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
  // The plant waiting to be told where to go, outlined so the choice is visible
  // rather than only announced.
  picked: {
    borderWidth: 2,
    borderRadius: 10,
  },
  slot: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  tile: {
    position: 'absolute',
  },
  // No transform here: it would replace the drag's own translate, since a later
  // style in the array wins outright rather than merging.
  dragging: {
    zIndex: 10,
    elevation: 8,
    opacity: 0.9,
  },
  face: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  faceImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    opacity: 0.4,
  },
  faceText: {
    textAlign: 'center',
  },
  facePhase: {
    textAlign: 'center',
    opacity: 0.75,
  },
  flag: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
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
