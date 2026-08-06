/**
 * Checking the grids a growspace is made of.
 *
 * These aren't form fields — they're rows in a list that can be added to and
 * removed, each with its own name, rows and columns — so they can't carry their
 * message under an input the way everything else does. What comes back is one
 * sentence naming the grid at fault, shown beneath the list.
 */

import { gridSchema, gridSizeCheck } from './schemas';
import { validate } from './validation';

/**
 * The first thing wrong with a list of grids, or '' if there's nothing.
 *
 * A growspace with no grids at all is allowed: it's a space whose plants are
 * all still in the holding tray, which is where a space starts.
 *
 * @param {{ name?: string, grid_rows?: number|string, grid_cols?: number|string }[]} grids
 * @returns {string}
 */
export function gridProblem(grids) {
  for (const grid of grids ?? []) {
    const result = validate(
      gridSchema,
      { name: grid.name, grid_rows: grid.grid_rows, grid_cols: grid.grid_cols },
      { checks: [gridSizeCheck()] }
    );
    if (result.ok) continue;

    const [message] = Object.values(result.errors);
    const named = String(grid.name ?? '').trim();
    return named ? `${named}: ${lowerFirst(message)}` : message;
  }
  return '';
}

/**
 * @param {{ name?: string, grid_rows?: number|string, grid_cols?: number|string }[]} grids
 */
export function gridsAreValid(grids) {
  return gridProblem(grids) === '';
}

/**
 * "Rows must be..." reads wrong after a grid's name; "Main: rows must be..."
 * reads like a sentence.
 *
 * @param {string} message
 */
function lowerFirst(message) {
  return message.charAt(0).toLowerCase() + message.slice(1);
}
