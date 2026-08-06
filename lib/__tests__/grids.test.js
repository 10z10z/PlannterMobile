import { gridProblem, gridsAreValid } from '../grids';
import { LIMITS } from '../validation';

const main = { name: 'Main', grid_rows: 4, grid_cols: 4 };

describe('gridProblem', () => {
  it('is quiet about a list that is fine', () => {
    expect(gridProblem([main, { name: 'Shelf', grid_rows: 2, grid_cols: 6 }])).toBe('');
  });

  it('allows a growspace with no grids yet', () => {
    expect(gridProblem([])).toBe('');
    expect(gridProblem(undefined)).toBe('');
  });

  it('names the grid at fault', () => {
    expect(gridProblem([main, { name: 'Shelf', grid_rows: 0, grid_cols: 6 }])).toBe(
      `Shelf: rows must be between 1 and ${LIMITS.GRID_SIDE}`
    );
  });

  it('reports the unnamed grid without a stray colon', () => {
    expect(gridProblem([{ name: '  ', grid_rows: 4, grid_cols: 4 }])).toBe('Grid name is required');
  });

  it('catches a grid too big to draw even when both sides pass', () => {
    expect(gridProblem([{ name: 'Wall', grid_rows: 40, grid_cols: 40 }])).toBe(
      `Wall: that is 1600 cells — ${LIMITS.GRID_CELLS} is the most that can be drawn`
    );
  });

  it('stops at the first problem', () => {
    const problem = gridProblem([
      { name: 'One', grid_rows: 0, grid_cols: 4 },
      { name: 'Two', grid_rows: 0, grid_cols: 4 },
    ]);
    expect(problem.startsWith('One:')).toBe(true);
  });

  it('takes the numbers the list holds as numbers', () => {
    expect(gridProblem([{ name: 'Main', grid_rows: 4, grid_cols: 4 }])).toBe('');
    expect(gridProblem([{ name: 'Main', grid_rows: '4', grid_cols: '4' }])).toBe('');
  });
});

describe('gridsAreValid', () => {
  it('is the same question the other way round', () => {
    expect(gridsAreValid([main])).toBe(true);
    expect(gridsAreValid([{ name: 'Bad', grid_rows: 999, grid_cols: 999 }])).toBe(false);
  });
});
