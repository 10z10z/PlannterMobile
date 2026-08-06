import { supabase } from './supabase';
import { requireUserId } from './session';
import { fetchContainersWithUsage } from './containers';
import { fetchTraysWithUsage } from './trays';
import { fetchGrowLightsWithUsage } from './growLights';

/**
 * The six things kept on a shelf rather than growing in one.
 *
 * Fertilizers, seed packs, containers, trays, growing mediums and grow lights
 * are six different subjects with one storage story: list what you have, add or
 * edit one, throw one out. Writing that six times produced six chances to get
 * the error handling subtly different, which is exactly what had happened —
 * three tabs swallowed a failed read and three showed nothing at all.
 *
 * So the shape is written once. What is genuinely different stays different:
 * containers, trays and lights each count how many are spoken for, which is a
 * join rather than a list and lives in its own module.
 */

/**
 * List, save and delete for one table.
 *
 * @param {string} table The Postgres table name.
 */
function shelf(table) {
  return {
    table,

    /** Newest first, which is the order every tab lists them in. */
    async list() {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    /**
     * Creates or updates, depending on whether an id came with it.
     *
     * @param {{ id?: string, values: object }} params
     */
    async save({ id, values }) {
      if (id) {
        const { data, error } = await supabase
          .from(table)
          .update(values)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const userId = await requireUserId();
      const { data, error } = await supabase
        .from(table)
        .insert({ ...values, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
  };
}

/**
 * Every shelf, by the name the screens and the cache keys both use.
 *
 * The three that count usage override `list` with the join that does it — a
 * container tab that couldn't say "8/10 in use" would be missing the point of
 * the tab.
 */
export const SHELVES = {
  fertilizers: shelf('fertilizers'),
  seedPacks: shelf('seed_packs'),
  mediums: shelf('growing_mediums'),
  containers: { ...shelf('containers'), list: fetchContainersWithUsage },
  trays: { ...shelf('trays'), list: fetchTraysWithUsage },
  growLights: { ...shelf('grow_lights'), list: fetchGrowLightsWithUsage },
};

/** @typedef {keyof typeof SHELVES} ShelfName */

/**
 * @param {ShelfName} name
 */
export function shelfFor(name) {
  const found = SHELVES[name];
  if (!found) throw new Error(`No inventory shelf called "${name}".`);
  return found;
}
