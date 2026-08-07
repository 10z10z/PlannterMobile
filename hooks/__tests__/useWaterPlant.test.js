jest.mock('../../lib/supabase');

import { act } from '@testing-library/react-native';
import { fake } from '../../test/fakeSupabase';
import { createTestQueryClient, renderHookWithProviders, settle } from '../../test/render';
import { keys } from '../../lib/queryKeys';
import { useWaterPlant } from '../useGrowspaces';

/**
 * Watering patches the plant by id across two trees rather than at one known
 * key, because the caller has only the id — it is pressed from the plant's own
 * screen and reachable from the grid, and neither knows every list the plant is
 * sitting in at the time.
 *
 * That is the part with something to get wrong, so it is what these drive: the
 * same plant in three places, and the things beside it that share a key prefix
 * and must not be touched.
 */

const PLANT = 'plant-1';
const GROWSPACE = 'growspace-1';
const DRY = '2026-07-01T09:00:00.000Z';

const plant = (id, name) => ({
  id,
  name,
  growspace_id: GROWSPACE,
  watering_interval_days: 7,
  last_watered_at: DRY,
});

const wateredAt = (row) => row?.last_watered_at;

async function mountWatering() {
  const queryClient = createTestQueryClient();

  // The same plant as its own screen holds it, and as the growspace holds it.
  queryClient.setQueryData(keys.plants.detail(PLANT), plant(PLANT, 'Basil'));
  queryClient.setQueryData(keys.growspaces.plants(GROWSPACE), [
    plant(PLANT, 'Basil'),
    plant('plant-2', 'Chard'),
  ]);
  // Beside it under the same prefix, and nothing to do with watering.
  queryClient.setQueryData(keys.growspaces.detail(GROWSPACE), {
    id: GROWSPACE,
    name: 'Tent A',
  });
  queryClient.setQueryData(keys.growspaces.grids(GROWSPACE), [
    { id: 'grid-1', name: 'Bench', grid_rows: 2, grid_cols: 2 },
  ]);

  const { result } = await renderHookWithProviders(() => useWaterPlant(), { queryClient });
  return { result, queryClient };
}

describe('useWaterPlant', () => {
  beforeEach(() => {
    fake.reset();
    fake.seed('plants', [plant(PLANT, 'Basil')]);
  });

  it('marks the plant watered everywhere it is shown, before the write lands', async () => {
    const { result, queryClient } = await mountWatering();
    const release = fake.holdNext('plants');

    await act(async () => {
      result.current.mutate(PLANT);
    });

    // Still out, so nothing has come back to be believed.
    expect(wateredAt(fake.rows('plants')[0])).toBe(DRY);

    const detail = /** @type {any} */ (queryClient.getQueryData(keys.plants.detail(PLANT)));
    const inSpace = /** @type {any[]} */ (
      queryClient.getQueryData(keys.growspaces.plants(GROWSPACE))
    );

    expect(wateredAt(detail)).not.toBe(DRY);
    // The same instant in both, because the tile's colour and the "next due"
    // line are the same figure read twice.
    expect(wateredAt(inSpace[0])).toBe(wateredAt(detail));

    await act(async () => {
      release();
    });
    await settle();
  });

  it('leaves the other plants in the space alone', async () => {
    const { result, queryClient } = await mountWatering();
    const release = fake.holdNext('plants');

    await act(async () => {
      result.current.mutate(PLANT);
    });

    const inSpace = /** @type {any[]} */ (
      queryClient.getQueryData(keys.growspaces.plants(GROWSPACE))
    );
    expect(wateredAt(inSpace[1])).toBe(DRY);

    await act(async () => {
      release();
    });
    await settle();
  });

  it('leaves the grids and the growspace itself alone', async () => {
    const { result, queryClient } = await mountWatering();
    const release = fake.holdNext('plants');

    await act(async () => {
      result.current.mutate(PLANT);
    });

    // Both sit under `growspaces.all` and are swept by the same `setQueriesData`.
    // Nothing matches the plant's id, so nothing should have changed — this is
    // the assertion that catches a patch written to touch whatever it is given.
    expect(queryClient.getQueryData(keys.growspaces.detail(GROWSPACE))).toEqual({
      id: GROWSPACE,
      name: 'Tent A',
    });
    expect(queryClient.getQueryData(keys.growspaces.grids(GROWSPACE))).toEqual([
      { id: 'grid-1', name: 'Bench', grid_rows: 2, grid_cols: 2 },
    ]);

    await act(async () => {
      release();
    });
    await settle();
  });

  it('puts the plant back dry when the write fails', async () => {
    const { result, queryClient } = await mountWatering();
    fake.failNext('plants');

    await act(async () => {
      result.current.mutate(PLANT);
    });
    await settle();

    const detail = /** @type {any} */ (queryClient.getQueryData(keys.plants.detail(PLANT)));
    // A plant shown as watered when it wasn't is worse than one shown a second
    // late: the reminder it silently cancels is the whole point of the field.
    expect(wateredAt(detail)).toBe(DRY);
  });
});
