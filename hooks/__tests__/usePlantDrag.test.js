import { act } from '@testing-library/react-native';
import { renderHookWithProviders } from '../../test/render';
import { GRID_GAP, gridLayout } from '../../lib/growspaces';
import usePlantDrag from '../usePlantDrag';

/**
 * Which square a finger landed on.
 *
 * This is the half of the drag that isn't the gesture, and until it came out of
 * `PlantGrid` there was no way to reach it: the only caller was a
 * `PanResponder`, so testing the decision meant producing touch events the
 * renderer can't produce. What it actually needs is two numbers and the page
 * rectangles of the drop targets, and both of those a test can supply.
 *
 * The rectangles normally come from `measureInWindow` on a real layout. Here
 * the refs are handed nodes that answer with fixed numbers, which is the same
 * thing the platform does and the only part of this the renderer can't do
 * itself.
 */

const WIDTH = 390;
const GRIDS = [
  { id: 'shelf', name: 'Shelf', grid_rows: 2, grid_cols: 4 },
  { id: 'bench', name: 'Bench', grid_rows: 1, grid_cols: 4 },
];

const { cellSize, stride } = gridLayout(4, WIDTH);

/** Where each target sits on the screen, once laid out. */
const SHELF = { x: 16, y: 100 };
const BENCH = { x: 16, y: 400 };
const TRAY = { x: 16, y: 600, width: 358, height: 72 };

const node = (x, y, w, h) => ({ measureInWindow: (cb) => cb(x, y, w, h) });

const BASIL = { id: 'plant-1', name: 'Basil', grid_id: 'shelf', grid_row: 0, grid_col: 0 };
const MINT = { id: 'plant-3', name: 'Mint', grid_id: null, grid_row: null, grid_col: null };

/** The top-left corner of a cell, in page coordinates. */
const corner = (grid, row, col) => ({
  x: grid.x + col * stride,
  y: grid.y + row * stride,
});

async function mountDrag({ collapsed = {} } = {}) {
  const onMove = jest.fn();
  const onUnplace = jest.fn();

  const { result } = await renderHookWithProviders(() =>
    usePlantDrag({ grids: GRIDS, collapsed, width: WIDTH, onMove, onUnplace })
  );

  // Standing in for a laid-out screen. A grid's own width and height are never
  // read — a point is tested against the cells, not against the box — so only
  // the corner matters for the two grids.
  await act(async () => {
    result.current.gridRefs.current.shelf = node(SHELF.x, SHELF.y, 4 * stride - GRID_GAP, 200);
    result.current.gridRefs.current.bench = node(BENCH.x, BENCH.y, 4 * stride - GRID_GAP, 100);
    result.current.trayRef.current = node(TRAY.x, TRAY.y, TRAY.width, TRAY.height);
  });

  return { result, onMove, onUnplace };
}

/** Pick a plant up — which is what measures — then let it go at a point. */
async function dragTo(result, plant, { x, y }) {
  await act(async () => {
    result.current.onPickUp(plant);
  });
  await act(async () => {
    result.current.onDrop(plant, x, y);
  });
}

describe('usePlantDrag', () => {
  it('drops a plant into the cell the finger was over', async () => {
    const { result, onMove } = await mountDrag();

    const { x, y } = corner(SHELF, 1, 2);
    await dragTo(result, BASIL, { x: x + 10, y: y + 10 });

    expect(onMove).toHaveBeenCalledWith(BASIL, { gridId: 'shelf', row: 1, col: 2 });
  });

  it('picks the grid the finger ended over, not the one the plant came from', async () => {
    const { result, onMove } = await mountDrag();

    const { x, y } = corner(BENCH, 0, 3);
    await dragTo(result, BASIL, { x: x + 5, y: y + 5 });

    // Dragging from the shelf onto the bench is the whole reason drops are
    // worked out from page coordinates rather than from which view was touched.
    expect(onMove).toHaveBeenCalledWith(BASIL, { gridId: 'bench', row: 0, col: 3 });
  });

  it('refuses a drop in the gutter between two cells', async () => {
    const { result, onMove, onUnplace } = await mountDrag();

    const { x, y } = corner(SHELF, 0, 0);
    // Past the cell but short of the next one. Clamping to the nearest would
    // put a plant somewhere nobody pointed at.
    await dragTo(result, BASIL, { x: x + cellSize + 2, y: y + 10 });

    expect(onMove).not.toHaveBeenCalled();
    expect(onUnplace).not.toHaveBeenCalled();
  });

  it('ignores a grid that is folded away', async () => {
    const { result, onMove } = await mountDrag({ collapsed: { shelf: true } });

    const { x, y } = corner(SHELF, 0, 0);
    await dragTo(result, BASIL, { x: x + 10, y: y + 10 });

    // A folded grid is still mounted, so its ref is still measurable — and its
    // cells are no longer where the ref says they are. Skipping it is what
    // stops a fold swallowing drops aimed at whatever moved up to take its
    // place.
    expect(onMove).not.toHaveBeenCalled();
  });

  it('takes a plant off its grid when it is dropped on the holding tray', async () => {
    const { result, onUnplace, onMove } = await mountDrag();

    await dragTo(result, BASIL, { x: TRAY.x + 40, y: TRAY.y + 20 });

    expect(onUnplace).toHaveBeenCalledWith(BASIL);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does nothing when a plant already in the tray is dropped back on it', async () => {
    const { result, onUnplace, onMove } = await mountDrag();

    await dragTo(result, MINT, { x: TRAY.x + 40, y: TRAY.y + 20 });

    expect(onUnplace).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does nothing when a plant is dropped on neither a grid nor the tray', async () => {
    const { result, onMove, onUnplace } = await mountDrag();

    await dragTo(result, BASIL, { x: 5, y: 320 });

    expect(onMove).not.toHaveBeenCalled();
    expect(onUnplace).not.toHaveBeenCalled();
  });

  it('reports what is being carried, and stops when it lands', async () => {
    const { result } = await mountDrag();

    await act(async () => {
      result.current.onPickUp(BASIL);
    });
    // The tray's own prompt changes while something is in the air — "drop here
    // to take a plant off its grid" is only true mid-drag.
    expect(result.current.dragging).toBe(BASIL);

    await act(async () => {
      result.current.onDrop(BASIL, 5, 320);
    });
    expect(result.current.dragging).toBeNull();
  });

  it('forgets a grid it is told to, so a stale rectangle cannot claim a drop', async () => {
    const { result, onMove } = await mountDrag();

    await act(async () => {
      result.current.onPickUp(BASIL);
      result.current.forgetGrid('shelf');
    });

    const { x, y } = corner(SHELF, 0, 0);
    await act(async () => {
      result.current.onDrop(BASIL, x + 10, y + 10);
    });

    expect(onMove).not.toHaveBeenCalled();
  });
});
