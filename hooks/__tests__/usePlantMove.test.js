jest.mock('../../lib/supabase');

import { act } from '@testing-library/react-native';
import { fake } from '../../test/fakeSupabase';
import { createTestQueryClient, renderHookWithProviders } from '../../test/render';
import { keys } from '../../lib/queryKeys';
import usePlantMove from '../usePlantMove';

/**
 * The orchestration behind a drop, which until now could only be reached by a
 * finger.
 *
 * `PlantGrid`'s own tests drive the rearrange buttons and assert that `onMove`
 * and `onUnplace` are called with the right plant and the right cell. What
 * happens *after* that — the optimistic edit, the writes, the calendar entries,
 * and what is left behind when one of the writes fails — is this hook, and none
 * of it was covered. It is also the part with three failure paths in it.
 *
 * Two things are deliberately asserted the way they are:
 *
 * - **Invalidation, not rollback.** The hook's answer to a failed write is to
 *   invalidate and let the refetch put the tile back. Nothing here is watching
 *   the query, so nothing refetches — an inactive query is marked stale and left
 *   alone, which is React Query working correctly. So the assertion is that the
 *   plants query came out invalidated. Testing the refetch itself would be
 *   testing React Query.
 * - **The optimistic edit is read before the write settles.** `move` is called
 *   without awaiting it: everything up to the first `await` has already run by
 *   the time the call returns, and that is exactly the window the grid renders
 *   in.
 */

const GROWSPACE = 'growspace-1';

const GRIDS = [{ id: 'grid-1', name: 'Bench', grid_rows: 2, grid_cols: 2 }];

const plant = (id, name, row, col) => ({
  id,
  name,
  growspace_id: GROWSPACE,
  grid_id: row === null ? null : 'grid-1',
  grid_row: row,
  grid_col: col,
});

const BASIL = plant('plant-1', 'Basil', 0, 0);
const CHARD = plant('plant-2', 'Chard', 1, 1);
const MINT = plant('plant-3', 'Mint', null, null);

const PLANTS = [BASIL, CHARD, MINT];

const cell = (row, col) => ({ gridId: 'grid-1', row, col });

/** Where the plants query says a plant is standing, cache-side. */
const cached = (queryClient, id) =>
  /** @type {any[]} */ (queryClient.getQueryData(keys.growspaces.plants(GROWSPACE))).find(
    (entry) => entry.id === id
  );

/** Where the database says it is. */
const stored = (id) => fake.rows('plants').find((row) => row.id === id);

const position = (row) => ({
  grid_id: row.grid_id,
  grid_row: row.grid_row,
  grid_col: row.grid_col,
});

const moves = () =>
  fake
    .rows('activity_events')
    .filter((row) => row.kind === 'moved')
    .map((row) => `${row.subject}: ${row.detail}`);

async function mountHook(plants = PLANTS) {
  const queryClient = createTestQueryClient();
  // What the screen's `useGrowspacePlants` would have put there, since the
  // optimistic edit rewrites that entry rather than making one.
  queryClient.setQueryData(keys.growspaces.plants(GROWSPACE), plants);

  const { result } = await renderHookWithProviders(
    () => usePlantMove({ growspaceId: GROWSPACE, grids: GRIDS, plants }),
    { queryClient }
  );

  return { result, queryClient };
}

describe('usePlantMove', () => {
  beforeEach(() => {
    fake.reset();
    fake.seed('plants', PLANTS);
  });

  it('moves a plant into an empty spot and names where it went', async () => {
    const { result } = await mountHook();

    await act(async () => {
      await result.current.move(BASIL, cell(0, 1));
    });

    expect(position(stored('plant-1'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 0,
      grid_col: 1,
    });
    // Counted from one, and named after the grid rather than its id — this is
    // the line the grower reads in the calendar.
    expect(moves()).toEqual(['Basil: Bench, spot 1,2']);
  });

  it('moves the tile before the write has landed', async () => {
    const { result, queryClient } = await mountHook();

    const pending = result.current.move(BASIL, cell(0, 1));

    // Not awaited: this is the frame the grid draws in while the round trip is
    // still out, and a tile that waited for it would flick back visibly.
    expect(position(cached(queryClient, 'plant-1'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 0,
      grid_col: 1,
    });

    await act(async () => {
      await pending;
    });
  });

  it('swaps two plants and gives each its own entry', async () => {
    const { result } = await mountHook();

    await act(async () => {
      await result.current.move(BASIL, cell(1, 1));
    });

    expect(position(stored('plant-1'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 1,
      grid_col: 1,
    });
    expect(position(stored('plant-2'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 0,
      grid_col: 0,
    });

    // The plant that was displaced gets a line saying so, because a day that
    // only mentions the plant that was dragged doesn't explain the other one.
    expect(moves()).toEqual([
      'Basil: Bench, spot 2,2',
      'Chard: Bench, spot 1,1 · swapped with Basil',
    ]);
  });

  it('swaps a plant out of the holding tray, which sends the other one back to it', async () => {
    const { result, queryClient } = await mountHook();

    await act(async () => {
      await result.current.move(MINT, cell(0, 0));
    });

    expect(position(stored('plant-3'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 0,
      grid_col: 0,
    });
    expect(position(stored('plant-1'))).toEqual({
      grid_id: null,
      grid_row: null,
      grid_col: null,
    });
    expect(position(cached(queryClient, 'plant-1'))).toEqual({
      grid_id: null,
      grid_row: null,
      grid_col: null,
    });
    expect(moves()).toEqual([
      'Mint: Bench, spot 1,1',
      'Basil: Back in the holding tray · swapped with Mint',
    ]);
  });

  it('does nothing at all when a plant is dropped where it already stands', async () => {
    const { result } = await mountHook();

    await act(async () => {
      await result.current.move(BASIL, cell(0, 0));
    });

    // Not merely "no move recorded" — a write and a calendar entry for standing
    // still would both be wrong, and a drag that ends where it began is the
    // commonest thing a finger does.
    expect(moves()).toEqual([]);
    expect(position(stored('plant-1'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 0,
      grid_col: 0,
    });
  });

  it('sends a plant back to the holding tray', async () => {
    const { result } = await mountHook();

    await act(async () => {
      await result.current.unplace(BASIL);
    });

    expect(position(stored('plant-1'))).toEqual({
      grid_id: null,
      grid_row: null,
      grid_col: null,
    });
    expect(moves()).toEqual(['Basil: Back in the holding tray']);
  });

  it('records nothing when the write fails, and invalidates so the tile goes back', async () => {
    const { result, queryClient } = await mountHook();
    fake.failNext('plants');

    await act(async () => {
      await result.current.move(BASIL, cell(0, 1));
    });

    // The calendar would otherwise claim a move that never happened.
    expect(moves()).toEqual([]);
    expect(position(stored('plant-1'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 0,
      grid_col: 0,
    });
    expect(queryClient.getQueryState(keys.growspaces.plants(GROWSPACE))?.isInvalidated).toBe(true);
  });

  it('leaves one plant in the tray when a swap fails half way, not two in one cell', async () => {
    const { result, queryClient } = await mountHook();
    // A swap is three writes with no transaction under them: lift the occupant
    // out, move the plant in, put the occupant where the plant was. The middle
    // one is the interesting failure — it is the point at which one plant has
    // already been moved and the other hasn't.
    fake.failNext('plants', undefined, { after: 1 });

    await act(async () => {
      await result.current.move(BASIL, cell(1, 1));
    });

    // Chard was lifted out and never put down. That is the outcome `swapPlants`
    // orders its writes to get: a plant in the holding tray is visible and can
    // be placed again, whereas two plants claiming one cell is a state the
    // unique index won't hold and the grid can't draw.
    expect(position(stored('plant-2'))).toEqual({
      grid_id: null,
      grid_row: null,
      grid_col: null,
    });
    expect(position(stored('plant-1'))).toEqual({
      grid_id: 'grid-1',
      grid_row: 0,
      grid_col: 0,
    });

    // Both entries come after the writes, so a half-done swap says nothing
    // rather than claiming a move that only half happened.
    expect(moves()).toEqual([]);
    expect(queryClient.getQueryState(keys.growspaces.plants(GROWSPACE))?.isInvalidated).toBe(true);
  });
});
