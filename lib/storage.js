import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'uploads';

function extensionFromUri(uri) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * Uploads a locally-picked image to the shared "uploads" bucket under
 * "<user_id>/<entity>/<timestamp>.<ext>" and returns its public URL.
 *
 * Uploads as an ArrayBuffer (via base64) rather than a Blob/fetch, since
 * React Native's Blob + fetch combo unreliably fails Supabase Storage
 * uploads with "Network request failed".
 */
export async function uploadImage({ uri, userId, entity }) {
  const ext = extensionFromUri(uri);
  const path = `${userId}/${entity}/${Date.now()}.${ext}`;

  const base64 = await new File(uri).base64();
  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * The prefix every public URL in this bucket carries. Anything without it was
 * not put there by `uploadImage`.
 */
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/**
 * The bucket path inside one of our own public URLs, or null for anything else.
 *
 * Null is the important half. This decides what gets deleted, so it has to
 * refuse anything it doesn't recognise rather than guess: a row holding a URL
 * from somewhere else, an empty string, a path that escapes the bucket. A
 * lenient parser here is a delete aimed at a file nobody meant.
 *
 * If the bucket ever goes private (tracked in TASKS.md), signed URLs have a
 * different shape — `/object/sign/…` with a token — and this needs to learn it
 * rather than silently starting to return null for everything.
 */
export function storagePathFromUrl(url) {
  if (typeof url !== 'string') return null;

  const at = url.indexOf(PUBLIC_PREFIX);
  if (at === -1) return null;

  // Public URLs carry no query string today, but a cache-buster on the end
  // would otherwise become part of the path and delete nothing.
  const path = url.slice(at + PUBLIC_PREFIX.length).split('?')[0];
  if (!path) return null;

  const decoded = decodeURIComponent(path);
  // `..` can't appear in a path this app generates, and a delete is not the
  // place to find out whether the API would have normalised it.
  return decoded.includes('..') ? null : decoded;
}

/**
 * Removes the images behind a set of URLs. Anything unrecognised is skipped.
 *
 * Best-effort on purpose, and never throws. A photo left in a bucket costs a
 * megabyte; a plant that can't be deleted because its photo couldn't be is a
 * grower stuck on a row they've finished with. So the caller deletes the row
 * first and calls this after, and a failure here is a leak rather than a
 * blockage.
 *
 * Taking a list rather than one URL is what account deletion needs: it already
 * walks every table, and can hand over everything it found in one call instead
 * of a request per photo.
 *
 * @param {Array<string|null|undefined>} urls
 * @returns {Promise<number>} How many files were actually asked for.
 */
export async function deleteImages(urls) {
  const paths = (urls ?? []).map(storagePathFromUrl).filter(Boolean);
  if (!paths.length) return 0;

  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // Swallowed with the rest: see above.
  }
  return paths.length;
}

/** One image, for the entity deletes. */
export function deleteImage(url) {
  return deleteImages([url]);
}
