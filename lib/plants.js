import { daysSince, daysSinceTimestamp } from './dates';
import { phaseFor, speciesLabel } from './species';

/**
 * How long since the seed came up, or null on a plant added by hand that was
 * never told. Transplants carry the date over from the cell they grew in.
 */
export function daysSinceGermination(plant) {
  return daysSince(plant?.germinated_on);
}

/**
 * How long since the plant was moved into its growspace.
 *
 * Plants that predate the column fall back to when their row was created, which
 * for a transplant is the same moment and for one added by hand is when it was
 * entered — in both cases the day it turned up in the growspace.
 */
export function daysSinceTransplant(plant) {
  if (plant?.transplanted_on) return daysSince(plant.transplanted_on);
  return daysSinceTimestamp(plant?.created_at);
}

/** The growth phase a plant is in, from its crop and how long since it came up. */
export function plantPhase(plant) {
  return phaseFor(plant?.plant_type, daysSinceGermination(plant));
}

/** The crop's proper name, falling back to the free-text species field. */
export function plantTypeLabel(plant) {
  return speciesLabel(plant?.plant_type) ?? plant?.species ?? null;
}

/**
 * The one-line summary under a plant's name: what it is, where it is in its
 * life, and how long it has been going — leaving out whatever isn't known
 * rather than showing gaps.
 */
export function plantSummary(plant) {
  const phase = plantPhase(plant);
  const germinated = daysSinceGermination(plant);
  return [
    plantTypeLabel(plant),
    phase?.label,
    germinated !== null ? `${germinated}d old` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Watering state, worked out from when a plant was last watered and how often it
 * wants it. Whole days, rounded up, so "in 1d" means some time tomorrow rather
 * than in the next 24 hours exactly.
 */
export function daysUntilWatering(plant) {
  const due = new Date(plant.last_watered_at);
  due.setDate(due.getDate() + plant.watering_interval_days);
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
}

export function wateringStatus(plant) {
  const days = daysUntilWatering(plant);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return 'ok';
}

export function wateringLabel(plant) {
  const days = daysUntilWatering(plant);
  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return 'Water today';
  return `Water in ${days}d`;
}

/** The colour a plant's watering state is flagged with on its grid tile. */
export function wateringColors(status, isDark) {
  if (status === 'overdue') return isDark ? '#E38B8B' : '#B3261E';
  if (status === 'today') return isDark ? '#E3C88B' : '#8A6A00';
  return null;
}
