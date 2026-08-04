import { supabase } from './supabase';
import { scheduleWateringReminder } from './notifications';
import { toDateString } from '../components/DateField';

export const STATION_ENVIRONMENTS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
];

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

export function daysSince(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  const then = new Date(year, month - 1, day);
  const today = new Date();
  const days = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()) - then) / 86400000
  );
  return days < 0 ? 0 : days;
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
    }));
  if (!rows.length) return;

  const { error } = await supabase.from('station_lights').insert(rows);
  if (error) throw error;
}

/** Every sowing in a station, each with its cells laid out as a rows x cols grid. */
export async function fetchSowings(stationId) {
  const { data: sowings, error } = await supabase
    .from('sowings')
    // The tray and container are embedded for their labels only; the grid comes
    // from the sowing's own snapshot of the dimensions.
    .select('*, tray:trays(name), container:containers(material, volume_liters)')
    .eq('station_id', stationId)
    .order('sown_on', { ascending: false });
  if (error) throw error;
  if (!sowings?.length) return [];

  const { data: cells, error: cellsError } = await supabase
    .from('sowing_cells')
    .select('*')
    .in('sowing_id', sowings.map((sowing) => sowing.id));
  if (cellsError) throw cellsError;

  const bySowing = new Map();
  for (const cell of cells ?? []) {
    if (!bySowing.has(cell.sowing_id)) bySowing.set(cell.sowing_id, []);
    bySowing.get(cell.sowing_id).push(cell);
  }

  return sowings.map((sowing) => ({ ...sowing, grid: toGrid(sowing, bySowing.get(sowing.id) ?? []) }));
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
  userId,
  stationId,
  seedPack,
  tray,
  container,
  seedsPerCell,
  sownOn,
}) {
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
      user_id: userId,
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
        user_id: userId,
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

  return sowing;
}

/**
 * Records how many of a cell's seeds have come up. The date is stamped on the
 * first sighting and kept afterwards, so a correction to the count doesn't
 * restart the clock — unless it goes back to zero, which un-germinates the cell.
 */
export async function setCellGerminated(cell, germinated) {
  const payload = {
    germinated,
    germinated_on: germinated > 0 ? cell.germinated_on ?? toDateString(new Date()) : null,
  };
  const { error } = await supabase.from('sowing_cells').update(payload).eq('id', cell.id);
  if (error) throw error;
}

/**
 * Sets the same germinated count across a whole sowing, for the common case of
 * a tray that came up all at once.
 *
 * Cells that hold fewer seeds than the number given are filled rather than
 * skipped, so "3 per cell" on a mixed tray still means "as many as came up".
 * Emptied cells are left alone — they have nothing left to germinate.
 */
export async function setSowingGerminated(cells, germinated) {
  for (const cell of cells) {
    if (cell.seeds_planted === 0) continue;
    const capped = Math.min(germinated, cell.seeds_planted);
    if (capped === cell.germinated) continue;
    await setCellGerminated(cell, capped);
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
  userId,
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
  const plants = perContainer.map((count, index) => ({
    user_id: userId,
    growspace_id: growspaceId,
    container_id: containerId,
    name: containerCount > 1 ? `${name} ${index + 1}` : name,
    species: sowing.seed_pack_name,
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
