import { useCallback, useRef, useState } from 'react';
import { validate, validateField } from '../lib/validation';

/**
 * Holds a dialog's fields, checks them against a schema, and says which ones
 * are wrong.
 *
 * When errors appear is as much of a decision as what counts as an error, and
 * the three obvious answers are all wrong on their own. Checking on every
 * keystroke tells someone their name is required while they are still typing
 * the first letter of it. Checking only on save is what the app did before, and
 * meant a scrolling form reported one problem at a time from the bottom.
 * Disabling save until the form is valid leaves a new dialog with a dead button
 * and nothing on screen explaining it.
 *
 * So: a field is checked when it's left, which is the moment the user has
 * finished with it. Pressing save checks everything at once and shows all of
 * it. After that first press the button does disable while anything is still
 * wrong — by then every reason is on screen — and comes back the moment the
 * last one is fixed, since a field already showing an error is re-checked as
 * it's edited rather than waiting to be left again.
 *
 * @param {import('../lib/validation').Schema} schema
 * @param {{ checks?: import('../lib/validation').Check[] }} [options]
 */
export default function useForm(schema, { checks = [] } = {}) {
  const [values, setValuesState] = useState(/** @type {Record<string, any>} */ ({}));
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  // Until save has been pressed once, a field that is merely still empty is not
  // yet a mistake, and the button stays live.
  const [attempted, setAttempted] = useState(false);

  // What's in the fields right now. Blur and submit need to read that at the
  // moment they run rather than at the moment they were last rendered, and
  // reading it out of a state updater would mean doing work inside one.
  const valuesRef = useRef(values);

  // Schemas are rebuilt on every render, since they close over the unit system.
  // Reading them through a ref keeps the callbacks below from changing identity
  // on every keystroke.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;
  const checksRef = useRef(checks);
  checksRef.current = checks;

  const setValues = useCallback((next) => {
    valuesRef.current = next;
    setValuesState(next);
  }, []);

  /** The message for one field, folded into the rest. */
  const applyFieldError = useCallback((name, message) => {
    setErrors((current) => {
      if (message === (current[name] ?? '')) return current;
      const next = { ...current };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }, []);

  /** Fill the form in — from a record being edited, or with blanks for a new one. */
  const reset = useCallback(
    (next = {}) => {
      setValues(next);
      setErrors({});
      setAttempted(false);
    },
    [setValues]
  );

  const set = useCallback(
    (name, value) => {
      setValues({ ...valuesRef.current, [name]: value });
      // Only a field already showing a problem is re-checked as it's typed
      // into; the rest wait until they're left.
      if (errors[name]) applyFieldError(name, validateField(schemaRef.current, name, value));
    },
    [errors, applyFieldError, setValues]
  );

  const blur = useCallback(
    (name) => {
      applyFieldError(name, validateField(schemaRef.current, name, valuesRef.current[name]));
    },
    [applyFieldError]
  );

  /**
   * Everything a text field needs to render itself and its own error.
   *
   * @param {string} name
   */
  const field = useCallback(
    (name) => ({
      value: values[name] ?? '',
      onChangeText: (/** @type {string} */ next) => set(name, next),
      onBlur: () => blur(name),
      error: errors[name] ?? '',
    }),
    [values, errors, set, blur]
  );

  /**
   * Check the lot. On success the cleaned, converted values are handed over; on
   * failure every message goes on screen at once.
   *
   * Checks can be given here instead of up front, for the ones that compare a
   * field against something picked while the dialog is open — a seed count
   * against the pack it's coming out of, say. Those close over rows the form
   * doesn't hold, so they can't be built before it exists.
   *
   * @param {(values: Record<string, any>) => void} onValid
   * @param {import('../lib/validation').Check[]} [checksNow]
   * @returns {boolean} Whether the form was valid.
   */
  const submit = useCallback((onValid, checksNow) => {
    setAttempted(true);
    const outcome = validate(schemaRef.current, valuesRef.current, {
      checks: checksNow ?? checksRef.current,
    });
    setErrors(outcome.errors);
    if (outcome.ok) onValid(outcome.values);
    return outcome.ok;
  }, []);

  return {
    values,
    errors,
    set,
    reset,
    field,
    submit,
    attempted,
    /** False only once save has been pressed and something is still wrong. */
    canSubmit: !attempted || Object.keys(errors).length === 0,
  };
}
