/**
 * Volumes and doses are always stored metric (litres, and grams/millilitres per
 * litre). The user's metric/imperial preference only changes how they're shown
 * and how typed input is interpreted, so the database stays consistent across
 * devices and preference changes.
 */

const LITERS_PER_GALLON = 3.785411784;
const CM_PER_INCH = 2.54;

export function volumeUnit(system) {
  return system === 'imperial' ? 'gal' : 'L';
}

export function lengthUnit(system) {
  return system === 'imperial' ? 'in' : 'cm';
}

export function doseUnit(form, system) {
  const mass = form === 'solid' ? 'g' : 'ml';
  return `${mass}/${system === 'imperial' ? 'gal' : 'L'}`;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Litres -> the unit the user reads, as a display string ('' when unset). */
export function formatVolume(liters, system, { withUnit = true } = {}) {
  if (liters === null || liters === undefined || liters === '') return '';
  const value =
    system === 'imperial' ? round(Number(liters) / LITERS_PER_GALLON, 2) : round(Number(liters), 2);
  return withUnit ? `${value} ${volumeUnit(system)}` : String(value);
}

/** What the user typed -> litres for storage. Returns null for blank input. */
export function parseVolume(input, system) {
  if (input === null || input === undefined || String(input).trim() === '') return null;
  const value = Number(String(input).replace(',', '.'));
  if (Number.isNaN(value)) return null;
  return system === 'imperial' ? value * LITERS_PER_GALLON : value;
}

/** Centimetres -> the unit the user reads, as a display string ('' when unset). */
export function formatLength(cm, system, { withUnit = false } = {}) {
  if (cm === null || cm === undefined || cm === '') return '';
  const value =
    system === 'imperial' ? round(Number(cm) / CM_PER_INCH, 1) : round(Number(cm), 1);
  return withUnit ? `${value} ${lengthUnit(system)}` : String(value);
}

/** What the user typed -> centimetres for storage. Returns null for blank input. */
export function parseLength(input, system) {
  if (input === null || input === undefined || String(input).trim() === '') return null;
  const value = Number(String(input).replace(',', '.'));
  if (Number.isNaN(value)) return null;
  return system === 'imperial' ? value * CM_PER_INCH : value;
}

/** Dose per litre -> the unit the user reads. */
export function formatDose(perLiter, system, { withUnit = false, form } = {}) {
  if (perLiter === null || perLiter === undefined || perLiter === '') return '';
  const value =
    system === 'imperial'
      ? round(Number(perLiter) * LITERS_PER_GALLON, 2)
      : round(Number(perLiter), 2);
  return withUnit ? `${value} ${doseUnit(form, system)}` : String(value);
}

/** What the user typed -> dose per litre for storage. */
export function parseDose(input, system) {
  if (input === null || input === undefined || String(input).trim() === '') return null;
  const value = Number(String(input).replace(',', '.'));
  if (Number.isNaN(value)) return null;
  return system === 'imperial' ? value / LITERS_PER_GALLON : value;
}

/** Renders a stored min/max pair as "2 - 3 ml/L", collapsing when only one is set. */
export function formatDoseRange(min, max, system, form) {
  const lo = formatDose(min, system);
  const hi = formatDose(max, system);
  const unit = doseUnit(form, system);
  if (lo && hi) return lo === hi ? `${lo} ${unit}` : `${lo} - ${hi} ${unit}`;
  if (lo) return `${lo} ${unit}`;
  if (hi) return `${hi} ${unit}`;
  return null;
}
