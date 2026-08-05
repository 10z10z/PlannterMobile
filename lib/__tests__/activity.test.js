// Only the pure helpers are exercised here — the calendar maths and the rule
// that decides when a recorded event stands in for a derived one. The module
// they live in also talks to Supabase, which is stubbed so the suite stays in
// the node environment.
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../../components/DateField', () => ({
  toDateString: (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`,
}));

import {
  countLabel,
  groupByDay,
  mergeEntries,
  monthOf,
  monthRange,
  monthWeeks,
  shiftMonth,
} from '../activity';

const entry = (overrides) => ({
  id: 'e1',
  kind: 'sown',
  occurred_on: '2026-08-05',
  subject: 'Chilli',
  sowing_id: null,
  plant_id: null,
  ...overrides,
});

describe('monthRange', () => {
  it('covers the whole month', () => {
    expect(monthRange({ year: 2026, month: 7 })).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('ends February on the 28th, or the 29th in a leap year', () => {
    expect(monthRange({ year: 2026, month: 1 }).to).toBe('2026-02-28');
    expect(monthRange({ year: 2028, month: 1 }).to).toBe('2028-02-29');
  });
});

describe('shiftMonth', () => {
  it('rolls over the year in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('monthWeeks', () => {
  it('starts every week on a Monday', () => {
    for (const week of monthWeeks({ year: 2026, month: 7 })) {
      expect(week).toHaveLength(7);
      expect(week[0].date.getDay()).toBe(1);
    }
  });

  it('opens on the Monday on or before the first of the month', () => {
    // 1 August 2026 is a Saturday, so the grid opens on 27 July.
    const [firstWeek] = monthWeeks({ year: 2026, month: 7 });
    expect(firstWeek[0].dateString).toBe('2026-07-27');
    expect(firstWeek.filter((day) => day.inMonth)).toHaveLength(2);
  });

  it('covers the last day of the month and stops there', () => {
    const weeks = monthWeeks({ year: 2026, month: 7 });
    const days = weeks.flat().map((day) => day.dateString);
    expect(days).toContain('2026-08-31');
    // The row holding the 31st is the last one drawn, and nothing beyond it.
    expect(days.filter((day) => day.startsWith('2026-09')).length).toBeLessThanOrEqual(6);
    expect(weeks).toHaveLength(6);
  });

  it('needs only four rows for a February that starts on a Monday', () => {
    // 1 February 2027 is a Monday and the month has 28 days.
    expect(monthWeeks({ year: 2027, month: 1 })).toHaveLength(4);
  });

  it('marks the days either side as outside the month', () => {
    const days = monthWeeks({ year: 2026, month: 7 }).flat();
    expect(days.find((day) => day.dateString === '2026-07-31').inMonth).toBe(false);
    expect(days.find((day) => day.dateString === '2026-08-01').inMonth).toBe(true);
  });
});

describe('monthOf', () => {
  it('reads a date as the month it falls in', () => {
    expect(monthOf(new Date(2026, 7, 5))).toEqual({ year: 2026, month: 7 });
  });
});

describe('groupByDay', () => {
  it('keys entries by the day they happened on', () => {
    const days = groupByDay([
      entry({ id: 'a', occurred_on: '2026-08-05' }),
      entry({ id: 'b', occurred_on: '2026-08-05' }),
      entry({ id: 'c', occurred_on: '2026-08-06' }),
    ]);
    expect(days['2026-08-05'].map((item) => item.id)).toEqual(['a', 'b']);
    expect(days['2026-08-06']).toHaveLength(1);
  });

  it('has no days at all for nothing', () => {
    expect(groupByDay(undefined)).toEqual({});
  });
});

describe('mergeEntries', () => {
  it('drops the derived entry when the same thing was recorded', () => {
    const recorded = [entry({ id: 'real', sowing_id: 's1' })];
    const derived = [entry({ id: 'derived:sown:s1', sowing_id: 's1', derived: true })];
    expect(mergeEntries(recorded, derived).map((item) => item.id)).toEqual(['real']);
  });

  it('keeps a derived entry for a different day', () => {
    const recorded = [entry({ id: 'real', sowing_id: 's1', occurred_on: '2026-08-04' })];
    const derived = [entry({ id: 'derived', sowing_id: 's1', occurred_on: '2026-08-05' })];
    expect(mergeEntries(recorded, derived)).toHaveLength(2);
  });

  it('keeps a derived entry of another kind about the same row', () => {
    const recorded = [entry({ id: 'real', kind: 'sown', sowing_id: 's1' })];
    const derived = [entry({ id: 'derived', kind: 'germinated', sowing_id: 's1' })];
    expect(mergeEntries(recorded, derived)).toHaveLength(2);
  });

  it('leads with what was recorded', () => {
    const merged = mergeEntries(
      [entry({ id: 'real', plant_id: 'p1' })],
      [entry({ id: 'derived', plant_id: 'p2' })]
    );
    expect(merged.map((item) => item.id)).toEqual(['real', 'derived']);
  });

  it('survives either side being missing', () => {
    expect(mergeEntries(undefined, undefined)).toEqual([]);
    expect(mergeEntries([entry({})], undefined)).toHaveLength(1);
  });
});

describe('countLabel', () => {
  it('pluralises everything but one', () => {
    expect(countLabel(1, 'cell')).toBe('1 cell');
    expect(countLabel(3, 'cell')).toBe('3 cells');
    expect(countLabel(0, 'seedling')).toBe('0 seedlings');
  });
});
