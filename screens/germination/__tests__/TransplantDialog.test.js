jest.mock('../../../lib/supabase');

import { fake } from '../../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../test/render';
import TransplantDialog from '../TransplantDialog';

/**
 * The other end of the sowing: seedlings stop being cells of a tray and become
 * plants standing in a growspace. Two things are worth holding it to — that the
 * seedlings are spread over the containers as evenly as they divide, and that
 * the cells they came out of are drained by exactly as many as left.
 */

const GROWSPACE = {
  id: 'space-1',
  user_id: 'user-1',
  name: 'Tent',
  created_at: '2026-08-01T00:00:00.000Z',
};

const SOWING = {
  id: 'sowing-1',
  station_id: 'station-1',
  seed_pack_name: 'Genovese basil',
  seed_pack: { plant_type: 'leaf', image_url: null },
  grid: [],
};

/** Two cells, four seedlings up between them. */
const CELLS = [
  { id: 'cell-1', germinated: 3, seeds_planted: 3, germinated_on: '2026-08-03' },
  { id: 'cell-2', germinated: 1, seeds_planted: 2, germinated_on: '2026-08-05' },
];

/**
 * The dialog is titled the same as the button that does the thing, so the
 * button is the second of the two.
 */
const submit = async () => {
  // The one growspace picks itself, but only once the query it comes from has
  // arrived — and nothing can be saved until it has.
  await screen.findByText('Tent');
  await fireEvent.press(screen.getAllByText('Transplant')[1]);
};
const type = (label, value) => fireEvent.changeText(screen.getByLabelText(label), value);

async function openDialog(props = {}) {
  const onDone = jest.fn();
  const view = await renderWithProviders(
    <TransplantDialog
      visible
      sowing={SOWING}
      cells={CELLS}
      onDismiss={() => {}}
      onDone={onDone}
      {...props}
    />
  );
  return { ...view, onDone };
}

describe('TransplantDialog', () => {
  beforeEach(() => {
    fake.reset();
    fake.seed('growspaces', GROWSPACE);
    fake.seed(
      'sowing_cells',
      CELLS.map((cell) => ({ ...cell, sowing_id: 'sowing-1' }))
    );
  });

  it('says how many are ready and where they came from', async () => {
    await openDialog();

    expect(screen.getByText('4 seedlings ready in the 2 selected cells.')).toBeOnTheScreen();
  });

  it('makes one plant per container, sharing the seedlings out', async () => {
    const { onDone } = await openDialog();

    await type('Containers to use', '3');
    await submit();

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const plants = fake.rows('plants');
    expect(plants.map((plant) => plant.name)).toEqual([
      'Genovese basil 1',
      'Genovese basil 2',
      'Genovese basil 3',
    ]);
    // Four over three is 2, 1, 1 — not a fraction of a seedling anywhere.
    expect(plants.map((plant) => plant.seedling_count)).toEqual([2, 1, 1]);
    expect(plants[0]).toMatchObject({
      user_id: 'user-1',
      growspace_id: 'space-1',
      species: 'Genovese basil',
      plant_type: 'leaf',
      // The oldest cell in the move, so the plant's age counts from the first
      // seedling in it rather than the last.
      germinated_on: '2026-08-03',
    });
  });

  it('leaves one plant unnumbered', async () => {
    const { onDone } = await openDialog();

    await type('Containers to use', '1');
    await submit();

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fake.rows('plants').map((plant) => plant.name)).toEqual(['Genovese basil']);
  });

  it('drains the cells in order, and only by what left', async () => {
    const { onDone } = await openDialog();

    await type('Seedlings to move', '3');
    await type('Containers to use', '1');
    await submit();

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const cells = fake.rows('sowing_cells');
    // The first cell had three and gave all three; the second is untouched, so
    // a partial move empties what came up first rather than scattering gaps.
    expect(cells[0]).toMatchObject({ germinated: 0, seeds_planted: 0, germinated_on: null });
    expect(cells[1]).toMatchObject({ germinated: 1, seeds_planted: 2 });
  });

  it('refuses more containers than there are seedlings', async () => {
    await openDialog();

    await type('Seedlings to move', '2');
    await type('Containers to use', '5');
    await submit();

    expect(screen.getByText('There cannot be more containers than seedlings')).toBeOnTheScreen();
    expect(fake.rows('plants')).toEqual([]);
  });

  it('refuses to move more seedlings than have come up', async () => {
    await openDialog();

    await type('Seedlings to move', '9');
    await submit();

    expect(screen.getByText('Seedlings to move must be between 1 and 4')).toBeOnTheScreen();
    expect(fake.rows('plants')).toEqual([]);
  });

  it('logs both ends of the move', async () => {
    const { onDone } = await openDialog();

    await type('Containers to use', '1');
    await submit();

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const events = fake.rows('activity_events');
    // One entry where the seedlings left, one where the plant arrived — the two
    // calendars each show their own side of it.
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'transplanted',
        station_id: 'station-1',
        sowing_id: 'sowing-1',
        detail: '4 seedlings moved out · 1 plant',
      }),
      expect.objectContaining({
        kind: 'planted',
        growspace_id: 'space-1',
        subject: 'Genovese basil',
      }),
    ]);
  });
});
