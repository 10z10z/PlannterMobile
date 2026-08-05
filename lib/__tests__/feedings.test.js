// How a feed describes itself on the calendar. Supabase and the activity log
// are stubbed — recording is tested by using the app, the wording is tested
// here.
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../activity', () => ({
  recordEvent: jest.fn(),
  countLabel: (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`,
}));
jest.mock('../../components/DateField', () => ({ toDateString: () => '2026-08-05' }));

import { feedingDetail, mixSummary, targetSummary } from '../feedings';

const product = (name, dose, form = 'liquid') => ({
  fertilizer_name: name,
  dose_per_liter: dose,
  form,
});

describe('mixSummary', () => {
  it('names every product at its own rate', () => {
    expect(mixSummary([product('CalMag', 2), product('Grow A', 1.5)], 'metric')).toBe(
      'CalMag 2 ml/L · Grow A 1.5 ml/L'
    );
  });

  it('uses the unit the product is measured in', () => {
    expect(mixSummary([product('Epsom salts', 0.5, 'solid')], 'metric')).toBe(
      'Epsom salts 0.5 g/L'
    );
  });

  it('converts the rate for an imperial reader', () => {
    expect(mixSummary([product('CalMag', 2)], 'imperial')).toBe('CalMag 7.57 ml/gal');
  });

  it('says nothing about an empty mix', () => {
    expect(mixSummary([], 'metric')).toBe('');
    expect(mixSummary(undefined, 'metric')).toBe('');
  });
});

describe('targetSummary', () => {
  const plants = (count) =>
    Array.from({ length: count }, (_, index) => ({ plant_name: `Plant ${index + 1}` }));

  it('names the plants when only a few were fed', () => {
    expect(targetSummary(plants(2), 'Tent A')).toBe('Plant 1, Plant 2');
  });

  it('counts them once the list would run long', () => {
    expect(targetSummary(plants(6), 'Tent A')).toBe('6 plants');
  });

  it('names the space itself when the whole thing was fed', () => {
    expect(targetSummary([], 'Tent A')).toBe('All of Tent A');
    expect(targetSummary([], null)).toBe('The whole space');
  });
});

describe('feedingDetail', () => {
  it('reads as the mix, the batch and the note', () => {
    const feeding = {
      products: [product('CalMag', 2)],
      volume_liters: 4,
      note: 'Half strength',
    };
    expect(feedingDetail(feeding, 'metric')).toBe('CalMag 2 ml/L · in 4 L · Half strength');
  });

  it('leaves out what was not recorded', () => {
    expect(feedingDetail({ products: [product('CalMag', 2)] }, 'metric')).toBe('CalMag 2 ml/L');
  });
});
