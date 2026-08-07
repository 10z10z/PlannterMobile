import { supabase } from './supabase';
import { requireUserId } from './session';
import { parseHours } from './growLights';
import { scheduleWateringReminder } from './notifications';
import { countLabel, recordEvent } from './activity';
import { earliestDate, toDateString } from './dates';
import { STATION_ENVIRONMENTS } from './enums';

// Defined in ./enums so validation can read it without loading the client.
export { STATION_ENVIRONMENTS };

export function environmentLabel(environment) {
  return STATION_ENVIRONMENTS.find((entry) => entry.value === environment)?.label ?? 'Indoor';
}

/**
 * A cell with anything growing in it is tinted green. Muted rather than pure
 * green, and darker-on-light / lighter-on-dark, so a full tray isn't glaring.
 */
export function germinatedCellColors(isDark) {
  return isDark
    ? { background: '#2C4630', border: '#5C8F62', text: '#D6E9D8' }
    : { background: '#CFE7D0', border: '#6FA873', text: '#1F3D23' };
}

// Lives in lib/dates now that the growspace screens count days too; re-exported
// so the germination screens can keep importing it from here.
export { daysSince } from './dates';

/**
 * The cells holding seedlings that could be moved, in grid order — which is the
 * order `transplant` drains them in, so a partial move empties whole cells from
 * the top left rather than scattering the gaps.
 */
export function germinatedCells(grid) {
  return (grid ?? []).flat().filter((cell) => cell && cell.germinated > 0);
}

/**
 * Whether a cell can be picked for transplanting. An empty cell and one that has
 * been sown but hasn't come up yet both have nothing to move, so neither can be
 * selected — holding one falls through to the card's own hold instead.
 */
export function isSelectable(cell) {
  return !!cell && cell.germinated > 0;
}

/** Adds or removes one cell from a selection, as a new array of cell ids. */
export function toggleCellSelection(selectedIds, cellId) {
  const ids = selectedIds ?? [];
  return ids.includes(cellId) ? ids.filter((id) => id !== cellId) : [...ids, cellId];
}

/**
 * The selected cells themselves, in grid order rather than the order they were
 * tapped in — the drain order is what decides which cells end up empty, and it
 * shouldn't depend on which corner the user started from.
 *
 * Cells that stopped being selectable while the selection was open (a background
 * refresh can empty one) drop out here, so the selection can never carry a cell
 * that has nothing left to give.
 */
export function selectedCells(grid, selectedIds) {
  const ids = new Set(selectedIds ?? []);
  return germinatedCells(grid).filter((cell) => ids.has(cell.id));
}

/** "3 cells · 7 seedlings", the count shown while a selection is being made. */
export function selectionSummary(cells) {
  const seedlings = (cells ?? []).reduce((sum, cell) => sum + cell.germinated, 0);
  const cellCount = (cells ?? []).length;
  return `${cellCount} cell${cellCount === 1 ? '' : 's'} · ${seedlings} seedling${
    seedlings === 1 ? '' : 's'
  }`;
}

export async function fetchStations() {
  const { data, error } = await supabase
    .from('germination_stations')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchStation(stationId) {
  const { data, error } = await supabase
    .from('germination_stations')
    .select('*')
    .eq('id', stationId)
    .single();
  if (error) throw error;
  return data;
}

/** The lights hanging over a station, each with the fixture it points at. */
export async function fetchStationLights(stationId) {
  const { data, error } = await supabase
    .from('station_lights')
    .select('*, light:grow_lights(*)')
    .eq('station_id', stationId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Replaces a station's light assignments with the given list of
 * `{ grow_light_id, quantity }`.
 *
 * Written as a clear-and-insert rather than a diff: a station carries a handful
 * of fixtures at most, and matching the on-screen list exactly is worth more
 * than saving a round trip.
 */
export async function saveStationLights(userId, stationId, assignments) {
  const { error: clearError } = await supabase
    .from('station_lights')
    .delete()
    .eq('station_id', stationId);
  if (clearError) throw clearError;

  const rows = assignments
    .filter((entry) => entry.quantity > 0)
    .map((entry) => ({
      user_id: userId,
      station_id: stationId,
      grow_light_id: entry.grow_light_id,
      quantity: entry.quantity,
      hours_on: parseHours(entry.hours_on),
    }));
  if (!rows.length) return;

  const { error } = await supabase.from('station_lights').insert(rows);
  if (error) throw error;
}

/**
 * Removes a sowing, and says so in the log first.
 *
 * The entry is written while the sowing is still there to be read, so it can
 * name what went. Deleting does not return the seeds to the pack — the sowing
 * happened, and the confirmation says as much before it is agreed to.
 *
 * @param {{ sowing: object, stationId: string }} params
 */
export async function deleteSowing({ sowing, stationId }) {
  await recordEvent({
    kind: 'removed',
    subject: sowing.seed_pack_name,
    detail: 'Sowing removed',
    stationId,
  });

  const { error } = await supabase.from('sowings').delete().eq('id', sowing.id);
  if (error) throw error;
  return sowing.id;
}

/**
 * Saves a station and the lights hanging over it.
 *
 * Two writes, because they are two tables and PostgREST has no transactions.
 * The station goes first and the assignments second, so a failure costs only
 * the lights — and because the station's id comes back with it, pressing save
 * again retries the assignments against the station that already exists rather
 * than creating a second one.
 *
 * That is a hand-rolled substitute for a transaction and it is not one. Moving
 * this into a Postgres function is tracked in TASKS.md; until then the partial
 * outcome is at least the harmless half, and it says so.
 *
 * @param {{ id?: string, values: object, lights: Array<object> }} params
 */
export async function saveStation({ id, values, lights }) {
  const userId = await requireUserId();

  let station;
  if (id) {
    const { data, error } = await supabase
      .from('germination_stations')
      .update(values)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    station = data;
  } else {
    const { data, error } = await supabase
      .from('germination_stations')
      .insert({ ...values, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    station = data;
  }

  try {
    await saveStationLights(userId, station.id, lights ?? []);
  } catch (cause) {
    // Carries the station back on the error, so a retry updates it instead of
    // inserting a second one with the same name.
    const summary = 'The station was saved, but its lights weren’t';
    const failure = new Error(`${summary}: ${cause.message}`);
    // @ts-expect-error - annotating the error with what a retry needs
    failure.station = station;
    // The summary on its own is what the dialog shows; the cause stays in the
    // message for a log.
    // @ts-expect-error - annotating the error with the sentence to show
    failure.summary = summary;
    throw failure;
  }

  return station;
}

/** Every sowing in a station, each with its cells laid out as a rows x cols grid. */
export async function fetchSowings(stationId) {
  const { data: sowings, error } = await supabase
    .from('sowings')
    // The tray and container are embedded for their labels only; the grid comes
    // from the sowing's own snapshot of the dimensions. The pack brings its
    // photo and its crop, which is null once a pack has been deleted.
    .select(
      '*, tray:trays(name), container:containers(material, volume_liters), seed_pack:seed_packs(image_url, plant_type)'
    )
    .eq('station_id', stationId)
    .order('sown_on', { ascending: false });
  if (error) throw error;
  if (!sowings?.length) return [];

  const { data: cells, error: cellsError } = await supabase
    .from('sowing_cells')
    .select('*')
    .in(
      'sowing_id',
      sowings.map((sowing) => sowing.id)
    );
  if (cellsError) throw cellsError;

  const bySowing = new Map();
  for (const cell of cells ?? []) {
    if (!bySowing.has(cell.sowing_id)) bySowing.set(cell.sowing_id, []);
    bySowing.get(cell.sowing_id).push(cell);
  }

  return sowings.map((sowing) => ({
    ...sowing,
    grid: toGrid(sowing, bySowing.get(sowing.id) ?? []),
  }));
}

/** Cells come back unordered; the grid puts them where they belong on screen. */
function toGrid(sowing, cells) {
  const lookup = new Map(cells.map((cell) => [`${cell.cell_row}:${cell.cell_col}`, cell]));
  return Array.from({ length: sowing.grid_rows }, (_, row) =>
    Array.from({ length: sowing.grid_cols }, (_, col) => lookup.get(`${row}:${col}`) ?? null)
  );
}

/**
 * Sows a tray or a single container and takes the seeds out of the pack.
 *
 * PostgREST has no transactions, so the cells are written after the sowing and
 * the sowing is rolled back by hand if they fail — leaving a sowing with no
 * grid behind would be worse than leaving nothing at all.
 */
export async function createSowing({
  // Optional, like everywhere else in the data layer.
  userId = null,
  stationId,
  seedPack,
  tray,
  container,
  seedsPerCell,
  sownOn,
}) {
  const owner = userId ?? (await requireUserId());
  const gridRows = tray ? tray.grid_rows : 1;
  const gridCols = tray ? tray.grid_cols : 1;
  const totalSeeds = gridRows * gridCols * seedsPerCell;

  // A pack with no count recorded is sown from without tracking what's left,
  // rather than blocking the sowing over a figure the user never entered.
  if (seedPack.seed_count !== null && seedPack.seed_count < totalSeeds) {
    throw new Error(
      `"${seedPack.name}" has ${seedPack.seed_count} seeds left, ${totalSeeds} needed`
    );
  }

  const { data: sowing, error } = await supabase
    .from('sowings')
    .insert({
      user_id: owner,
      station_id: stationId,
      seed_pack_id: seedPack.id,
      seed_pack_name: seedPack.name,
      tray_id: tray?.id ?? null,
      container_id: container?.id ?? null,
      grid_rows: gridRows,
      grid_cols: gridCols,
      sown_on: sownOn,
    })
    .select()
    .single();
  if (error) throw error;

  const cells = [];
  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      cells.push({
        user_id: owner,
        sowing_id: sowing.id,
        cell_row: row,
        cell_col: col,
        seeds_planted: seedsPerCell,
      });
    }
  }

  const { error: cellsError } = await supabase.from('sowing_cells').insert(cells);
  if (cellsError) {
    await supabase.from('sowings').delete().eq('id', sowing.id);
    throw cellsError;
  }

  if (seedPack.seed_count !== null) {
    await supabase
      .from('seed_packs')
      .update({ seed_count: seedPack.seed_count - totalSeeds })
      .eq('id', seedPack.id);
  }

  await recordEvent({
    userId: owner,
    kind: 'sown',
    subject: seedPack.name,
    detail: tray
      ? `${gridRows} x ${gridCols} tray · ${countLabel(totalSeeds, 'seed')}`
      : `${countLabel(totalSeeds, 'seed')} in one container`,
    occurredOn: sownOn,
    stationId,
    sowingId: sowing.id,
  });

  return sowing;
}

/**
 * Records how many of a cell's seeds have come up. The date is stamped on the
 * first sighting and kept afterwards, so a correction to the count doesn't
 * restart the clock — unless it goes back to zero, which un-germinates the cell.
 *
 * `sowing` is what the calendar entry needs to describe itself, and is left out
 * when a whole tray is being marked at once — that writes one entry of its own
 * rather than one per cell.
 */
export async function setCellGerminated(cell, germinated, sowing = null) {
  const payload = {
    germinated,
    germinated_on: germinated > 0 ? (cell.germinated_on ?? toDateString(new Date())) : null,
  };
  const { error } = await supabase.from('sowing_cells').update(payload).eq('id', cell.id);
  if (error) throw error;

  // Taking a count back to zero is a correction rather than something that
  // happened, so it isn't logged as a day's work.
  if (sowing && germinated > 0 && germinated !== cell.germinated) {
    await recordEvent({
      kind: 'germinated',
      subject: sowing.seed_pack_name,
      detail: `Cell ${cell.cell_row + 1}, ${cell.cell_col + 1} · ${germinated} of ${
        cell.seeds_planted
      } came up`,
      stationId: sowing.station_id,
      sowingId: sowing.id,
    });
  }
}

/**
 * Sets the same germinated count across a whole sowing, for the common case of
 * a tray that came up all at once.
 *
 * Cells that hold fewer seeds than the number given are filled rather than
 * skipped, so "3 per cell" on a mixed tray still means "as many as came up".
 * Emptied cells are left alone — they have nothing left to germinate.
 */
export async function setSowingGerminated(cells, germinated, sowing = null) {
  let changed = 0;
  let seedlings = 0;

  for (const cell of cells) {
    if (cell.seeds_planted === 0) continue;
    const capped = Math.min(germinated, cell.seeds_planted);
    if (capped === cell.germinated) continue;
    await setCellGerminated(cell, capped);
    changed += 1;
    seedlings += capped;
  }

  if (sowing && changed > 0 && germinated > 0) {
    await recordEvent({
      kind: 'germinated',
      subject: sowing.seed_pack_name,
      detail: `${countLabel(changed, 'cell')} marked · ${countLabel(seedlings, 'seedling')}`,
      stationId: sowing.station_id,
      sowingId: sowing.id,
    });
  }
}

/**
 * When a sowing first showed growth — the earliest cell to come up, since a tray
 * germinates over several days and the first sighting is what its age is counted
 * from. Null while nothing has come up yet.
 */
export function sowingGerminatedOn(grid) {
  return earliestDate(germinatedCells(grid).map((cell) => cell.germinated_on));
}

/**
 * The cells a thinning would actually change.
 *
 * A cell that hasn't come up yet is left alone — there is nothing to choose a
 * winner from, and clearing its seeds would throw away a sowing that may still
 * sprout. A cell already down to a single seedling and a single seed is done.
 */
export function thinnableCells(grid) {
  return germinatedCells(grid).filter((cell) => cell.germinated > 1 || cell.seeds_planted > 1);
}

/**
 * What a thinning would cost, for the confirmation dialog. Seedlings pulled and
 * seeds dropped are counted apart because they are different losses: one kills
 * something growing, the other gives up on a seed that never came up.
 */
export function thinningSummary(cells) {
  return (cells ?? []).reduce(
    (totals, cell) => ({
      cells: totals.cells + 1,
      seedlings: totals.seedlings + Math.max(0, cell.germinated - 1),
      seeds: totals.seeds + Math.max(0, cell.seeds_planted - cell.germinated),
    }),
    { cells: 0, seedlings: 0, seeds: 0 }
  );
}

/**
 * How many seeds a sowing started with in each cell, for duplicating it.
 *
 * The figure isn't stored: a sowing keeps its grid dimensions but not the dose
 * of seed that filled it. Transplanting and thinning only ever take seeds out of
 * a cell, so the fullest cell still standing is the best surviving evidence of
 * what went in — and a sowing that has been emptied out entirely falls back to
 * one, which is what the form offers for a fresh sowing anyway.
 */
export function originalSeedsPerCell(grid) {
  const most = (grid ?? [])
    .flat()
    .reduce((max, cell) => (cell ? Math.max(max, cell.seeds_planted) : max), 0);
  return most > 0 ? most : 1;
}

/** The stations a sowing could move to — every one but the one it's in. */
export function otherStations(stations, currentStationId) {
  return (stations ?? []).filter((station) => station.id !== currentStationId);
}

/**
 * Moves a sowing to another station, tray and all.
 *
 * Only the station changes: the grid, the cells and their germination dates
 * belong to the sowing rather than to where it was sitting, so a tray carried to
 * a warmer shelf keeps its history.
 */
export async function moveSowing(sowingId, stationId) {
  const { error } = await supabase
    .from('sowings')
    .update({ station_id: stationId })
    .eq('id', sowingId);
  if (error) throw error;
}

/**
 * Thins a sowing down to its strongest seedling per cell.
 *
 * Every cell that has come up keeps one seedling and one seed; the surplus
 * seedlings are culled and any seed that never sprouted is given up on, since
 * the cell is now committed to the survivor. The germination date is kept — the
 * cell came up when it came up, and the survivor is one of those seedlings.
 */
export async function thinSowing(cells, sowing = null) {
  const summary = thinningSummary(cells);

  for (const cell of cells) {
    const { error } = await supabase
      .from('sowing_cells')
      .update({ germinated: 1, seeds_planted: 1 })
      .eq('id', cell.id);
    if (error) throw error;
  }

  if (sowing && summary.cells > 0) {
    await recordEvent({
      kind: 'thinned',
      subject: sowing.seed_pack_name,
      detail: `${countLabel(summary.cells, 'cell')} down to one · ${countLabel(
        summary.seedlings,
        'seedling'
      )} removed`,
      stationId: sowing.station_id,
      sowingId: sowing.id,
    });
  }
}

/**
 * Moves germinated seedlings out of a sowing and into a growspace.
 *
 * One plant row is created per container, since container usage counts plants,
 * and the seedlings are spread over them as evenly as they divide. The cells
 * they came from lose both the seedlings and the seeds that produced them, so an
 * emptied cell reads 0/0 instead of still claiming to hold seeds.
 */
export async function transplant({
  // Optional, like everywhere else in the data layer.
  userId = null,
  sowing,
  cells,
  seedlingCount,
  growspaceId,
  containerId,
  containerCount,
  name,
}) {
  const available = cells.reduce((sum, cell) => sum + cell.germinated, 0);
  if (seedlingCount > available) {
    throw new Error(`Only ${available} seedling${available === 1 ? '' : 's'} to transplant`);
  }

  const perContainer = distribute(seedlingCount, containerCount);
  const nowIso = new Date().toISOString();
  const today = toDateString(new Date());
  // The earliest cell in the move: seedlings from several cells become one
  // plant, and the oldest of them is what its age should be counted from.
  const germinatedOn = earliestDate(cells.map((cell) => cell.germinated_on));

  const owner = userId ?? (await requireUserId());

  const plants = perContainer.map((count, index) => ({
    user_id: owner,
    growspace_id: growspaceId,
    container_id: containerId,
    name: containerCount > 1 ? `${name} ${index + 1}` : name,
    species: sowing.seed_pack_name,
    // Copied off the pack rather than read back through it, so editing or
    // deleting the pack can't change what a growing plant is.
    plant_type: sowing.seed_pack?.plant_type ?? null,
    image_url: sowing.seed_pack?.image_url ?? null,
    germinated_on: germinatedOn,
    transplanted_on: today,
    seedling_count: count,
    watering_interval_days: 7,
    last_watered_at: nowIso,
  }));

  const { data: created, error } = await supabase.from('plants').insert(plants).select();
  if (error) throw error;

  // Transplants arrive watered, so they join the reminder cycle like any plant
  // added by hand.
  for (const plant of created ?? []) {
    await scheduleWateringReminder(plant);
  }

  // A transplant is one act with two ends: seedlings leave the station and
  // plants arrive in the growspace. Each end is logged where it happened, so
  // both calendars show their own side of it.
  const potted = countLabel(created?.length ?? 0, 'plant');
  await recordEvent({
    userId: owner,
    kind: 'transplanted',
    subject: sowing.seed_pack_name,
    detail: `${countLabel(seedlingCount, 'seedling')} moved out · ${potted}`,
    occurredOn: today,
    stationId: sowing.station_id,
    sowingId: sowing.id,
  });
  // The arriving end is one entry per plant rather than one summary, because
  // each of those plants has its own history from here on — and because it is
  // what the plant's own `transplanted_on` already says, so the two describe the
  // same thing instead of the calendar showing it twice.
  for (const plant of created ?? []) {
    await recordEvent({
      userId: owner,
      kind: 'planted',
      subject: plant.name,
      detail: `${countLabel(plant.seedling_count, 'seedling')} from ${sowing.seed_pack_name}`,
      occurredOn: today,
      growspaceId,
      plantId: plant.id,
    });
  }

  // Drained in grid order, so transplanting "6 from this tray" empties the cells
  // that came up first rather than scattering the gaps.
  let remaining = seedlingCount;
  for (const cell of cells) {
    if (remaining <= 0) break;
    const taken = Math.min(cell.germinated, remaining);
    remaining -= taken;
    await supabase
      .from('sowing_cells')
      .update({
        germinated: cell.germinated - taken,
        seeds_planted: cell.seeds_planted - taken,
        germinated_on: cell.germinated - taken > 0 ? cell.germinated_on : null,
      })
      .eq('id', cell.id);
  }

  return created;
}

/** Spreads `total` over `buckets` as evenly as it divides: 7 over 3 -> [3, 2, 2]. */
function distribute(total, buckets) {
  const base = Math.floor(total / buckets);
  const extra = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < extra ? 1 : 0));
}
