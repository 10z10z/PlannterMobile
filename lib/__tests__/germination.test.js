// Only the pure helpers are exercised here, but the module they live in also
// talks to Supabase and to notifications. Stubbing those keeps the suite in the
// node environment rather than dragging in the React Native runtime for maths.
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../notifications', () => ({ scheduleWateringReminder: jest.fn() }));
jest.mock('../../components/DateField', () => ({ toDateString: () => '2026-08-05' }));

import {
  daysSince,
  environmentLabel,
  germinatedCells,
  isSelectable,
  selectedCells,
  originalSeedsPerCell,
  otherStations,
  selectionSummary,
  thinnableCells,
  thinningSummary,
  toggleCellSelection,
} from '../germination';

/** A cell as `fetchSowings` lays it out, keyed by its position for readability. */
const cell = (id, germinated, planted = 3) => ({
  id,
  cell_row: 0,
  cell_col: 0,
  germinated,
  seeds_planted: planted,
});

/** A 2 x 2 tray: two cells up, one sown but dormant, one emptied out. */
const grid = [
  [cell('a', 2), cell('b', 0)],
  [cell('c', 1), cell('d', 0, 0)],
];

describe('germinatedCells', () => {
  it('keeps only the cells with something to move', () => {
    expect(germinatedCells(grid).map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('reads in grid order, which is the order a partial move drains', () => {
    const wide = [[cell('x', 1), cell('y', 1)], [cell('z', 1)]];
    expect(germinatedCells(wide).map((entry) => entry.id)).toEqual(['x', 'y', 'z']);
  });

  it('skips the holes a sparse grid leaves behind', () => {
    expect(germinatedCells([[null, cell('a', 1)]]).map((entry) => entry.id)).toEqual(['a']);
  });

  it('copes with no grid at all', () => {
    expect(germinatedCells(undefined)).toEqual([]);
    expect(germinatedCells([])).toEqual([]);
  });
});

describe('isSelectable', () => {
  it('accepts a cell with seedlings in it', () => {
    expect(isSelectable(cell('a', 1))).toBe(true);
  });

  it('rejects one that has not come up, one that was emptied, and a hole', () => {
    expect(isSelectable(cell('b', 0))).toBe(false);
    expect(isSelectable(cell('d', 0, 0))).toBe(false);
    expect(isSelectable(null)).toBe(false);
  });
});

describe('toggleCellSelection', () => {
  it('adds a cell that was not picked', () => {
    expect(toggleCellSelection(['a'], 'c')).toEqual(['a', 'c']);
  });

  it('removes one that was', () => {
    expect(toggleCellSelection(['a', 'c'], 'a')).toEqual(['c']);
  });

  it('starts a selection from nothing', () => {
    expect(toggleCellSelection([], 'a')).toEqual(['a']);
    expect(toggleCellSelection(undefined, 'a')).toEqual(['a']);
  });

  it('does not mutate the selection it was given', () => {
    const current = ['a'];
    toggleCellSelection(current, 'c');
    expect(current).toEqual(['a']);
  });
});

describe('selectedCells', () => {
  it('resolves ids back to the cells behind them', () => {
    expect(selectedCells(grid, ['c']).map((entry) => entry.id)).toEqual(['c']);
  });

  it('returns them in grid order, not the order they were tapped', () => {
    expect(selectedCells(grid, ['c', 'a']).map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('drops a cell that stopped being selectable while the selection was open', () => {
    // 'b' has not germinated, so picking it can never contribute seedlings
    expect(selectedCells(grid, ['a', 'b']).map((entry) => entry.id)).toEqual(['a']);
  });

  it('is empty when nothing is picked', () => {
    expect(selectedCells(grid, [])).toEqual([]);
    expect(selectedCells(grid, undefined)).toEqual([]);
  });
});

describe('selectionSummary', () => {
  it('counts the cells and the seedlings they hold', () => {
    expect(selectionSummary(selectedCells(grid, ['a', 'c']))).toBe('2 cells · 3 seedlings');
  });

  it('reads singular where it should', () => {
    expect(selectionSummary([cell('c', 1)])).toBe('1 cell · 1 seedling');
  });

  it('describes an empty selection rather than blanking out', () => {
    expect(selectionSummary([])).toBe('0 cells · 0 seedlings');
  });
});

describe('thinnableCells', () => {
  it('takes cells holding more than one seedling', () => {
    expect(thinnableCells([[cell('a', 3)]]).map((entry) => entry.id)).toEqual(['a']);
  });

  it('takes a lone seedling still sharing its cell with unsprouted seeds', () => {
    // 1/3 thins to 1/1: the cell is committed to the one that came up
    expect(thinnableCells([[cell('a', 1, 3)]]).map((entry) => entry.id)).toEqual(['a']);
  });

  it('leaves a cell that is already down to one seedling and one seed', () => {
    expect(thinnableCells([[cell('a', 1, 1)]])).toEqual([]);
  });

  it('leaves cells that have not come up, however many seeds they hold', () => {
    // clearing these would throw away seeds that may still sprout
    expect(thinnableCells([[cell('a', 0, 5)]])).toEqual([]);
  });

  it('leaves emptied cells alone', () => {
    expect(thinnableCells([[cell('a', 0, 0)]])).toEqual([]);
  });

  it('picks out just the thinnable cells of a mixed tray', () => {
    expect(thinnableCells(grid).map((entry) => entry.id)).toEqual(['a', 'c']);
  });
});

describe('thinningSummary', () => {
  it('counts culled seedlings and dropped seeds apart', () => {
    // 3 up out of 4 sown: two seedlings pulled, one seed given up on
    const summary = thinningSummary([cell('a', 3, 4)]);
    expect(summary).toEqual({ cells: 1, seedlings: 2, seeds: 1 });
  });

  it('counts no seedling lost when only one came up', () => {
    expect(thinningSummary([cell('a', 1, 3)])).toEqual({ cells: 1, seedlings: 0, seeds: 2 });
  });

  it('counts no seed lost when the whole cell came up', () => {
    expect(thinningSummary([cell('a', 3, 3)])).toEqual({ cells: 1, seedlings: 2, seeds: 0 });
  });

  it('adds up across the cells it is given', () => {
    expect(thinningSummary([cell('a', 3, 4), cell('b', 2, 2)])).toEqual({
      cells: 2,
      seedlings: 3,
      seeds: 1,
    });
  });

  it('is all zeroes for nothing to thin', () => {
    expect(thinningSummary([])).toEqual({ cells: 0, seedlings: 0, seeds: 0 });
    expect(thinningSummary(undefined)).toEqual({ cells: 0, seedlings: 0, seeds: 0 });
  });

  it('describes what a thinning of the whole tray would cost', () => {
    // 'a' is 2/3 and 'c' is 1/3, so one seedling goes and three seeds do
    expect(thinningSummary(thinnableCells(grid))).toEqual({ cells: 2, seedlings: 1, seeds: 3 });
  });
});

describe('originalSeedsPerCell', () => {
  it('reads the dose a untouched sowing was filled with', () => {
    expect(originalSeedsPerCell([[cell('a', 0, 3), cell('b', 0, 3)]])).toBe(3);
  });

  it('takes the fullest cell, since transplanting only empties cells', () => {
    // 'b' gave up two seedlings; 'a' still shows what the tray was sown at
    expect(originalSeedsPerCell([[cell('a', 3, 3), cell('b', 1, 1)]])).toBe(3);
  });

  it('falls back to one for a sowing that has been emptied out', () => {
    expect(originalSeedsPerCell([[cell('a', 0, 0), cell('b', 0, 0)]])).toBe(1);
  });

  it('falls back to one when there is no grid to read', () => {
    expect(originalSeedsPerCell(undefined)).toBe(1);
    expect(originalSeedsPerCell([[null]])).toBe(1);
  });
});

describe('otherStations', () => {
  const stations = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

  it('offers every station but the one the sowing is in', () => {
    expect(otherStations(stations, 's2').map((entry) => entry.id)).toEqual(['s1', 's3']);
  });

  it('offers nothing when that is the only station', () => {
    expect(otherStations([{ id: 's1' }], 's1')).toEqual([]);
  });

  it('copes with no stations loaded yet', () => {
    expect(otherStations(undefined, 's1')).toEqual([]);
  });
});

describe('daysSince', () => {
  it('counts whole days from a stored date', () => {
    const today = new Date();
    const iso = (date) => date.toISOString().slice(0, 10);
    expect(daysSince(iso(today))).toBe(0);
    expect(daysSince(iso(new Date(today.getTime() - 3 * 86400000)))).toBe(3);
  });

  it('never counts backwards for a date in the future', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(daysSince(tomorrow)).toBe(0);
  });

  it('is null when there is no date to count from', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince('')).toBeNull();
    expect(daysSince('not-a-date')).toBeNull();
  });
});

describe('environmentLabel', () => {
  it('names the environments, falling back to indoor', () => {
    expect(environmentLabel('outdoor')).toBe('Outdoor');
    expect(environmentLabel('indoor')).toBe('Indoor');
    expect(environmentLabel(undefined)).toBe('Indoor');
  });
});
