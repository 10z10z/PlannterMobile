import { supabase } from './supabase';

/** "4 x 6 · 24 cells" — the shorthand used on cards and in pickers. */
export function trayGridLabel(tray) {
  return `${tray.grid_rows} x ${tray.grid_cols} · ${cellCount(tray)} cells`;
}

export function cellCount(tray) {
  return tray.grid_rows * tray.grid_cols;
}

/**
 * Trays plus how many of each group currently hold a sowing. Derived from the
 * sowings themselves rather than stored, exactly as container usage is derived
 * from plants.
 */
export async function fetchTraysWithUsage() {
  const [{ data: trays, error }, { data: sown }] = await Promise.all([
    supabase.from('trays').select('*').order('created_at', { ascending: false }),
    supabase.from('sowings').select('tray_id').not('tray_id', 'is', null),
  ]);

  if (error) throw error;

  const usage = new Map();
  for (const sowing of sown ?? []) {
    usage.set(sowing.tray_id, (usage.get(sowing.tray_id) ?? 0) + 1);
  }

  return (trays ?? []).map((tray) => ({
    ...tray,
    inUse: usage.get(tray.id) ?? 0,
  }));
}
