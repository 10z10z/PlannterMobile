jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import {
  fireEvent,
  pressWhenReady,
  renderWithProviders,
  screen,
  waitFor,
} from '../../../test/render';
import SowingFormDialog from '../SowingFormDialog';

/**
 * Sowing is the write worth testing hardest: it is three statements against
 * three tables with no transaction around them, and the seeds it spends are
 * spent for good. What a test can hold it to is that the arithmetic is right,
 * that the cells match the tray, and that the documented failure path really
 * does undo the half it managed.
 */

const PACK = {
  id: 'pack-1',
  user_id: 'user-1',
  name: 'Genovese basil',
  seed_count: 50,
  created_at: '2026-08-01T00:00:00.000Z',
};

const TRAY = {
  id: 'tray-1',
  user_id: 'user-1',
  name: 'Small tray',
  grid_rows: 2,
  grid_cols: 5,
  quantity: 1,
  created_at: '2026-08-01T00:00:00.000Z',
};

const press = (label) => fireEvent.press(screen.getByText(label));
const type = (label, value) => fireEvent.changeText(screen.getByLabelText(label), value);

/**
 * Pick the pack and the tray through the two menus, as a grower would. The
 * items are waited for rather than expected: opening a Paper menu takes a frame,
 * and the shelves behind them are queries.
 */
async function pick({ pack = 'Genovese basil (50 left)', tray = 'Small tray · 2 x 5 · 10 cells' }) {
  await press('Pick a seed pack');
  await pressWhenReady(pack);
  await press('Pick a tray');
  await pressWhenReady(tray);
}

async function openDialog(props = {}) {
  const onSaved = jest.fn();
  const view = await renderWithProviders(
    <SowingFormDialog
      visible
      onDismiss={() => {}}
      onSaved={onSaved}
      stationId="station-1"
      {...props}
    />
  );
  // The pickers are filled from the inventory queries, so nothing can be chosen
  // until those have arrived.
  await screen.findByText('Pick a seed pack');
  return { ...view, onSaved };
}

describe('SowingFormDialog', () => {
  beforeEach(() => {
    fake.reset();
    fake.seed('seed_packs', PACK);
    fake.seed('trays', TRAY);
  });

  it('sows the tray: one row, a cell each, and the seeds gone from the pack', async () => {
    const { onSaved } = await openDialog();

    await pick({});
    await type('Seeds per cell', '2');
    await press('Sow');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(fake.rows('sowings')).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        station_id: 'station-1',
        seed_pack_id: 'pack-1',
        seed_pack_name: 'Genovese basil',
        tray_id: 'tray-1',
        container_id: null,
        grid_rows: 2,
        grid_cols: 5,
      }),
    ]);

    const cells = fake.rows('sowing_cells');
    expect(cells).toHaveLength(10);
    expect(cells.every((cell) => cell.seeds_planted === 2)).toBe(true);
    expect(new Set(cells.map((cell) => `${cell.cell_row},${cell.cell_col}`)).size).toBe(10);

    // Ten cells at two seeds is twenty out of fifty.
    expect(fake.rows('seed_packs')[0].seed_count).toBe(30);
  });

  it('says what the sowing will cost before it is committed', async () => {
    await openDialog();

    await pick({});
    await type('Seeds per cell', '3');

    expect(screen.getByText('30 seeds in total, leaving 20 in the pack')).toBeOnTheScreen();
  });

  it('refuses to sow more seeds than the pack holds, and spends none of them', async () => {
    await openDialog();

    await pick({});
    await type('Seeds per cell', '9');
    await press('Sow');

    expect(screen.getByText('That needs 90 seeds and the pack has 50')).toBeOnTheScreen();
    expect(fake.rows('sowings')).toEqual([]);
    expect(fake.rows('seed_packs')[0].seed_count).toBe(50);
  });

  it('will not sow without somewhere to sow into', async () => {
    await openDialog();

    await press('Pick a seed pack');
    await pressWhenReady('Genovese basil (50 left)');
    await press('Sow');

    // Twice over: the button that was never pressed still says it, and now the
    // error under it does too.
    expect(screen.getAllByText('Pick a tray')).toHaveLength(2);
    expect(fake.rows('sowings')).toEqual([]);
  });

  it('takes the sowing back when the cells cannot be written', async () => {
    const { onSaved } = await openDialog();

    fake.failNext('sowing_cells', { code: '23503', message: 'insert or update violates key' });

    await pick({});
    await type('Seeds per cell', '2');
    await press('Sow');

    expect(
      await screen.findByText('Something else is still using this, so it can’t be removed yet.')
    ).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
    // The half that landed is taken back, and the seeds were never spent —
    // the subtraction comes after the cells.
    expect(fake.rows('sowings')).toEqual([]);
    expect(fake.rows('seed_packs')[0].seed_count).toBe(50);
  });

  it('files the sowing in the activity log', async () => {
    const { onSaved } = await openDialog();

    await pick({});
    await type('Seeds per cell', '2');
    await press('Sow');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fake.rows('activity_events')).toEqual([
      expect.objectContaining({
        kind: 'sown',
        subject: 'Genovese basil',
        detail: '2 x 5 tray · 20 seeds',
        station_id: 'station-1',
      }),
    ]);
  });
});
