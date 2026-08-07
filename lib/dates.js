/**
 * Dates are held as "YYYY-MM-DD" strings — Postgres `date` columns are calendar
 * dates with no timezone, so they're built from local parts rather than via
 * toISOString(), which would shift the day for anyone behind UTC.
 *
 * These three lived on `components/DateField` until it turned out that half of
 * `lib/` imported a date helper from it — so reading a date string pulled in a
 * text field, Paper, and Android's own calendar behind them. Same problem
 * `lib/enums.js` was split out to fix, and the same fix: the pure thing belongs
 * where nothing native can follow it.
 */
export function toDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromDateString(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** The same date as someone would read it: "3 Aug 2026". */
export function formatDateString(value) {
  const date = fromDateString(value);
  if (!date) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Whole days since a stored `YYYY-MM-DD` date, counted from midnight to
 * midnight so "1d" means yesterday rather than 24 hours ago. Null when there is
 * no date to count from, and never negative — a date in the future is today's
 * news, not a countdown.
 */
export function daysSince(dateString) {
  if (!dateString) return null;
  const [year, month, day] = String(dateString).split('-').map(Number);
  if (!year || !month || !day) return null;
  const then = new Date(year, month - 1, day);
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor((midnight.getTime() - then.getTime()) / 86400000);
  return days < 0 ? 0 : days;
}

/** The same count from a timestamp, for columns that store one. */
export function daysSinceTimestamp(iso) {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return daysSince(
    `${then.getFullYear()}-${String(then.getMonth() + 1).padStart(2, '0')}-${String(
      then.getDate()
    ).padStart(2, '0')}`
  );
}

/** The earliest of a set of dates, ignoring the ones that aren't set. */
export function earliestDate(dates) {
  return (dates ?? []).filter(Boolean).sort()[0] ?? null;
}
