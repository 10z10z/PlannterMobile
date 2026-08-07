import { useRef, useState } from 'react';
import { cellFromPoint, GRID_GAP, gridLayout, isPlaced } from '../lib/growspaces';

/**
 * Turning a finger's last position into a drop.
 *
 * Drops are worked out from where the finger ended up **on the screen** rather
 * than from which component it was over, so one rule covers dragging inside a
 * grid, out of it, onto a different grid, and back in from the holding tray.
 * The cost of that is having to know where every drop target is in page
 * coordinates, which is what the refs and `measureAll` are for.
 *
 * Measuring happens again on every pick-up, not only on layout: the screen
 * scrolls, and a rect taken at mount would put the drop on the wrong grid
 * entirely — or on a grid that has since scrolled off.
 *
 * @param {{ grids?: Array<any>, collapsed: Record<string, boolean>, width: number,
 *   onMove: (plant: any, cell: any) => void, onUnplace: (plant: any) => void }} params
 */
export default function usePlantDrag({ grids, collapsed, width, onMove, onUnplace }) {
  const [dragging, setDragging] = useState(null);

  // Page coordinates of every drop target, measured on layout. Grids are keyed
  // by id so a drop can be tested against each in turn.
  const gridRects = useRef(/** @type {Record<string, any>} */ ({}));
  const trayRect = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const gridRefs = useRef(/** @type {Record<string, any>} */ ({}));
  const trayRef = useRef(null);

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

  /**
   * Drop a grid's rect when it folds away. A folded grid stops being a drop
   * target, and a stale rect would swallow drops aimed at whatever moved up the
   * screen to take its place.
   */
  const forgetGrid = (gridId) => {
    delete gridRects.current[gridId];
  };

  const onPickUp = (plant) => {
    setDragging(plant);
    measureAll();
  };

  const onDrop = (plant, pageX, pageY) => {
    setDragging(null);

    // Each grid is tried in turn; the first that claims the point wins, and they
    // can't overlap, so the order doesn't matter.
    for (const grid of grids ?? []) {
      const rect = gridRects.current[grid.id];
      if (!rect || collapsed[grid.id]) continue;
      const cell = cellFromPoint(pageX - rect.x, pageY - rect.y, {
        cellSize: gridLayout(grid.grid_cols, width).cellSize,
        gap: GRID_GAP,
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

  return { dragging, gridRefs, trayRef, measureAll, forgetGrid, onPickUp, onDrop };
}
