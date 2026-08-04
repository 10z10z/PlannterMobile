import { supabase } from './supabase';

export const CONTAINER_MATERIALS = [
  { value: 'plastic', label: 'Plastic' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'terracotta', label: 'Terracotta' },
];

export function materialLabel(material) {
  return CONTAINER_MATERIALS.find((entry) => entry.value === material)?.label ?? 'Plastic';
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
