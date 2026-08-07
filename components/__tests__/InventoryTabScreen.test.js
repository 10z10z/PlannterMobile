jest.mock('../../lib/supabase');

import { fake } from '../../test/fakeSupabase';
import { fireEvent, renderWithProviders, screen, settle, waitFor } from '../../test/render';
import SeedsTab from '../../screens/inventory/SeedsTab';

/**
 * The shell all six inventory tabs are, driven through one of them.
 *
 * It was untested, which is six tabs' worth of list, add, edit and delete
 * resting on nothing. `SeedsTab` is the thinnest of the six — no usage join
 * behind its list — so what is exercised here is the shell rather than the
 * subject, and what is true of it is true of the other five by construction.
 *
 * The empty state is the reason for writing it now. It used to say "No seed
 * packs yet. Tap + to add one", which is a screen describing its own furniture
 * and leaving the grower to find it. It offers the button instead.
 */

const PACK = {
  id: 'pack-1',
  user_id: 'user-1',
  name: 'Genovese basil',
  plant_type: 'basil',
  seed_count: 40,
  image_url: null,
  created_at: '2026-08-01T00:00:00.000Z',
};

const press = async (label) => {
  await fireEvent.press(screen.getByText(label));
  await settle();
};

describe('InventoryTabScreen', () => {
  beforeEach(() => {
    fake.reset();
  });

  it('offers the way out of an empty shelf, rather than pointing at it', async () => {
    await renderWithProviders(<SeedsTab />);

    expect(await screen.findByText('No seed packs yet.')).toBeOnTheScreen();

    // The same button the FAB is, where someone with an empty screen is
    // already looking.
    await press('Add seed pack');

    expect(await screen.findByText('New Seed Pack')).toBeOnTheScreen();
  });

  it('lists what is on the shelf', async () => {
    fake.seed('seed_packs', [PACK]);
    await renderWithProviders(<SeedsTab />);

    expect(await screen.findByText('Genovese basil')).toBeOnTheScreen();
    // The empty state and the list are exclusive, which is the distinction
    // `QueryBoundary` exists to make.
    expect(screen.queryByText('No seed packs yet.')).not.toBeOnTheScreen();
  });

  it('asks before it throws anything out', async () => {
    fake.seed('seed_packs', [PACK]);
    await renderWithProviders(<SeedsTab />);
    await screen.findByText('Genovese basil');

    await fireEvent.press(screen.getByLabelText('Delete Genovese basil'));
    await settle();

    expect(screen.getByText('Remove “Genovese basil” from your inventory?')).toBeOnTheScreen();
    // Asked, not done.
    expect(fake.rows('seed_packs')).toHaveLength(1);
  });

  it('throws it out once, and stops listing it', async () => {
    fake.seed('seed_packs', [PACK]);
    await renderWithProviders(<SeedsTab />);
    await screen.findByText('Genovese basil');

    await fireEvent.press(screen.getByLabelText('Delete Genovese basil'));
    await settle();
    await press('Delete');

    await waitFor(() => expect(fake.rows('seed_packs')).toEqual([]));
    await waitFor(() => expect(screen.queryByText('Genovese basil')).not.toBeOnTheScreen());
  });

  it('keeps the row when the delete fails, and says why', async () => {
    fake.seed('seed_packs', [PACK]);
    await renderWithProviders(<SeedsTab />);
    await screen.findByText('Genovese basil');

    // Queued only now: the list read is a query against the same table, and
    // arming it any earlier fails the read instead of the delete.
    fake.failNext('seed_packs', { code: '23503', message: 'violates foreign key constraint' });

    await fireEvent.press(screen.getByLabelText('Delete Genovese basil'));
    await settle();
    await press('Delete');

    // The dialog stays open with the reason on it rather than closing onto a
    // row that is somehow still in the list.
    expect(
      await screen.findByText('Something else is still using this, so it can’t be removed yet.')
    ).toBeOnTheScreen();
    expect(screen.queryByText(/foreign key constraint/)).not.toBeOnTheScreen();
    expect(fake.rows('seed_packs')).toHaveLength(1);
  });
});
