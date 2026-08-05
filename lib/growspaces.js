import { supabase } from './supabase';

export const GROWSPACE_ENVIRONMENTS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
];

export function environmentLabel(environment) {
  return GROWSPACE_ENVIRONMENTS.find((entry) => entry.value === environment)?.label ?? 'Indoor';
}

/**
 * "6h direct sun", or null when there is none recorded. Zero counts as nothing
 * rather than as "0h" — a north-facing corner is described by its shade, not by
 * a figure, and the field is left empty for it either way.
 */
export function sunHoursLabel(hours) {
  const value = Number(hours);
  if (!Number.isFinite(value) || value <= 0) return null;
  // A whole number of hours reads as "6h", a half as "6.5h".
  return `${Math.round(value * 10) / 10}h direct sun`;
}

/** "4 x 3 · 12 spots" — the shorthand used beside a grid's name. */
export function gridLabel(grid) {
  return `${grid.grid_rows} x ${grid.grid_cols} · ${grid.grid_rows * grid.grid_cols} spots`;
}

/** How many spots a growspace has across all its grids. */
export function totalSpots(grids) {
  return (grids ?? []).reduce((sum, grid) => sum + grid.grid_rows * grid.grid_cols, 0);
}

/**
 * A plant is placed once it holds a grid and both coordinates. The schema won't
 * allow a position without a grid, but a grid that was deleted leaves the
 * coordinates behind for a moment, so all three are checked.
 */
export function isPlaced(plant) {
  return (
    !!plant?.grid_id && plant?.grid_row !== null && plant?.grid_row !== undefined
  );
}

/** The plants standing on one particular grid. */
export function plantsInGrid(plants, gridId) {
  return (plants ?? []).filter((plant) => isPlaced(plant) && plant.grid_id === gridId);
}

/** The plants waiting in the holding tray, oldest first so arrivals queue up. */
export function unplacedPlants(plants) {
  return (plants ?? []).filter((plant) => !isPlaced(plant));
}

/**
 * One grid laid out as a rows x cols array, each cell holding its plant or null.
 * Plants sitting outside the current bounds are left out — shrinking a grid
 * doesn't move them, so they show up in the holding tray until placed again.
 */
export function toPlantGrid(grid, plants) {
  const rows = grid?.grid_rows ?? 0;
  const cols = grid?.grid_cols ?? 0;
  const lookup = new Map();
  for (const plant of plantsInGrid(plants, grid?.id)) {
    lookup.set(`${plant.grid_row}:${plant.grid_col}`, plant);
  }

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => lookup.get(`${row}:${col}`) ?? null)
  );
}

/**
 * Plants on `gridId` whose position falls outside the given dimensions — what
 * shrinking that grid would turn loose. The form warns with this before saving
 * rather than quietly unplacing half a shelf.
 */
export function plantsOutsideGrid(plants, gridId, rows, cols) {
  return plantsInGrid(plants, gridId).filter(
    (plant) => plant.grid_row >= rows || plant.grid_col >= cols
  );
}

/**
 * Everything a set of grid dimensions would turn loose, across every grid a
 * growspace has — including the plants on grids being removed altogether.
 */
export function plantsLoosedBy(plants, grids) {
  const kept = new Set((grids ?? []).map((grid) => grid.id).filter(Boolean));

  return (plants ?? []).filter((plant) => {
    if (!isPlaced(plant)) return false;
    if (!kept.has(plant.grid_id)) return true;
    const grid = grids.find((entry) => entry.id === plant.grid_id);
    return plant.grid_row >= grid.grid_rows || plant.grid_col >= grid.grid_cols;
  });
}

/** Whatever stands in a cell of a grid, or null when it's free. */
export function plantAt(plants, gridId, row, col) {
  return (
    plantsInGrid(plants, gridId).find(
      (plant) => plant.grid_row === row && plant.grid_col === col
    ) ?? null
  );
}

/**
 * The cell a point lands in, given the geometry the grid was drawn with, or null
 * when the point is outside it — a plant dragged off the grid is a drop that
 * should be refused rather than clamped to the nearest edge, since clamping puts
 * plants somewhere nobody pointed at.
 */
export function cellFromPoint(x, y, { cellSize, gap, rows, cols }) {
  const stride = cellSize + gap;
  if (x < 0 || y < 0) return null;

  const col = Math.floor(x / stride);
  const row = Math.floor(y / stride);
  if (row >= rows || col >= cols) return null;

  // A point in the gutter between cells belongs to neither.
  if (x - col * stride > cellSize || y - row * stride > cellSize) return null;

  return { row, col };
}

/**
 * What dropping `plant` on a cell should do: take the empty spot, swap with
 * whoever is standing there, or nothing at all when it was dropped back where it
 * started. Swapping rather than refusing an occupied cell is what makes a full
 * grid rearrangeable — otherwise every move needs a free cell to stage through.
 */
export function resolveDrop(plants, plant, target) {
  if (!target) return { type: 'none' };
  if (
    plant.grid_id === target.gridId &&
    plant.grid_row === target.row &&
    plant.grid_col === target.col
  ) {
    return { type: 'none' };
  }

  const occupant = plantAt(plants, target.gridId, target.row, target.col);
  if (!occupant) return { type: 'move', plant, to: target };
  if (occupant.id === plant.id) return { type: 'none' };
  return { type: 'swap', plant, occupant, to: target };
}

/** The cell a plant currently stands in, or null when it's in the tray. */
export function positionOf(plant) {
  return isPlaced(plant)
    ? { gridId: plant.grid_id, row: plant.grid_row, col: plant.grid_col }
    : null;
}

/** Moves a plant to a cell, or out of the grids entirely when `cell` is null. */
export async function placePlant(plantId, cell) {
  const { error } = await supabase
    .from('plants')
    .update({
      grid_id: cell?.gridId ?? null,
      grid_row: cell?.row ?? null,
      grid_col: cell?.col ?? null,
    })
    .eq('id', plantId);
  if (error) throw error;
}

/**
 * Exchanges two plants' positions, which may be on different grids — dragging a
 * plant from the shelf onto one on the floor trades their places.
 *
 * One plant is lifted out before the other takes its cell, because the unique
 * index would reject the pair briefly sharing a spot. PostgREST has no
 * transactions, so a failure part-way leaves one plant in the holding tray
 * rather than two plants claiming one cell.
 */
export async function swapPlants(plant, occupant) {
  const from = positionOf(plant);
  const to = positionOf(occupant);

  await placePlant(occupant.id, null);
  await placePlant(plant.id, to);
  await placePlant(occupant.id, from);
}

/** Every plant in a growspace, placed or not, with the pot it stands in. */
export async function fetchPlants(growspaceId) {
  const { data, error } = await supabase
    .from('plants')
    // The container is embedded for its size only; it comes back null once the
    // container group behind it has been deleted.
    .select('*, container:containers(material, volume_liters)')
    .eq('growspace_id', growspaceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGrowspace(growspaceId) {
  const { data, error } = await supabase
    .from('growspaces')
    .select('*')
    .eq('id', growspaceId)
    .single();
  if (error) throw error;
  return data;
}

/** A growspace's grids, in the order they're drawn. */
export async function fetchGrids(growspaceId) {
  const { data, error } = await supabase
    .from('growspace_grids')
    .select('*')
    .eq('growspace_id', growspaceId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Saves the grids a growspace should have.
 *
 * Unlike the lights this is a diff rather than a clear-and-insert: plants point
 * at grids, so deleting and recreating them would send every plant in the space
 * back to the holding tray on each save. Rows are matched by id — the ones that
 * are still there get updated, new ones are inserted, and the ones the grower
 * removed are deleted.
 *
 * Plants that a removal or a shrink would strand are put back in the tray
 * first, because the schema won't hold a position that no grid has room for.
 */
export async function saveGrids(userId, growspaceId, grids, plants) {
  for (const plant of plantsLoosedBy(plants, grids)) {
    await placePlant(plant.id, null);
  }

  const existing = await fetchGrids(growspaceId);
  const keptIds = new Set(grids.map((grid) => grid.id).filter(Boolean));

  const removed = existing.filter((grid) => !keptIds.has(grid.id));
  if (removed.length) {
    const { error } = await supabase
      .from('growspace_grids')
      .delete()
      .in('id', removed.map((grid) => grid.id));
    if (error) throw error;
  }

  for (const [index, grid] of grids.entries()) {
    const payload = {
      name: grid.name.trim() || `Grid ${index + 1}`,
      grid_rows: grid.grid_rows,
      grid_cols: grid.grid_cols,
      sort_order: index,
    };

    if (grid.id) {
      const { error } = await supabase
        .from('growspace_grids')
        .update(payload)
        .eq('id', grid.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('growspace_grids')
        .insert({ ...payload, user_id: userId, growspace_id: growspaceId });
      if (error) throw error;
    }
  }
}

/** The lights hanging over a growspace, each with the fixture it points at. */
export async function fetchGrowspaceLights(growspaceId) {
  const { data, error } = await supabase
    .from('growspace_lights')
    .select('*, light:grow_lights(*)')
    .eq('growspace_id', growspaceId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Replaces a growspace's light assignments, the same clear-and-insert a station
 * uses — a tent carries a handful of fixtures, and matching the on-screen list
 * exactly is worth more than saving a round trip.
 */
export async function saveGrowspaceLights(userId, growspaceId, assignments) {
  const { error: clearError } = await supabase
    .from('growspace_lights')
    .delete()
    .eq('growspace_id', growspaceId);
  if (clearError) throw clearError;

  const rows = assignments
    .filter((entry) => entry.quantity > 0)
    .map((entry) => ({
      user_id: userId,
      growspace_id: growspaceId,
      grow_light_id: entry.grow_light_id,
      quantity: entry.quantity,
      hours_on: entry.hours_on ?? null,
    }));
  if (!rows.length) return;

  const { error } = await supabase.from('growspace_lights').insert(rows);
  if (error) throw error;
}
