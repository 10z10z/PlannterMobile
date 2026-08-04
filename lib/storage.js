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
