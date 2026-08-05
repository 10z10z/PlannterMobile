import {
  daysSinceGermination,
  daysSinceTransplant,
  daysUntilWatering,
  plantPhase,
  plantSummary,
  plantTypeLabel,
  wateringColors,
  wateringLabel,
  wateringStatus,
} from '../plants';

/** `YYYY-MM-DD` for a date the given number of days ago, in local time. */
const ago = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

/** A plant last watered `daysAgo` days ago, wanting water every `interval` days. */
const plant = (daysAgo, interval = 7) => ({
  last_watered_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  watering_interval_days: interval,
});

describe('daysUntilWatering', () => {
  it('counts down from the last watering', () => {
    expect(daysUntilWatering(plant(2))).toBe(5);
  });

  it('goes negative once the plant is overdue', () => {
    expect(daysUntilWatering(plant(10))).toBe(-3);
  });

  it('follows the plant’s own interval', () => {
    expect(daysUntilWatering(plant(1, 3))).toBe(2);
  });
});

describe('wateringStatus', () => {
  it('flags a plant that is past due', () => {
    expect(wateringStatus(plant(9))).toBe('overdue');
  });

  it('flags one due today', () => {
    expect(wateringStatus(plant(7))).toBe('today');
  });

  it('leaves one that has time', () => {
    expect(wateringStatus(plant(1))).toBe('ok');
  });
});

describe('wateringLabel', () => {
  it('says how long is left, or how far past', () => {
    expect(wateringLabel(plant(2))).toBe('Water in 5d');
    expect(wateringLabel(plant(7))).toBe('Water today');
    expect(wateringLabel(plant(10))).toBe('Overdue by 3d');
  });

  it('counts one overdue day as singular in the maths, not the wording', () => {
    expect(wateringLabel(plant(8))).toBe('Overdue by 1d');
  });
});

describe('daysSinceGermination', () => {
  it('counts from the date the seedling came up', () => {
    expect(daysSinceGermination({ germinated_on: ago(12) })).toBe(12);
  });

  it('is null on a plant that was never told', () => {
    expect(daysSinceGermination({ germinated_on: null })).toBeNull();
    expect(daysSinceGermination({})).toBeNull();
  });
});

describe('daysSinceTransplant', () => {
  it('counts from the day it was moved in', () => {
    expect(daysSinceTransplant({ transplanted_on: ago(4) })).toBe(4);
  });

  it('falls back to when the row was created, for plants predating the column', () => {
    const created = new Date(Date.now() - 6 * 86400000).toISOString();
    expect(daysSinceTransplant({ transplanted_on: null, created_at: created })).toBe(6);
  });

  it('prefers the transplant date over the row’s age when both are there', () => {
    const created = new Date(Date.now() - 90 * 86400000).toISOString();
    expect(daysSinceTransplant({ transplanted_on: ago(3), created_at: created })).toBe(3);
  });

  it('is null when neither is known', () => {
    expect(daysSinceTransplant({})).toBeNull();
  });
});

describe('plantPhase', () => {
  it('reads the phase from the crop and how long since it came up', () => {
    expect(plantPhase({ plant_type: 'Pepper', germinated_on: ago(40) }).key).toBe('vegetative');
  });

  it('uses the default guidelines for a crop it does not know', () => {
    expect(plantPhase({ plant_type: 'Kohlrabi', germinated_on: ago(5) }).key).toBe('seedling');
  });

  it('says nothing without a germination date', () => {
    expect(plantPhase({ plant_type: 'Pepper' })).toBeNull();
  });
});

describe('plantTypeLabel', () => {
  it('names the crop properly when it recognises it', () => {
    expect(plantTypeLabel({ plant_type: 'cherry tomato' })).toBe('Tomato');
  });

  it('falls back to the free-text species when there is no crop', () => {
    expect(plantTypeLabel({ species: 'Padron' })).toBe('Padron');
  });

  it('is null when the plant says nothing about itself', () => {
    expect(plantTypeLabel({})).toBeNull();
  });
});

describe('plantSummary', () => {
  it('reads what it is, where it is, and how old', () => {
    expect(plantSummary({ plant_type: 'Pepper', germinated_on: ago(40) })).toBe(
      'Pepper · Vegetative · 40d old'
    );
  });

  it('leaves out what is not known rather than showing gaps', () => {
    expect(plantSummary({ plant_type: 'Pepper' })).toBe('Pepper');
    expect(plantSummary({ germinated_on: ago(3) })).toBe('Seedling · 3d old');
  });

  it('is empty for a plant with nothing to say', () => {
    expect(plantSummary({})).toBe('');
  });
});

describe('wateringColors', () => {
  it('colours only the states that need attention', () => {
    expect(wateringColors('overdue', false)).toBeTruthy();
    expect(wateringColors('today', false)).toBeTruthy();
    expect(wateringColors('ok', false)).toBeNull();
  });

  it('gives light and dark themes different shades', () => {
    expect(wateringColors('overdue', true)).not.toBe(wateringColors('overdue', false));
  });
});
