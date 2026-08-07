import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseDecimalOrZero } from '../lib/numbers';
import {
  DEFAULT_EC_SCALE,
  DEFAULT_NUTRIENT_PPM_PER_EC,
  EC_SCALES,
  calibrationFactor,
  ecFromMeterPpm,
  estimateEc,
  meterPpmFor,
} from '../lib/nutrients';

/**
 * The grower's TDS meter, and what it has taught the calculator.
 *
 * Two separate things are stored here and they are easy to confuse. The
 * *scale* belongs to the meter: it is the constant the device multiplies its
 * conductivity reading by before showing a ppm, and it is a published spec
 * rather than anything to be worked out. The *factor* belongs to the
 * fertilizers: it is how much nutrient this grower's bottles put in the water
 * per unit of conductivity, and it can only be measured.
 *
 * Both outlive any one mix, so both are stored. The reading a calibration is
 * derived from is not: it describes the batch on screen and means nothing once
 * that batch is gone.
 *
 * @param {object} params
 * @param {number} params.nutrientPpm What the mix on screen works out at, which
 *   is the other half of any calibration made from it.
 */

const KEYS = {
  scale: 'meterScale',
  perEc: 'nutrientPpmPerEc',
};

/** The scale values that get their own button; anything else is typed in. */
export const PRESET_SCALES = EC_SCALES.map((scale) => scale.value);

export default function useMeterCalibration({ nutrientPpm }) {
  const [scaleText, setScaleText] = useState(String(DEFAULT_EC_SCALE));
  const [perEcText, setPerEcText] = useState(String(DEFAULT_NUTRIENT_PPM_PER_EC));
  /**
   * Whether the scale is being typed rather than picked. Held rather than
   * derived from the value: a custom field cleared back to empty falls through
   * to the default, which is itself a preset, and the field would close under
   * the fingers of the person emptying it.
   */
  const [custom, setCustom] = useState(false);

  const [readingText, setReadingText] = useState('');
  const [readingUnit, setReadingUnit] = useState('ppm'); // 'ppm' | 'ec'

  useEffect(() => {
    AsyncStorage.multiGet(Object.values(KEYS)).then((pairs) => {
      const stored = Object.fromEntries(pairs);
      if (stored[KEYS.scale]) {
        setScaleText(stored[KEYS.scale]);
        // A stored scale that isn't one of the buttons was typed in, so the
        // sheet reopens on the field it was typed into.
        setCustom(!PRESET_SCALES.includes(Number(stored[KEYS.scale])));
      }
      if (stored[KEYS.perEc]) setPerEcText(stored[KEYS.perEc]);
    });
  }, []);

  const save = useCallback(
    () =>
      AsyncStorage.multiSet([
        [KEYS.scale, scaleText],
        [KEYS.perEc, perEcText],
      ]),
    [scaleText, perEcText]
  );

  // A blank or half-typed field falls back to the defaults rather than to zero,
  // so the readout keeps working while the settings sheet is being filled in.
  const scale = parseDecimalOrZero(scaleText) || DEFAULT_EC_SCALE;
  const perEc = parseDecimalOrZero(perEcText) || DEFAULT_NUTRIENT_PPM_PER_EC;
  const isCalibrated = perEc !== DEFAULT_NUTRIENT_PPM_PER_EC;

  const estimatedEc = estimateEc(nutrientPpm, perEc);
  const expectedReading = meterPpmFor(estimatedEc, scale);

  /** The conductivity behind whatever was typed into the calibration field. */
  const measuredEc =
    readingUnit === 'ec'
      ? parseDecimalOrZero(readingText)
      : ecFromMeterPpm(parseDecimalOrZero(readingText), scale);
  const pendingFactor = calibrationFactor(nutrientPpm, measuredEc);

  /**
   * Take the reading as the truth and work backwards to what this grower's
   * bottles and meter actually do — which is the only figure here that isn't an
   * assumption about somebody else's fertilizer.
   */
  const calibrate = () => {
    if (pendingFactor === null) return;
    setPerEcText(String(pendingFactor));
    setReadingText('');
  };

  const reset = () => {
    setPerEcText(String(DEFAULT_NUTRIENT_PPM_PER_EC));
    setReadingText('');
  };

  /** Picking a preset sets the scale; picking "Other" keeps it to be edited. */
  const chooseScale = (value) => {
    setCustom(value === 'custom');
    if (value !== 'custom') setScaleText(value);
  };

  return {
    scale,
    scaleText,
    setScaleText,
    custom,
    chooseScale,

    perEc,
    isCalibrated,
    estimatedEc,
    expectedReading,

    readingText,
    setReadingText,
    readingUnit,
    setReadingUnit,
    pendingFactor,
    calibrate,
    reset,

    save,
  };
}
