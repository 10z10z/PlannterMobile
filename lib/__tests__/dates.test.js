import { daysSince, daysSinceTimestamp, earliestDate } from '../dates';

/** `YYYY-MM-DD` for a date the given number of days ago, in local time. */
const ago = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

describe('daysSince', () => {
  it('counts whole days back from today', () => {
    expect(daysSince(ago(0))).toBe(0);
    expect(daysSince(ago(1))).toBe(1);
    expect(daysSince(ago(30))).toBe(30);
  });

  it('treats a date in the future as today rather than counting backwards', () => {
    expect(daysSince(ago(-5))).toBe(0);
  });

  it('is null when there is no date to count from', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
    expect(daysSince('')).toBeNull();
    expect(daysSince('not-a-date')).toBeNull();
  });
});

describe('daysSinceTimestamp', () => {
  it('counts from a stored timestamp the same way', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(daysSinceTimestamp(twoDaysAgo)).toBe(2);
  });

  it('counts midnight to midnight, not in 24-hour blocks', () => {
    // A few minutes ago is still today, however late in the day it is
    expect(daysSinceTimestamp(new Date(Date.now() - 60000).toISOString())).toBe(0);
  });

  it('is null for a missing or unreadable timestamp', () => {
    expect(daysSinceTimestamp(null)).toBeNull();
    expect(daysSinceTimestamp('rubbish')).toBeNull();
  });
});

describe('earliestDate', () => {
  it('takes the oldest of the dates it is given', () => {
    expect(earliestDate(['2026-05-02', '2026-04-30', '2026-06-01'])).toBe('2026-04-30');
  });

  it('ignores the ones that are not set', () => {
    expect(earliestDate([null, '2026-05-02', undefined])).toBe('2026-05-02');
  });

  it('is null when nothing is set', () => {
    expect(earliestDate([null, null])).toBeNull();
    expect(earliestDate([])).toBeNull();
    expect(earliestDate(undefined)).toBeNull();
  });
});
