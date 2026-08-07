import { supabase } from './supabase';
import { requireUserId } from './session';
import { parseHours } from './growLights';
import { cancelWateringReminder, scheduleWateringReminder } from './notifications';
import { recordEvent } from './activity';
import { toDateString } from './dates';
import { GROWSPACE_ENVIRONMENTS } from './enums';

// Defined in ./enums so validation can read it without loading the client.
export { GROWSPACE_ENVIRONMENTS };

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
  return !!plant?.grid_id && plant?.grid_row !== null && plant?.grid_row !== undefined;
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

/** The gutter between cells. Drawn with and measured against, so it is shared. */
export const GRID_GAP = 8;

/**
 * The bounds a cell is drawn within. Never below the 44dp a fingertip needs, so
 * a wide grid stays draggable rather than merely visible; capped above so a
 * one-column grid doesn't draw a single enormous square.
 */
export const MIN_CELL = 44;
const MAX_CELL = 96;

/**
 * How big one grid's cells are on a screen this wide, and how far apart their
 * top-left corners sit.
 *
 * Drawing and dropping both go through this. A drop is worked out by dividing
 * the distance from the grid's corner by the stride, so a cell size arrived at
 * twice by two nearly-identical formulas would land plants a square out — and
 * only on the grid widths where the two happened to round differently.
 */
export function gridLayout(cols, width) {
  const columns = Math.max(cols, 1);
  const available = width - 32 - GRID_GAP * Math.max(0, columns - 1);
  const cellSize = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(available / columns)));
  return { cellSize, stride: cellSize + GRID_GAP };
}

/**
 * How the holding tray wraps, and how tall that makes it.
 *
 * Its tiles are absolutely positioned so it can't size itself from its
 * contents, and it wraps rather than scrolls — a tray you have to scroll to see
 * the end of is one you can't drag a plant out of. An empty tray keeps a fixed
 * height, because it is still a drop target and a target that shrinks to
 * nothing is one nobody can aim at.
 */
export function trayLayout(count, cellSize, width) {
  const stride = cellSize + GRID_GAP;
  const cols = Math.max(1, Math.floor((width - 48 + GRID_GAP) / stride));
  const height = count ? Math.ceil(count / cols) * stride - GRID_GAP + 16 : 72;
  return { cols, stride, height };
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

/**
 * The columns a plant is read back with.
 *
 * The container is embedded for its size only, and comes back null once the
 * container group behind it has been deleted — a plant outliving its pot is a
 * normal thing, not a broken row.
 */
const PLANT_COLUMNS = '*, containers(material, volume_liters)';

/** One plant, for its own screen. */
export async function fetchPlant(plantId) {
  const { data, error } = await supabase
    .from('plants')
    .select(PLANT_COLUMNS)
    .eq('id', plantId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Adds a plant to a growspace by hand — one that wasn't transplanted from a
 * sowing, so nothing upstream knows about it.
 *
 * It joins the watering cycle immediately: a plant added today has just been
 * put in, and treating it as watered is both true and what stops it appearing
 * overdue the moment it exists.
 */
export async function createPlant({ growspaceId, values }) {
  const userId = await requireUserId();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('plants')
    .insert({
      ...values,
      user_id: userId,
      growspace_id: growspaceId,
      transplanted_on: toDateString(new Date()),
      last_watered_at: nowIso,
    })
    .select(PLANT_COLUMNS)
    .single();
  if (error) throw error;

  await scheduleWateringReminder(data);
  await recordEvent({
    userId,
    kind: 'planted',
    subject: data.name,
    detail: data.plant_type || data.species || null,
    growspaceId,
    plantId: data.id,
  });

  return data;
}

/** Edits a plant. Its reminder is rescheduled, since the interval may have moved. */
export async function updatePlant({ plantId, values }) {
  const { data, error } = await supabase
    .from('plants')
    .update(values)
    .eq('id', plantId)
    .select(PLANT_COLUMNS)
    .single();
  if (error) throw error;

  await scheduleWateringReminder(data);
  return data;
}

/**
 * Waters a plant: restarts its reminder cycle and files the watering.
 *
 * The plant row keeps only the most recent watering, so the calendar entry is
 * what makes the ones before it recoverable at all.
 */
export async function waterPlant(plantId) {
  const { data, error } = await supabase
    .from('plants')
    .update({ last_watered_at: new Date().toISOString() })
    .eq('id', plantId)
    .select(PLANT_COLUMNS)
    .single();
  if (error) throw error;

  await scheduleWateringReminder(data);
  await recordEvent({
    kind: 'watered',
    subject: data.name,
    detail: `Every ${data.watering_interval_days} days`,
    growspaceId: data.growspace_id,
    plantId: data.id,
  });

  return data;
}

/** Removes a plant, cancelling its reminder and saying so in the log first. */
export async function deletePlant({ plant, detail = null }) {
  await cancelWateringReminder(plant.id);
  // Logged before the row goes, so the entry can still name what was pulled.
  await recordEvent({
    kind: 'removed',
    subject: plant.name,
    detail,
    growspaceId: plant.growspace_id,
  });

  const { error } = await supabase.from('plants').delete().eq('id', plant.id);
  if (error) throw error;
  return plant.id;
}

/** Every growspace, in the order the tabs are laid out. */
export async function fetchGrowspaces() {
  const { data, error } = await supabase
    .from('growspaces')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * The growspace row itself, without its grids, lights or plants.
 *
 * Those are three separate reads on purpose: a tent's name and temperature
 * change far less often than what is standing in it, and keeping them apart
 * means a plant being dragged one square doesn't re-read the whole space.
 *
 * Saving one writes three tables — the growspace, its grids and its lights —
 * because how big a tent is and what hangs over it are decided together. There
 * are no transactions in PostgREST, so they go in that order and a failure
 * costs only what came after it. The growspace comes back attached to the
 * error, so pressing save again finishes the job rather than creating a second
 * tent with the same name.
 *
 * That is a hand-rolled substitute for a transaction and it is not one. Moving
 * this into a Postgres function is tracked in TASKS.md.
 *
 * @param {{ id?: string, values: object, grids?: Array<object>, lights?: Array<object>,
 *   plants?: Array<object> }} params
 */
export async function saveGrowspace({ id, values, grids, lights, plants = [] }) {
  const userId = await requireUserId();

  let growspace;
  if (id) {
    const { data, error } = await supabase
      .from('growspaces')
      .update(values)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    growspace = data;
  } else {
    const { data, error } = await supabase
      .from('growspaces')
      .insert({ ...values, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    growspace = data;
  }

  if (grids) {
    try {
      await saveGrids(userId, growspace.id, grids, plants);
    } catch (cause) {
      throw partialSave(`The growspace was saved, but its grids weren’t`, cause, growspace);
    }
  }

  if (lights) {
    try {
      await saveGrowspaceLights(userId, growspace.id, lights);
    } catch (cause) {
      throw partialSave(`The growspace was saved, but its lights weren’t`, cause, growspace);
    }
  }

  return growspace;
}

/** An error that says what did land, so a retry can pick up from there. */
function partialSave(summary, cause, growspace) {
  const failure = new Error(`${summary}: ${cause.message}`);
  // @ts-expect-error - annotating the error with what a retry needs
  failure.growspace = growspace;
  // The summary on its own, for the screen. `messageFor` reads it rather than
  // `.message`, which carries the cause and belongs in a log.
  // @ts-expect-error - annotating the error with the sentence to show
  failure.summary = summary;
  return failure;
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
      .in(
        'id',
        removed.map((grid) => grid.id)
      );
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
      const { error } = await supabase.from('growspace_grids').update(payload).eq('id', grid.id);
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
      hours_on: parseHours(entry.hours_on),
    }));
  if (!rows.length) return;

  const { error } = await supabase.from('growspace_lights').insert(rows);
  if (error) throw error;
}
