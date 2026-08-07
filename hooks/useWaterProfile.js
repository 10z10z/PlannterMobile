import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseDecimalOrZero } from '../lib/numbers';
import { waterContribution, waterFromReport } from '../lib/nutrients';

/**
 * What is in the tap before anything is poured into it.
 *
 * A property of where the grower lives rather than of any one mix, so it is
 * stored and read back rather than asked for each time the calculator opens.
 *
 * Two ways of knowing it are kept side by side: a hardness reading, which gets
 * split into calcium and magnesium by the conventional ratio, and a water
 * report naming the two outright. Both sets of figures are held whichever is in
 * play, so switching between them doesn't lose the one being left behind.
 */

const KEYS = {
  source: 'waterSource',
  hardness: 'waterHardnessPpm',
  ca: 'waterCaPpm',
  mg: 'waterMgPpm',
};

export default function useWaterProfile() {
  const [source, setSource] = useState('hardness'); // 'hardness' | 'report'
  const [hardnessText, setHardnessText] = useState('');
  const [caText, setCaText] = useState('');
  const [mgText, setMgText] = useState('');

  useEffect(() => {
    AsyncStorage.multiGet(Object.values(KEYS)).then((pairs) => {
      const stored = Object.fromEntries(pairs);
      if (stored[KEYS.source] === 'report') setSource('report');
      if (stored[KEYS.hardness]) setHardnessText(stored[KEYS.hardness]);
      if (stored[KEYS.ca]) setCaText(stored[KEYS.ca]);
      if (stored[KEYS.mg]) setMgText(stored[KEYS.mg]);
    });
  }, []);

  const save = useCallback(
    () =>
      AsyncStorage.multiSet([
        [KEYS.source, source],
        [KEYS.hardness, hardnessText],
        [KEYS.ca, caText],
        [KEYS.mg, mgText],
      ]),
    [source, hardnessText, caText, mgText]
  );

  const hardness = parseDecimalOrZero(hardnessText);

  // Memoised because it is an object, and the mix downstream is keyed on it:
  // rebuilding it every render would recompute every ppm figure every render.
  const water = useMemo(
    () =>
      source === 'report'
        ? waterFromReport(parseDecimalOrZero(caText), parseDecimalOrZero(mgText))
        : waterContribution(hardness),
    [source, caText, mgText, hardness]
  );

  return {
    water,
    hardness,
    source,
    setSource,
    hardnessText,
    setHardnessText,
    caText,
    setCaText,
    mgText,
    setMgText,
    save,
  };
}
