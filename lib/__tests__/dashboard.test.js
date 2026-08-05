jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../../components/DateField', () => ({
  toDateString: (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`,
}));

import {
  growspaceStats,
  photoperiodSummary,
  shiftDate,
  splitSchedule,
} from '../dashboard';

const action = (overrides) => ({
  id: 'a1',
  kind: 'feed',
  due_on: '2026-08-06',
  done_on: null,
  ...overrides,
});

describe('shiftDate', () => {
  it('moves whole days either way', () => {
    expect(shiftDate('2026-08-06', 1)).toBe('2026-08-07');
    expect(shiftDate('2026-08-06', -1)).toBe('2026-08-05');
  });

  it('rolls over months and years', () => {
    expect(shiftDate('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('lands on the 29th when stepping into a leap February', () => {
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('splitSchedule', () => {
  const today = '2026-08-06';

  it('keeps overdue apart from today rather than folding them together', () => {
    const split = splitSchedule(
      [
        action({ id: 'late', due_on: '2026-07-30' }),
        action({ id: 'now', due_on: today }),
        action({ id: 'later', due_on: '2026-08-09' }),
      ],
      today
    );
    expect(split.overdue.map((entry) => entry.id)).toEqual(['late']);
    expect(split.today.map((entry) => entry.id)).toEqual(['now']);
    expect(split.soon.map((entry) => entry.id)).toEqual(['later']);
  });

  it('drops anything already ticked off, however overdue it was', () => {
    const split = splitSchedule(
      [action({ id: 'done', due_on: '2026-07-01', done_on: '2026-07-02' })],
      today
    );
    expect(split.overdue).toEqual([]);
    expect(split.today).toEqual([]);
    expect(split.soon).toEqual([]);
  });

  it('survives having nothing to sort', () => {
    expect(splitSchedule(undefined, today)).toEqual({ overdue: [], today: [], soon: [] });
  });
});

describe('photoperiodSummary', () => {
  it('reads one cycle off the fixtures running it', () => {
    expect(photoperiodSummary([{ hours_on: 18 }, { hours_on: 18 }])).toBe('18/6 h');
  });

  it('says how many cycles a space is running rather than picking one', () => {
    expect(photoperiodSummary([{ hours_on: 18 }, { hours_on: 12 }])).toBe('2 cycles');
  });

  it('is nothing at all when no cycle was set', () => {
    expect(photoperiodSummary([])).toBeNull();
    expect(photoperiodSummary(undefined)).toBeNull();
    expect(photoperiodSummary([{ hours_on: null }])).toBeNull();
  });

  it('keeps a cycle that is off around the clock', () => {
    // Zero hours on is a real answer — a space whose lights are never on.
    expect(photoperiodSummary([{ hours_on: 0 }])).toBe('0/24 h');
  });
});

describe('growspaceStats', () => {
  const growspace = { id: 'g1', name: 'Indoor 1', environment: 'indoor' };

  const rows = {
    plants: [
      { id: 'p1', growspace_id: 'g1' },
      { id: 'p2', growspace_id: 'g1' },
      { id: 'p3', growspace_id: 'g2' },
    ],
    grids: [
      { growspace_id: 'g1', grid_rows: 4, grid_cols: 4 },
      { growspace_id: 'g1', grid_rows: 5, grid_cols: 2 },
      { growspace_id: 'g2', grid_rows: 3, grid_cols: 3 },
    ],
    lights: [
      { growspace_id: 'g1', hours_on: 18 },
      { growspace_id: 'g2', hours_on: 12 },
    ],
  };

  it('counts only what stands in this space', () => {
    const stats = growspaceStats(growspace, rows);
    expect(stats.plantCount).toBe(2);
    expect(stats.spots).toBe(26);
    expect(stats.gridCount).toBe(2);
    expect(stats.photoperiod).toBe('18/6 h');
  });

  it('keeps the fields the growspace already had', () => {
    const stats = growspaceStats(growspace, rows);
    expect(stats.name).toBe('Indoor 1');
    expect(stats.environment).toBe('indoor');
  });

  it('reads an empty space as empty rather than as unknown', () => {
    const stats = growspaceStats({ id: 'g9', name: 'New' }, rows);
    expect(stats.plantCount).toBe(0);
    expect(stats.spots).toBe(0);
    expect(stats.photoperiod).toBeNull();
  });
});
