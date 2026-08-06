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
