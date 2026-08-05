import { supabase } from './supabase';
import { formatVolume } from './units';

export const CONTAINER_MATERIALS = [
  { value: 'plastic', label: 'Plastic' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'terracotta', label: 'Terracotta' },
];

export function materialLabel(material) {
  return CONTAINER_MATERIALS.find((entry) => entry.value === material)?.label ?? 'Plastic';
}

/**
 * "11 L Fabric" — a container named the way a grower would say it. Null when the
 * plant isn't in one, or when the container it pointed at has been deleted.
 */
export function containerLabel(container, system) {
  if (!container) return null;
  return `${formatVolume(container.volume_liters, system)} ${materialLabel(container.material)}`;
}

/** Just the size, for the places too small to carry the material as well. */
export function containerSize(container, system) {
  if (!container) return null;
  return formatVolume(container.volume_liters, system);
}

/**
 * Containers plus how many plants are currently assigned to each group. The count
 * is derived rather than stored so it can't drift out of sync with the plants.
 */
export async function fetchContainersWithUsage() {
  const [{ data: containers, error }, { data: assigned }] = await Promise.all([
    supabase.from('containers').select('*').order('volume_liters', { ascending: true }),
    supabase.from('plants').select('container_id').not('container_id', 'is', null),
  ]);

  if (error) throw error;

  const usage = new Map();
  for (const plant of assigned ?? []) {
    usage.set(plant.container_id, (usage.get(plant.container_id) ?? 0) + 1);
  }

  return (containers ?? []).map((container) => ({
    ...container,
    inUse: usage.get(container.id) ?? 0,
  }));
}
