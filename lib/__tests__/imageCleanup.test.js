jest.mock('../supabase');
jest.mock('../notifications', () => ({
  scheduleWateringReminder: jest.fn(),
  cancelWateringReminder: jest.fn(),
}));
jest.mock('../activity', () => ({ recordEvent: jest.fn(), recordMove: jest.fn() }));

import { fake } from '../../test/fakeSupabase';
import { deletePlant } from '../growspaces';
import { shelfFor } from '../inventory';

/**
 * The leak, from the two places rows actually get thrown away.
 *
 * `lib/storage.js` is where the deleting happens and has its own tests; these
 * are about whether anything calls it. That was the whole bug — the code to
 * remove a file didn't exist, but neither did any call site, and adding the
 * first without the second would have looked just as finished.
 *
 * Six of the seven entities that carry a photo delete through one `shelf()`, so
 * the sixth is the same code path as the first; plants are the seventh and go
 * their own way.
 */

const withPhoto = (id, path) => ({
  id,
  user_id: 'user-1',
  name: 'Basil',
  image_url: fake.seedFile(path),
});

describe('deleting an entity takes its photo with it', () => {
  beforeEach(() => {
    fake.reset();
  });

  it('removes a seed pack’s photo', async () => {
    const pack = withPhoto('pack-1', 'user-1/seed_packs/1.jpg');
    fake.seed('seed_packs', [pack]);

    await shelfFor('seedPacks').remove('pack-1');

    expect(fake.rows('seed_packs')).toEqual([]);
    expect(fake.storedFiles()).toEqual([]);
  });

  it('leaves the photos of the ones it kept', async () => {
    fake.seed('trays', [
      withPhoto('tray-1', 'user-1/trays/1.jpg'),
      withPhoto('tray-2', 'user-1/trays/2.jpg'),
    ]);

    await shelfFor('trays').remove('tray-1');

    expect(fake.storedFiles()).toEqual(['user-1/trays/2.jpg']);
  });

  it('copes with a row that never had a photo', async () => {
    fake.seed('fertilizers', [{ id: 'fert-1', user_id: 'user-1', name: 'Grow', image_url: null }]);

    await expect(shelfFor('fertilizers').remove('fert-1')).resolves.toBe('fert-1');
  });

  it('still succeeds on a row that has already gone', async () => {
    // A tab refreshed on another screen shouldn't turn a second tap into an
    // error, which is what `.single()` on the delete would have done.
    await expect(shelfFor('mediums').remove('nope')).resolves.toBe('nope');
  });

  it('removes a plant’s photo', async () => {
    const plant = withPhoto('plant-1', 'user-1/plants/1.jpg');
    fake.seed('plants', [plant]);

    await deletePlant({ plant });

    expect(fake.rows('plants')).toEqual([]);
    expect(fake.storedFiles()).toEqual([]);
  });

  it('does not delete the photo when the row could not be deleted', async () => {
    const plant = withPhoto('plant-1', 'user-1/plants/1.jpg');
    fake.seed('plants', [plant]);
    fake.failNext('plants');

    await expect(deletePlant({ plant })).rejects.toBeDefined();

    // The order matters: row first, photo after. A photo deleted ahead of a row
    // that then survives is a broken image on a screen, which is worse than a
    // file nobody is paying much for.
    expect(fake.storedFiles()).toEqual(['user-1/plants/1.jpg']);
  });
});
