/**
 * Form validation.
 *
 * Every dialog used to check its own fields inline and report the first thing
 * that failed into a single line at the bottom of a scrolling form — so the
 * message was usually off-screen, and fixing it revealed the next one. This
 * replaces that with schemas: a field says what it is once, and both the
 * checking and the conversion to what the database stores come out of the same
 * description.
 *
 * A schema is a plain object of field name -> rule, and a rule is a function
 * from what's in the text field to `{ value }` or `{ error }`. That keeps rules
 * ordinary functions — testable on their own, composable, and readable without
 * knowing anything about this module.
 *
 * Two things are deliberately separate. Blank is not invalid: a rule that isn't
 * `required` turns an empty field into `null`, which is what an optional column
 * holds. And the range a field is checked against is expressed in the unit the
 * user is typing in, not the unit the value is stored in, so the message can
 * quote the numbers they can see — `transform` converts afterwards.
 */

import { parseDecimal, parseWhole } from './numbers';

/**
 * @typedef {{ value?: any, error?: string }} RuleOutcome
 * @typedef {(raw: any) => RuleOutcome} Rule
 * @typedef {Record<string, Rule>} Schema
 * @typedef {(values: Record<string, any>) => { field: string, message: string }|null} Check
 */

/** Caps that apply wherever the same kind of text is entered. */
export const LIMITS = {
  /** Long enough for "Cherokee Purple (saved seed, 2024)", short enough to render in a chip. */
  NAME: 80,
  DESCRIPTION: 500,
  NOTE: 2000,
  /**
   * A grid is rendered cell by cell, so its size is a rendering budget rather
   * than a matter of taste: the 999 x 999 a bare `parseInt` accepts today is a
   * million views and locks the app.
   *
   * The cap on cells is what actually protects rendering; the cap per side only
   * keeps a single row from being absurd. 500 clears the largest plug tray sold
   * — a 288-cell 1020 is 24 x 12 — with room over.
   */
  GRID_SIDE: 50,
  GRID_CELLS: 500,
  /** Nothing in a home grow is a five-figure count of pots, trays or fixtures. */
  QUANTITY: 9999,
  /** Seeds are the exception: bulk lettuce and carrot come by the thousand. */
  SEED_COUNT: 100000,
};

/**
 * Runs a whole schema and reports everything that's wrong, not the first thing.
 *
 * Cross-field checks — a seed count against the pack it's coming out of, a
 * minimum dose against its maximum — run only once every field has parsed,
 * because a check comparing two numbers can't say anything useful when one of
 * them is the word "abc".
 *
 * @param {Schema} schema
 * @param {Record<string, any>} raw What the fields currently hold.
 * @param {{ checks?: Check[] }} [options]
 * @returns {{ ok: boolean, errors: Record<string, string>, values: Record<string, any> }}
 */
export function validate(schema, raw, { checks = [] } = {}) {
  /** @type {Record<string, string>} */
  const errors = {};
  /** @type {Record<string, any>} */
  const values = {};

  for (const [field, rule] of Object.entries(schema)) {
    const outcome = rule(raw?.[field]);
    if (outcome.error) errors[field] = outcome.error;
    else values[field] = outcome.value;
  }

  if (Object.keys(errors).length === 0) {
    for (const check of checks) {
      const failure = check(values);
      // First failure per field wins, so one bad number doesn't collect three
      // messages that all say the same thing.
      if (failure && !errors[failure.field]) errors[failure.field] = failure.message;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, values };
}

/**
 * One field on its own, for validating as it's left rather than on save.
 *
 * @param {Schema} schema
 * @param {string} field
 * @param {any} raw
 * @returns {string} The message, or '' when the field is fine.
 */
export function validateField(schema, field, raw) {
  const rule = schema[field];
  if (!rule) return '';
  return rule(raw).error ?? '';
}

/**
 * Text: trimmed, capped, and blank only if it's allowed to be.
 *
 * The trimmed value is what comes back, so a name saved as " Basil " is stored
 * as "Basil" and the cap counts characters the user can actually see.
 *
 * @param {{ label: string, required?: boolean, max?: number, min?: number }} options
 * @returns {Rule}
 */
export function text({ label, required = false, max = LIMITS.NAME, min = 0 }) {
  return (raw) => {
    const value = String(raw ?? '').trim();
    if (!value) {
      if (required) return { error: `${label} is required` };
      return { value: null };
    }
    if (min && value.length < min) {
      return { error: `${label} must be at least ${min} characters` };
    }
    if (value.length > max) {
      return { error: `${label} must be ${max} characters or fewer` };
    }
    return { value };
  };
}

/**
 * A number that may have a fractional part — a dose, a temperature, a reading.
 *
 * `min` and `max` are in whatever unit the field is labelled with, so the
 * message quotes numbers the user recognises. `transform` runs after the check
 * and converts to what the column holds.
 *
 * @param {{
 *   label: string,
 *   required?: boolean,
 *   min?: number,
 *   max?: number,
 *   unit?: string,
 *   transform?: (value: number) => number,
 * }} options
 * @returns {Rule}
 */
export function decimal({ label, required = false, min, max, unit = '', transform }) {
  return numeric({ label, required, min, max, unit, transform, parse: parseDecimal });
}

/**
 * A number that only makes sense whole — rows, columns, a count of seeds.
 *
 * @param {{
 *   label: string,
 *   required?: boolean,
 *   min?: number,
 *   max?: number,
 *   unit?: string,
 *   transform?: (value: number) => number,
 * }} options
 * @returns {Rule}
 */
export function whole({ label, required = false, min, max, unit = '', transform }) {
  return numeric({
    label,
    required,
    min,
    max,
    unit,
    transform,
    parse: parseWhole,
    notANumber: `${label} must be a whole number`,
  });
}

/**
 * One of a fixed set — an environment, a phase, a unit of measure.
 *
 * These come from segmented buttons and menus rather than typing, so a bad
 * value means the form is wired wrong rather than that the user erred; the
 * message is plain rather than helpful because nobody should ever see it.
 *
 * @param {{ label: string, options: readonly any[], required?: boolean }} config
 * @returns {Rule}
 */
export function choice({ label, options, required = true }) {
  const allowed = options.map((option) =>
    option && option.value !== undefined ? option.value : option
  );
  return (raw) => {
    if (raw === null || raw === undefined || raw === '') {
      return required ? { error: `${label} is required` } : { value: null };
    }
    if (!allowed.includes(raw)) return { error: `${label} is not one of the choices` };
    return { value: raw };
  };
}

// Deliberately loose. The grammar of a real address allows more than anyone
// expects, and the only test that settles it is sending mail there — so this
// catches the slips (no @, a space, a comma left on from pasting out of a list)
// and leaves the rest to the confirmation email. The last label has to be
// letters, which is what rejects the trailing comma and the trailing dot.
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[a-z]{2,}$/i;

/**
 * An email address, trimmed and lower-cased.
 *
 * A phone keyboard adds a trailing space more often than not, and an address
 * typed with a capital first letter is the same account as one without —
 * storing both spellings is how one person ends up with two accounts.
 *
 * @param {{ label?: string, required?: boolean }} [options]
 * @returns {Rule}
 */
export function email({ label = 'Email', required = true } = {}) {
  return (raw) => {
    const value = String(raw ?? '').trim();
    if (!value) {
      return required ? { error: `${label} is required` } : { value: null };
    }
    // The limit on an address in the mail standards, and past it nothing will
    // deliver anyway.
    if (value.length > 254 || !EMAIL.test(value)) {
      return { error: 'That doesn’t look like an email address' };
    }
    return { value: value.toLowerCase() };
  };
}

/**
 * A password.
 *
 * Unlike every other text rule this one does not trim, because a space is a
 * character a password may legitimately begin or end with, and quietly removing
 * it locks someone out of the account they just made.
 *
 * @param {{ label?: string, min?: number, max?: number }} [options]
 * @returns {Rule}
 */
export function secret({ label = 'Password', min = 0, max = 72 } = {}) {
  return (raw) => {
    const value = String(raw ?? '');
    if (!value) return { error: `${label} is required` };
    if (value.length < min) {
      return { error: `${label} must be at least ${min} characters` };
    }
    // bcrypt, which is what sits behind the auth service, ignores anything past
    // 72 bytes — so a longer one is not the password the user thinks it is.
    if (value.length > max) {
      return { error: `${label} must be ${max} characters or fewer` };
    }
    return { value };
  };
}

/**
 * A set of things picked from a list — fertilizers in a mix, the plants that
 * were fed.
 *
 * `message` is there because the natural wording for these is an instruction
 * rather than a complaint: "Pick at least one fertilizer" says what to do,
 * where "Fertilizers needs at least 1" only says what happened.
 *
 * @param {{ label: string, min?: number, message?: string }} options
 * @returns {Rule}
 */
export function list({ label, min = 0, message }) {
  return (raw) => {
    const value = Array.isArray(raw) ? raw : [];
    if (value.length < min) {
      return { error: message ?? `${label} needs at least ${min}` };
    }
    return { value };
  };
}

/**
 * A value the form holds but doesn't check — an image URL, a picked id, a date
 * chosen from a picker. Named rather than left out of the schema so that
 * `validate` returns the whole record ready to save.
 *
 * @param {{ required?: boolean, label?: string }} [options]
 * @returns {Rule}
 */
export function passthrough({ required = false, label = 'This' } = {}) {
  return (raw) => {
    if (required && (raw === null || raw === undefined || raw === '')) {
      return { error: `${label} is required` };
    }
    return { value: raw ?? null };
  };
}

/**
 * The shared body of `decimal` and `whole`.
 *
 * @param {{
 *   label: string,
 *   required: boolean,
 *   min?: number,
 *   max?: number,
 *   unit: string,
 *   transform?: (value: number) => number,
 *   parse: (raw: any) => number|null,
 *   notANumber?: string,
 * }} config
 * @returns {Rule}
 */
function numeric({ label, required, min, max, unit, transform, parse, notANumber }) {
  return (raw) => {
    const parsed = parse(raw);

    if (parsed === null) {
      if (required) return { error: `${label} is required` };
      return { value: null };
    }
    if (Number.isNaN(parsed)) {
      return { error: notANumber ?? `${label} must be a number` };
    }

    const range = rangeError(label, parsed, min, max, unit);
    if (range) return { error: range };

    return { value: transform ? transform(parsed) : parsed };
  };
}

/**
 * The wording for a number outside its limits.
 *
 * A field with both ends set reads better as one sentence than as whichever
 * half failed, so "between 0 and 100%" rather than "must be at most 100%".
 *
 * @param {string} label
 * @param {number} value
 * @param {number|undefined} min
 * @param {number|undefined} max
 * @param {string} unit
 * @returns {string} The message, or '' when the value is within range.
 */
function rangeError(label, value, min, max, unit) {
  const hasMin = min !== undefined && min !== null;
  const hasMax = max !== undefined && max !== null;
  const within = (!hasMin || value >= min) && (!hasMax || value <= max);
  if (within) return '';

  if (hasMin && hasMax) return `${label} must be between ${min} and ${max}${unit}`;
  if (hasMin) return `${label} must be at least ${min}${unit}`;
  return `${label} must be at most ${max}${unit}`;
}
