import {
  DEFAULT_FILTERS,
  actionGroup,
  entryGroup,
  filterActions,
  filterEntries,
  isFiltered,
  normalizeFilters,
  toggleFilter,
} from '../calendarFilters';

const entry = (overrides) => ({
  id: 'e1',
  kind: 'sown',
  source: 'station',
  occurred_on: '2026-08-05',
  ...overrides,
});

const action = (overrides) => ({
  id: 'a1',
  kind: 'feed',
  source: 'growspace',
  due_on: '2026-08-05',
  ...overrides,
});

describe('grouping', () => {
  it('puts a record and the plan that led to it in the same group', () => {
    expect(entryGroup('fed')).toBe(actionGroup('feed'));
    expect(entryGroup('sown')).toBe(actionGroup('sow'));
    expect(entryGroup('transplanted')).toBe(actionGroup('transplant'));
  });

  it('gathers the whole of a job under one chip', () => {
    expect(entryGroup('germinated')).toBe('sowing');
    expect(entryGroup('planted')).toBe('transplant');
    expect(entryGroup('moved')).toBe('transplant');
  });

  it('falls back to Other for a kind it has never seen', () => {
    expect(entryGroup('composted')).toBe('other');
    expect(actionGroup(undefined)).toBe('other');
  });
});

describe('filterEntries', () => {
  it('shows everything by default', () => {
    const entries = [entry({}), entry({ id: 'e2', kind: 'fed', source: 'growspace' })];
    expect(filterEntries(entries, DEFAULT_FILTERS)).toHaveLength(2);
  });

  it('drops the side that was switched off', () => {
    const entries = [entry({}), entry({ id: 'e2', source: 'growspace', kind: 'watered' })];
    const filters = { ...DEFAULT_FILTERS, places: ['growspace'] };
    expect(filterEntries(entries, filters).map((item) => item.id)).toEqual(['e2']);
  });

  it('drops the kinds of job that were switched off', () => {
    const entries = [entry({ kind: 'fed' }), entry({ id: 'e2', kind: 'watered' })];
    const filters = { ...DEFAULT_FILTERS, groups: ['water'] };
    expect(filterEntries(entries, filters).map((item) => item.id)).toEqual(['e2']);
  });

  it('hides the whole log when Done is off', () => {
    const filters = { ...DEFAULT_FILTERS, records: ['planned'] };
    expect(filterEntries([entry({})], filters)).toEqual([]);
  });

  it('reads an entry with no side recorded as a growspace one', () => {
    const filters = { ...DEFAULT_FILTERS, places: ['growspace'] };
    expect(filterEntries([entry({ source: undefined })], filters)).toHaveLength(1);
  });
});

describe('filterActions', () => {
  it('hides the plans when Planned is off, whether or not they are done', () => {
    const filters = { ...DEFAULT_FILTERS, records: ['done'] };
    expect(
      filterActions([action({}), action({ id: 'a2', done_on: '2026-08-05' })], filters)
    ).toEqual([]);
  });

  it('keeps a ticked-off plan while Planned is on', () => {
    const done = action({ done_on: '2026-08-05' });
    expect(filterActions([done], DEFAULT_FILTERS)).toHaveLength(1);
  });

  it('narrows by side and by job, like the log does', () => {
    const actions = [action({}), action({ id: 'a2', kind: 'sow', source: 'station' })];
    expect(
      filterActions(actions, { ...DEFAULT_FILTERS, places: ['station'] }).map((item) => item.id)
    ).toEqual(['a2']);
    expect(
      filterActions(actions, { ...DEFAULT_FILTERS, groups: ['feed'] }).map((item) => item.id)
    ).toEqual(['a1']);
  });
});

describe('toggleFilter', () => {
  it('switches one chip without touching the others', () => {
    const next = toggleFilter(DEFAULT_FILTERS, 'places', 'station');
    expect(next.places).toEqual(['growspace']);
    expect(next.groups).toEqual(DEFAULT_FILTERS.groups);

    expect(toggleFilter(next, 'places', 'station').places).toContain('station');
  });
});

describe('isFiltered', () => {
  it('is false only when everything is showing', () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, groups: ['feed'] })).toBe(true);
  });
});

describe('normalizeFilters', () => {
  it('falls back to everything for nothing stored', () => {
    expect(normalizeFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(normalizeFilters('rubbish')).toEqual(DEFAULT_FILTERS);
  });

  it('drops values it no longer knows', () => {
    const stored = { places: ['growspace', 'greenhouse'], records: ['done'], groups: ['feed'] };
    expect(normalizeFilters(stored)).toEqual({
      places: ['growspace'],
      records: ['done'],
      groups: ['feed'],
    });
  });

  it('keeps a dimension that was deliberately emptied', () => {
    expect(normalizeFilters({ ...DEFAULT_FILTERS, groups: [] }).groups).toEqual([]);
  });

  it('replaces a dimension that is not a list at all', () => {
    expect(normalizeFilters({ groups: 'feed' }).groups).toEqual(DEFAULT_FILTERS.groups);
  });
});
