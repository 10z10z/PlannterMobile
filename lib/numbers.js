/**
 * Reading numbers out of text fields.
 *
 * A phone's numeric keyboard gives whichever decimal separator the device
 * locale uses, so the same field receives `1.5` from one grower and `1,5` from
 * the next, and pasted values can arrive with the thousands separator still in
 * them. `Number()` alone handles none of that: it takes `1.5`, turns `1,5` into
 * `NaN`, and — worse — quietly accepts `0x10`, `1e3`, `Infinity` and an empty
 * string, the last of which becomes `0` rather than nothing.
 *
 * So parsing goes through here. The three outcomes a form needs are kept apart:
 * `null` means the field was left blank, `NaN` means what's in it isn't a
 * number, and anything else is the value. Blank and invalid are different
 * answers — one leaves a column null, the other has to stop the save — and
 * collapsing them is how a typo ends up stored as "no reading taken".
 */

// Group separators, not decimal ones. JavaScript's \s already covers the
// non-breaking space and the narrow one CLDR uses for French and Nordic
// locales; the apostrophe is Switzerland's.
const GROUP_SEPARATORS = /[\s']/g;

// Deliberately stricter than `Number()`. No exponents, no hex, no `Infinity`:
// in a field asking for humidity none of them are what anyone meant, and
// accepting them turns a slip into a stored reading.
const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * What the user typed -> a number, `null` when blank, `NaN` when it isn't one.
 *
 * Both separators can appear at once, and which is the decimal point depends on
 * the locale that produced the string: `1.234,5` and `1,234.5` are the same
 * number written by two people. Whichever comes last is the decimal separator,
 * which holds in every locale that uses both.
 *
 * A lone comma is read as a decimal point, so `1,234` is 1.234 rather than one
 * thousand. It's genuinely ambiguous, and this is the reading that suits the
 * app: the numbers typed here are doses, temperatures and percentages, where
 * three decimal places are ordinary and four figures are rare.
 *
 * @param {string|number|null|undefined} input
 * @returns {number|null} `null` for blank input, `NaN` for anything unparseable.
 */
export function parseDecimal(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? normalizeZero(input) : NaN;

  const trimmed = String(input).trim();
  if (trimmed === '') return null;

  const withoutGroups = trimmed.replace(GROUP_SEPARATORS, '');
  const lastComma = withoutGroups.lastIndexOf(',');
  const lastDot = withoutGroups.lastIndexOf('.');

  let normalized;
  if (lastComma === -1 && lastDot === -1) {
    normalized = withoutGroups;
  } else if (lastComma > lastDot) {
    // The comma is the decimal separator, so any dots were grouping.
    normalized = withoutGroups.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = withoutGroups.replace(/,/g, '');
  }

  // A second decimal separator survives the step above ("1.2.3"), and the
  // pattern is what rejects it.
  if (!NUMERIC.test(normalized)) return NaN;

  return normalizeZero(Number(normalized));
}

/**
 * The same, for fields that only make sense as whole numbers — rows, columns,
 * quantities, a count of seeds.
 *
 * `parseInt` is not used because it stops at the first character it doesn't
 * like: `parseInt('4 trays', 10)` is 4, and `parseInt('1,5', 10)` is 1, so a
 * grid silently loses half of what was typed. Here a fraction is `NaN` and the
 * form gets to say so.
 *
 * @param {string|number|null|undefined} input
 * @returns {number|null} `null` for blank input, `NaN` when it isn't a whole number.
 */
export function parseWhole(input) {
  const value = parseDecimal(input);
  if (value === null) return null;
  if (Number.isNaN(value)) return NaN;
  return Number.isInteger(value) ? value : NaN;
}

/**
 * True when the field holds something that isn't a number. Blank isn't — an
 * empty field is the business of whether it's required, not of parsing.
 *
 * @param {string|number|null|undefined} input
 */
export function isUnparseable(input) {
  return Number.isNaN(parseDecimal(input));
}

/**
 * `-0` back to `0`.
 *
 * Typing a lone minus and then a zero produces it, and it compares equal to `0`
 * everywhere except `Object.is`, so it passes every range check and then
 * renders as "-0" in the field it came from.
 *
 * @param {number} value
 */
function normalizeZero(value) {
  return value === 0 ? 0 : value;
}
