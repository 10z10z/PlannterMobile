jest.mock('../supabase');

import { fake } from '../../test/fakeSupabase';
import { deleteImage, deleteImages, storagePathFromUrl } from '../storage';

/**
 * Nothing in this app deleted a picture until now. Every photo ever attached to
 * a plant, a seed pack or a bag of compost stayed in the bucket after the row
 * that referenced it was thrown away, and the only thing that would ever have
 * noticed is a storage bill.
 *
 * The half worth most of the tests is `storagePathFromUrl`, because it decides
 * what gets deleted. Everything it fails to recognise is a leak; everything it
 * recognises wrongly is a delete aimed somewhere nobody meant, and only one of
 * those two is recoverable.
 */

const PATH = 'user-1/plants/1712345678901.jpg';
const URL = `https://project.supabase.co/storage/v1/object/public/uploads/${PATH}`;

describe('storagePathFromUrl', () => {
  it('reads the path out of a URL this app produced', () => {
    expect(storagePathFromUrl(URL)).toBe(PATH);
  });

  it('survives a query string on the end', () => {
    // Not there today, but a cache-buster appended later would otherwise become
    // part of the path and quietly delete nothing at all.
    expect(storagePathFromUrl(`${URL}?v=2`)).toBe(PATH);
  });

  it('decodes what the URL escaped', () => {
    const spaced = 'user-1/plants/my photo.jpg';
    const url = `https://project.supabase.co/storage/v1/object/public/uploads/user-1/plants/my%20photo.jpg`;
    expect(storagePathFromUrl(url)).toBe(spaced);
  });

  it('refuses anything that is not one of ours', () => {
    const strangers = [
      // Another bucket in the same project.
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/a.jpg',
      // Somewhere else entirely.
      'https://example.com/photo.jpg',
      // A local file that never got uploaded.
      'file:///var/mobile/photo.jpg',
      '',
      null,
      undefined,
      42,
    ];

    for (const stranger of strangers) {
      expect(storagePathFromUrl(/** @type {any} */ (stranger))).toBeNull();
    }
  });

  it('refuses a path that tries to climb out of the bucket', () => {
    const climbing =
      'https://project.supabase.co/storage/v1/object/public/uploads/user-1/../user-2/plants/a.jpg';
    // Nothing this app writes looks like this, and a delete is not the place to
    // find out whether the API would have normalised it.
    expect(storagePathFromUrl(climbing)).toBeNull();
  });
});

describe('deleteImages', () => {
  beforeEach(() => {
    fake.reset();
  });

  it('removes the file behind a URL', async () => {
    const url = fake.seedFile(PATH);

    await deleteImage(url);

    expect(fake.storedFiles()).toEqual([]);
  });

  it('leaves the other files alone', async () => {
    const url = fake.seedFile(PATH);
    fake.seedFile('user-1/plants/other.jpg');

    await deleteImage(url);

    expect(fake.storedFiles()).toEqual(['user-1/plants/other.jpg']);
  });

  it('asks once for a whole list, which is what account deletion needs', async () => {
    const urls = [
      fake.seedFile('user-1/plants/a.jpg'),
      fake.seedFile('user-1/seed_packs/b.jpg'),
      fake.seedFile('user-1/trays/c.jpg'),
    ];

    expect(await deleteImages(urls)).toBe(3);
    expect(fake.storedFiles()).toEqual([]);
  });

  it('asks for nothing when there is nothing it recognises', async () => {
    fake.seedFile(PATH);

    expect(await deleteImages([null, '', 'https://example.com/a.jpg'])).toBe(0);
    // The point: a row with no photo, or a photo from somewhere else, must not
    // turn into a request at all.
    expect(fake.storedFiles()).toEqual([PATH]);
  });

  it('does not throw when the bucket refuses', async () => {
    const url = fake.seedFile(PATH);
    const bucket = fake.client.storage.from('uploads');
    bucket.remove.mockRejectedValueOnce(new Error('storage is down'));

    // Callers delete the row first and call this after. A throw here would turn
    // a leaked file into a failed delete, which is the worse of the two.
    await expect(deleteImage(url)).resolves.toBe(1);
    // Asserted because the rejection has to have actually happened: `from()`
    // used to hand back a new mock each call, so this queued a failure on an
    // object the code under test never saw and the test passed regardless.
    expect(bucket.remove).toHaveBeenCalledWith([PATH]);
  });
});
