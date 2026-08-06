import { supabase } from './supabase';

/**
 * Who is signed in, for the writes that have to stamp a row with an owner.
 *
 * Every table is guarded by row-level security keyed on `user_id`, so an insert
 * without one is refused by the database rather than merely being untidy. Asking
 * the client rather than threading `session.user.id` down from a screen keeps
 * that a property of the data layer: a repository function is responsible for
 * writing a valid row, and a form is not the right place to remember what the
 * schema requires.
 *
 * The session is held in memory by supabase-js once it has been read, so this is
 * a local lookup rather than a round trip.
 *
 * @returns {Promise<string|null>}
 */
export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/**
 * The same, but insisting.
 *
 * For writes, where carrying on without an owner would only produce a row-level
 * security failure a layer further down, with a worse message attached.
 *
 * @returns {Promise<string>}
 */
export async function requireUserId() {
  const userId = await currentUserId();
  if (!userId) throw new Error('You’ve been signed out. Sign in again to save this.');
  return userId;
}
