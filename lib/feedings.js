import { supabase } from './supabase';
import { requireUserId } from './session';
import { toDateString } from './dates';
import { countLabel, recordEvent } from './activity';
import { formatDose, formatVolume } from './units';

/**
 * What was fed, to what, and at what rate.
 *
 * A feed is rarely one bottle, so the mix is a list of products at their own
 * per-litre doses — the same figures the NPK calculator works in, which is what
 * lets a mixture worked out there be handed straight over to be recorded. Names
 * are copied in with the doses so a feed still reads correctly after the
 * product behind it is edited or thrown away.
 *
 * A feed goes either to a whole growspace or station, which is how most people
 * fertigate, or to particular plants when only some of them got it. The plant
 * list being empty is what "everything in here" means.
 */

/** "CalMag 2 ml/L · Grow A 1.5 ml/L" — the mix on one line. */
export function mixSummary(products, system) {
  return (products ?? [])
    .map(
      (product) =>
        `${product.fertilizer_name} ${formatDose(product.dose_per_liter, system, {
          withUnit: true,
          form: product.form,
        })}`
    )
    .join(' · ');
}

/**
 * Who got it: the plants by name when a few were picked, or the space itself
 * when the whole thing was fed.
 */
export function targetSummary(plants, placeName) {
  const named = plants ?? [];
  if (!named.length) return placeName ? `All of ${placeName}` : 'The whole space';
  if (named.length <= 3) return named.map((plant) => plant.plant_name).join(', ');
  return countLabel(named.length, 'plant');
}

/** The line the calendar shows under a feeding: the mix, then the batch size. */
export function feedingDetail(feeding, system) {
  return [
    mixSummary(feeding?.products, system),
    feeding?.volume_liters ? `in ${formatVolume(feeding.volume_liters, system)}` : null,
    feeding?.note?.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Records a feed and its calendar entry.
 *
 * PostgREST has no transactions, so the feeding is rolled back by hand if its
 * mix fails to save — a feed with no products recorded says less than nothing,
 * since it looks like plain water was poured.
 */
export async function recordFeeding({
  // Optional, like everywhere else in the data layer: a caller that already has
  // the id can save the lookup, and a dialog that doesn't need not care.
  userId = null,
  fedOn,
  growspaceId = null,
  stationId = null,
  volumeLiters = null,
  note = null,
  products,
  plants = [],
  placeName = null,
  system = 'metric',
}) {
  if (!products?.length) throw new Error('Pick at least one fertilizer');

  const owner = userId ?? (await requireUserId());

  const { data: feeding, error } = await supabase
    .from('feedings')
    .insert({
      user_id: owner,
      fed_on: fedOn ?? toDateString(new Date()),
      growspace_id: growspaceId,
      station_id: stationId,
      volume_liters: volumeLiters,
      note: note?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: productsError } = await supabase.from('feeding_products').insert(
    products.map((product) => ({
      user_id: owner,
      feeding_id: feeding.id,
      fertilizer_id: product.fertilizer_id ?? null,
      fertilizer_name: product.fertilizer_name,
      form: product.form ?? 'liquid',
      dose_per_liter: product.dose_per_liter,
    }))
  );
  if (productsError) {
    await supabase.from('feedings').delete().eq('id', feeding.id);
    throw productsError;
  }

  if (plants.length) {
    await supabase.from('feeding_plants').insert(
      plants.map((plant) => ({
        user_id: owner,
        feeding_id: feeding.id,
        plant_id: plant.plant_id ?? plant.id ?? null,
        plant_name: plant.plant_name ?? plant.name,
      }))
    );
  }

  const full = { ...feeding, products, plants };
  await recordEvent({
    userId: owner,
    kind: 'fed',
    subject: targetSummary(plants, placeName),
    detail: feedingDetail(full, system),
    occurredOn: feeding.fed_on,
    growspaceId,
    stationId,
    // A feed to one plant is that plant's history too, so the entry points at it
    // and a feed spread over several points at none of them in particular.
    plantId: plants.length === 1 ? (plants[0].plant_id ?? plants[0].id ?? null) : null,
    feedingId: feeding.id,
  });

  return full;
}

/** One feed with its mix and its targets, for showing what was actually given. */
export async function fetchFeeding(feedingId) {
  const [{ data: feeding, error }, { data: products }, { data: plants }] = await Promise.all([
    supabase
      .from('feedings')
      .select('*, growspace:growspaces(name), station:germination_stations(name)')
      .eq('id', feedingId)
      .single(),
    supabase.from('feeding_products').select('*').eq('feeding_id', feedingId),
    supabase.from('feeding_plants').select('*').eq('feeding_id', feedingId),
  ]);
  if (error) throw error;

  return { ...feeding, products: products ?? [], plants: plants ?? [] };
}

/** Removes a feed. Its calendar entry goes with it, by cascade. */
export async function deleteFeeding(feedingId) {
  const { error } = await supabase.from('feedings').delete().eq('id', feedingId);
  if (error) throw error;
}
