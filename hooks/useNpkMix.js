import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInventory } from './useInventory';
import { parseDecimalOrZero } from '../lib/numbers';
import { formatDose, parseDose, parseVolume } from '../lib/units';
import {
  MACRO_KEYS,
  macroBars,
  microBars,
  mixParts,
  perLiterDose,
  ppmFromMix,
  suggestedDose,
} from '../lib/nutrients';

/**
 * The mix the calculator is working on, and everything that follows from it.
 *
 * Two ways round the same sum share this state, which is why they share a
 * screen: "target" dials a dose per litre straight in, "reverse" takes what was
 * actually poured into a tank of a known size and divides it back out. Both
 * arrive at a dose per litre, and from there the sum is the same — so the mode
 * decides only where `dosePerLiter` comes from, and every figure below it is
 * built once.
 *
 * Doses and poured amounts are held separately rather than converted between,
 * so switching modes to check a figure and switching back doesn't quietly
 * rewrite what was typed in the other one.
 *
 * @param {object} params
 * @param {string} params.system The unit system doses are typed in.
 * @param {{ ca: number, mg: number }|null} params.water Already in the tank.
 */
export default function useNpkMix({ system, water }) {
  const shelf = useInventory('fertilizers');
  const fertilizers = useMemo(() => shelf.data ?? [], [shelf.data]);

  const [selectedIds, setSelectedIds] = useState([]);
  // Held in the unit the user reads; the maths converts to per litre.
  const [doses, setDoses] = useState({});
  const [amounts, setAmounts] = useState({});

  const [mode, setMode] = useState('target'); // 'target' | 'reverse'
  const [stage, setStage] = useState('vegetative');
  const [volumeText, setVolumeText] = useState('4');

  /**
   * Keeps the selection valid across edits and deletions made in Inventory.
   *
   * The shelf is shared cache rather than this screen's own fetch, so a product
   * deleted from the inventory tab lands here without the calculator asking —
   * which is the point, but it does mean a mix can be left pointing at a bottle
   * that no longer exists.
   */
  useEffect(() => {
    if (!shelf.data) return;
    const ids = new Set(shelf.data.map((fertilizer) => fertilizer.id));
    setSelectedIds((current) => {
      const kept = current.filter((id) => ids.has(id));
      if (kept.length) return kept;
      return shelf.data[0] ? [shelf.data[0].id] : [];
    });
  }, [shelf.data]);

  const selected = useMemo(
    () => selectedIds.map((id) => fertilizers.find((f) => f.id === id)).filter(Boolean),
    [selectedIds, fertilizers]
  );

  /** The stage's suggested dose, in display units, for a newly added product. */
  const defaultDose = useCallback(
    (fertilizer) => {
      const perLiter = suggestedDose(fertilizer, stage);
      if (perLiter === null) return 1;
      return parseDecimalOrZero(formatDose(perLiter, system));
    },
    [stage, system]
  );

  const toggleFertilizer = (fertilizer) => {
    const isSelected = selectedIds.includes(fertilizer.id);
    setSelectedIds(
      isSelected
        ? selectedIds.filter((id) => id !== fertilizer.id)
        : [...selectedIds, fertilizer.id]
    );
    if (!isSelected && doses[fertilizer.id] === undefined) {
      setDoses({ ...doses, [fertilizer.id]: defaultDose(fertilizer) });
    }
  };

  const setDose = (id, value) => setDoses((current) => ({ ...current, [id]: value }));
  const setAmount = (id, value) => setAmounts((current) => ({ ...current, [id]: value }));

  const batchVolumeLiters = parseVolume(volumeText, system) ?? 0;

  const mixEntries = useMemo(
    () =>
      selected.map((fertilizer) => ({
        fertilizer,
        dosePerLiter:
          mode === 'target'
            ? (parseDose(String(doses[fertilizer.id] ?? 0), system) ?? 0)
            : perLiterDose(parseDecimalOrZero(amounts[fertilizer.id]), batchVolumeLiters),
      })),
    [selected, doses, amounts, mode, system, batchVolumeLiters]
  );

  const result = useMemo(() => ppmFromMix(mixEntries, water), [mixEntries, water]);
  const parts = useMemo(() => mixParts(mixEntries, water), [mixEntries, water]);
  const bars = useMemo(() => macroBars(result, stage, parts), [result, stage, parts]);
  const micros = useMemo(() => microBars(result, parts), [result, parts]);

  const contribution = useMemo(
    () => Object.fromEntries(parts.map((part) => [part.id, part.result])),
    [parts]
  );

  const hasMacros = selected.some((f) => MACRO_KEYS.some((key) => Number(f?.[key]) > 0));

  return {
    shelf,
    fertilizers,
    selected,
    selectedIds,
    toggleFertilizer,

    mode,
    setMode,
    stage,
    setStage,

    doses,
    setDose,
    defaultDose,
    amounts,
    setAmount,
    volumeText,
    setVolumeText,
    batchVolumeLiters,

    // The mix as the maths sees it: one entry per product at its dose per
    // litre, whichever mode arrived at it. What a feeding is recorded from.
    entries: mixEntries,
    result,
    parts,
    bars,
    micros,
    contribution,
    hasMacros,
  };
}
