import { supabase } from './supabase';
import { requireUserId } from './session';

/**
 * Reading and writing the fertilizer shelf.
 *
 * The nutrient maths lives in `lib/nutrients.js`; this is only the storage —
 * what is on the shelf, and putting something new on it. Kept apart because the
 * calculator has to be testable against made-up products, and the shelf has to
 * be swappable without the maths noticing.
 *
 * Errors are thrown rather than returned. A caller that wants to carry on
 * regardless has to say so, which is the opposite of what the screens used to
 * do — `if (!error)` and then silence, so a failed read looked exactly like an
 * empty shelf.
 */

/** Everything on the shelf, newest first — the order the tab lists them in. */
export async function fetchFertilizers() {
  const { data, error } = await supabase
    .from('fertilizers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Creates one or updates one, depending on whether an id came with it.
 *
 * One function rather than two because the form is one form: the fields, the
 * validation and the units are identical, and the only difference is whether
 * there is already a row to put them in.
 *
 * @param {object} params
 * @param {string} [params.id] Present when editing.
 * @param {object} params.values The column values, already converted to storage
 *   units by the caller.
 */
export async function saveFertilizer({ id, values }) {
  if (id) {
    const { data, error } = await supabase
      .from('fertilizers')
      .update(values)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('fertilizers')
    .insert({ ...values, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFertilizer(fertilizerId) {
  const { error } = await supabase.from('fertilizers').delete().eq('id', fertilizerId);
  if (error) throw error;
  return fertilizerId;
}
