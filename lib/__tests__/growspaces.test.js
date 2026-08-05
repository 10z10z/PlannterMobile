jest.mock('../supabase', () => ({ supabase: {} }));

import {
  cellFromPoint,
  environmentLabel,
  gridLabel,
  isPlaced,
  plantAt,
  plantsInGrid,
  plantsLoosedBy,
  plantsOutsideGrid,
  positionOf,
  resolveDrop,
  sunHoursLabel,
  toPlantGrid,
  totalSpots,
  unplacedPlants,
} from '../growspaces';

const plant = (id, gridId = null, row = null, col = null) => ({
  id,
  grid_id: gridId,
  grid_row: row,
  grid_col: col,
});

/** Two grids: a 2 x 3 shelf and a 1 x 2 bench. */
const shelf = { id: 'shelf', name: 'Shelf', grid_rows: 2, grid_cols: 3 };
const bench = { id: 'bench', name: 'Bench', grid_rows: 1, grid_cols: 2 };
const grids = [shelf, bench];

/** Two on the shelf, one on the bench, one waiting in the holding tray. */
const plants = [
  plant('a', 'shelf', 0, 0),
  plant('b', 'shelf', 1, 2),
  plant('d', 'bench', 0, 1),
  plant('c'),
];

describe('isPlaced', () => {
  it('needs a grid and a position to call a plant placed', () => {
    expect(isPlaced(plant('a', 'shelf', 0, 0))).toBe(true);
    expect(isPlaced(plant('c'))).toBe(false);
    expect(isPlaced(undefined)).toBe(false);
  });

  it('counts row zero as a position rather than as missing', () => {
    expect(isPlaced(plant('a', 'shelf', 0, 0))).toBe(true);
  });

  it('refuses coordinates left behind by a deleted grid', () => {
    // grid_id goes null on delete; the coordinates linger until they are cleared
    expect(isPlaced(plant('a', null, 1, 1))).toBe(false);
  });
});

describe('plantsInGrid', () => {
  it('takes only the plants standing on that grid', () => {
    expect(plantsInGrid(plants, 'shelf').map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(plantsInGrid(plants, 'bench').map((entry) => entry.id)).toEqual(['d']);
  });

  it('is empty for a grid nothing stands on', () => {
    expect(plantsInGrid(plants, 'floor')).toEqual([]);
  });
});

describe('toPlantGrid', () => {
  it('lays out one grid, leaving the other grid plants out of it', () => {
    const laid = toPlantGrid(shelf, plants);
    expect(laid).toHaveLength(2);
    expect(laid[0]).toHaveLength(3);
    expect(laid[0][0].id).toBe('a');
    expect(laid[1][2].id).toBe('b');
    expect(laid.flat().filter(Boolean)).toHaveLength(2);
  });

  it('keeps two grids apart even at the same coordinates', () => {
    const shared = [plant('x', 'shelf', 0, 0), plant('y', 'bench', 0, 0)];
    expect(toPlantGrid(shelf, shared)[0][0].id).toBe('x');
    expect(toPlantGrid(bench, shared)[0][0].id).toBe('y');
  });

  it('leaves out a plant stranded outside the current bounds', () => {
    const shrunk = toPlantGrid({ ...shelf, grid_rows: 1, grid_cols: 1 }, plants);
    expect(shrunk.flat().filter(Boolean)).toHaveLength(1);
  });

  it('copes with no grid loaded yet', () => {
    expect(toPlantGrid(null, plants)).toEqual([]);
  });
});

describe('unplacedPlants', () => {
  it('collects the plants with no spot on any grid', () => {
    expect(unplacedPlants(plants).map((entry) => entry.id)).toEqual(['c']);
  });
});

describe('plantsOutsideGrid', () => {
  it('finds what shrinking one grid would turn loose', () => {
    expect(plantsOutsideGrid(plants, 'shelf', 1, 1).map((entry) => entry.id)).toEqual(['b']);
  });

  it('ignores plants on other grids', () => {
    expect(plantsOutsideGrid(plants, 'bench', 1, 1).map((entry) => entry.id)).toEqual(['d']);
  });

  it('finds nothing when the grid still covers everyone', () => {
    expect(plantsOutsideGrid(plants, 'shelf', 2, 3)).toEqual([]);
  });
});

describe('plantsLoosedBy', () => {
  it('finds nothing when the grids are unchanged', () => {
    expect(plantsLoosedBy(plants, grids)).toEqual([]);
  });

  it('turns loose the plants on a grid that was removed', () => {
    expect(plantsLoosedBy(plants, [shelf]).map((entry) => entry.id)).toEqual(['d']);
  });

  it('turns loose the plants a shrink would strand', () => {
    const smaller = [{ ...shelf, grid_rows: 1, grid_cols: 1 }, bench];
    expect(plantsLoosedBy(plants, smaller).map((entry) => entry.id)).toEqual(['b']);
  });

  it('adds up removals and shrinks together', () => {
    const smaller = [{ ...shelf, grid_rows: 1, grid_cols: 1 }];
    expect(plantsLoosedBy(plants, smaller).map((entry) => entry.id)).toEqual(['b', 'd']);
  });

  it('turns everything loose when every grid goes', () => {
    expect(plantsLoosedBy(plants, []).map((entry) => entry.id)).toEqual(['a', 'b', 'd']);
  });

  it('never counts a plant already in the holding tray', () => {
    expect(plantsLoosedBy([plant('c')], [])).toEqual([]);
  });

  it('ignores grids not yet saved, which no plant can be standing on', () => {
    const withNew = [...grids, { id: null, name: 'New', grid_rows: 2, grid_cols: 2 }];
    expect(plantsLoosedBy(plants, withNew)).toEqual([]);
  });
});

describe('plantAt', () => {
  it('finds who is standing in a cell of a given grid', () => {
    expect(plantAt(plants, 'shelf', 1, 2).id).toBe('b');
    expect(plantAt(plants, 'bench', 0, 1).id).toBe('d');
  });

  it('does not find a plant standing at the same spot on another grid', () => {
    expect(plantAt(plants, 'bench', 0, 0)).toBeNull();
  });

  it('is null for a free cell', () => {
    expect(plantAt(plants, 'shelf', 0, 1)).toBeNull();
  });
});

describe('positionOf', () => {
  it('reads a placed plant cell', () => {
    expect(positionOf(plants[0])).toEqual({ gridId: 'shelf', row: 0, col: 0 });
  });

  it('is null for one in the holding tray', () => {
    expect(positionOf(plants[3])).toBeNull();
  });
});

describe('cellFromPoint', () => {
  // 50px cells with a 10px gutter: cell 0 spans 0-50, cell 1 spans 60-110
  const geometry = { cellSize: 50, gap: 10, rows: 2, cols: 3 };

  it('finds the cell a point sits in', () => {
    expect(cellFromPoint(25, 25, geometry)).toEqual({ row: 0, col: 0 });
    expect(cellFromPoint(70, 80, geometry)).toEqual({ row: 1, col: 1 });
  });

  it('takes the top left corner of a cell', () => {
    expect(cellFromPoint(0, 0, geometry)).toEqual({ row: 0, col: 0 });
  });

  it('refuses a point in the gutter between cells', () => {
    expect(cellFromPoint(55, 25, geometry)).toBeNull();
    expect(cellFromPoint(25, 55, geometry)).toBeNull();
  });

  it('refuses a point past the last row or column', () => {
    expect(cellFromPoint(25, 200, geometry)).toBeNull();
    expect(cellFromPoint(400, 25, geometry)).toBeNull();
  });

  it('refuses a point before the grid rather than clamping to it', () => {
    expect(cellFromPoint(-5, 25, geometry)).toBeNull();
    expect(cellFromPoint(25, -1, geometry)).toBeNull();
  });
});

describe('resolveDrop', () => {
  it('moves a plant into a free cell of the same grid', () => {
    const drop = resolveDrop(plants, plants[0], { gridId: 'shelf', row: 0, col: 1 });
    expect(drop.type).toBe('move');
    expect(drop.to).toEqual({ gridId: 'shelf', row: 0, col: 1 });
  });

  it('moves a plant onto a free cell of a different grid', () => {
    const drop = resolveDrop(plants, plants[0], { gridId: 'bench', row: 0, col: 0 });
    expect(drop.type).toBe('move');
    expect(drop.to.gridId).toBe('bench');
  });

  it('swaps with whoever is already there, so a full grid still rearranges', () => {
    const drop = resolveDrop(plants, plants[0], { gridId: 'shelf', row: 1, col: 2 });
    expect(drop.type).toBe('swap');
    expect(drop.occupant.id).toBe('b');
  });

  it('swaps across grids, trading the two plants places', () => {
    const drop = resolveDrop(plants, plants[0], { gridId: 'bench', row: 0, col: 1 });
    expect(drop.type).toBe('swap');
    expect(drop.plant.id).toBe('a');
    expect(drop.occupant.id).toBe('d');
  });

  it('does nothing when a plant is dropped back where it started', () => {
    expect(resolveDrop(plants, plants[0], { gridId: 'shelf', row: 0, col: 0 }).type).toBe('none');
  });

  it('moves rather than does nothing at the same coordinates on another grid', () => {
    expect(resolveDrop(plants, plants[0], { gridId: 'bench', row: 0, col: 0 }).type).toBe('move');
  });

  it('does nothing when the drop missed every grid', () => {
    expect(resolveDrop(plants, plants[0], null).type).toBe('none');
  });

  it('places a waiting plant onto a grid', () => {
    const drop = resolveDrop(plants, plants[3], { gridId: 'shelf', row: 0, col: 1 });
    expect(drop.type).toBe('move');
    expect(drop.plant.id).toBe('c');
  });
});

describe('gridLabel and totalSpots', () => {
  it('counts one grid spots', () => {
    expect(gridLabel(shelf)).toBe('2 x 3 · 6 spots');
  });

  it('adds up the spots across every grid', () => {
    expect(totalSpots(grids)).toBe(8);
    expect(totalSpots([])).toBe(0);
    expect(totalSpots(undefined)).toBe(0);
  });
});

describe('sunHoursLabel', () => {
  it('reads a whole number of hours', () => {
    expect(sunHoursLabel(6)).toBe('6h direct sun');
  });

  it('keeps a half hour', () => {
    expect(sunHoursLabel(6.5)).toBe('6.5h direct sun');
  });

  it('rounds off a figure with more precision than the sun deserves', () => {
    expect(sunHoursLabel(6.28)).toBe('6.3h direct sun');
  });

  it('treats no sun as nothing to say rather than as "0h"', () => {
    expect(sunHoursLabel(0)).toBeNull();
    expect(sunHoursLabel(null)).toBeNull();
    expect(sunHoursLabel(undefined)).toBeNull();
    expect(sunHoursLabel('')).toBeNull();
  });
});

describe('environmentLabel', () => {
  it('names the environments, falling back to indoor', () => {
    expect(environmentLabel('outdoor')).toBe('Outdoor');
    expect(environmentLabel(undefined)).toBe('Indoor');
  });
});
