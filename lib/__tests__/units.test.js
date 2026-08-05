import {
  doseUnit,
  formatDose,
  formatDoseRange,
  formatLength,
  formatTemperature,
  formatVolume,
  parseDose,
  parseLength,
  parseTemperature,
  parseVolume,
} from '../units';

const LITERS_PER_GALLON = 3.785411784;

describe('formatVolume', () => {
  it('shows stored litres as-is under metric', () => {
    expect(formatVolume(20, 'metric')).toBe('20 L');
  });

  it('converts to gallons under imperial', () => {
    expect(formatVolume(LITERS_PER_GALLON * 5, 'imperial')).toBe('5 gal');
  });

  it('can drop the unit for use inside a text field', () => {
    expect(formatVolume(20, 'metric', { withUnit: false })).toBe('20');
  });

  it('is blank when nothing is stored', () => {
    expect(formatVolume(null, 'metric')).toBe('');
    expect(formatVolume(undefined, 'metric')).toBe('');
    expect(formatVolume('', 'metric')).toBe('');
  });
});

describe('parseVolume', () => {
  it('stores metric input unchanged', () => {
    expect(parseVolume('20', 'metric')).toBe(20);
  });

  it('converts typed gallons to litres', () => {
    expect(parseVolume('5', 'imperial')).toBeCloseTo(18.927, 3);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseVolume('2,5', 'metric')).toBe(2.5);
  });

  it('is null for blank or unparseable input', () => {
    expect(parseVolume('', 'metric')).toBeNull();
    expect(parseVolume('   ', 'metric')).toBeNull();
    expect(parseVolume('lots', 'metric')).toBeNull();
    expect(parseVolume(null, 'metric')).toBeNull();
  });

  it('round-trips what the user typed', () => {
    const stored = parseVolume('5', 'imperial');
    expect(formatVolume(stored, 'imperial', { withUnit: false })).toBe('5');
  });
});

describe('length', () => {
  it('stores centimetres and shows inches under imperial', () => {
    expect(parseLength('10', 'imperial')).toBeCloseTo(25.4, 5);
    expect(formatLength(25.4, 'imperial', { withUnit: true })).toBe('10 in');
  });

  it('leaves the unit off by default', () => {
    expect(formatLength(30, 'metric')).toBe('30');
  });

  it('is blank or null when unset', () => {
    expect(formatLength(null, 'metric')).toBe('');
    expect(parseLength('', 'metric')).toBeNull();
  });
});

describe('temperature', () => {
  it('converts across the offset scale', () => {
    expect(formatTemperature(20, 'imperial', { withUnit: true })).toBe('68 °F');
    expect(parseTemperature('68', 'imperial')).toBeCloseTo(20, 10);
  });

  it('treats zero as a real temperature, not as unset', () => {
    expect(formatTemperature(0, 'metric')).toBe('0');
    expect(formatTemperature(0, 'imperial')).toBe('32');
    expect(parseTemperature('0', 'metric')).toBe(0);
  });

  it('is blank or null when genuinely unset', () => {
    expect(formatTemperature(null, 'metric')).toBe('');
    expect(formatTemperature(undefined, 'metric')).toBe('');
    expect(parseTemperature('', 'metric')).toBeNull();
  });
});

describe('doseUnit', () => {
  it('names grams for crystals and millilitres for liquids', () => {
    expect(doseUnit('solid', 'metric')).toBe('g/L');
    expect(doseUnit('liquid', 'metric')).toBe('ml/L');
    expect(doseUnit('solid', 'imperial')).toBe('g/gal');
  });
});

describe('dose', () => {
  it('shows a per-litre dose as a per-gallon one under imperial', () => {
    expect(formatDose(1, 'imperial')).toBe('3.79');
  });

  it('converts a typed per-gallon dose back to per litre', () => {
    expect(parseDose('3.785411784', 'imperial')).toBeCloseTo(1, 6);
  });

  it('can carry the unit for the product form', () => {
    expect(formatDose(2, 'metric', { withUnit: true, form: 'solid' })).toBe('2 g/L');
  });

  it('is null for blank input', () => {
    expect(parseDose('', 'metric')).toBeNull();
    expect(formatDose(null, 'metric')).toBe('');
  });
});

describe('formatDoseRange', () => {
  it('renders a min and max as a range', () => {
    expect(formatDoseRange(2, 3, 'metric', 'liquid')).toBe('2 - 3 ml/L');
  });

  it('collapses a range whose ends are the same', () => {
    expect(formatDoseRange(2, 2, 'metric', 'liquid')).toBe('2 ml/L');
  });

  it('renders whichever end was given on its own', () => {
    expect(formatDoseRange(2, null, 'metric', 'solid')).toBe('2 g/L');
    expect(formatDoseRange(null, 3, 'metric', 'solid')).toBe('3 g/L');
  });

  it('is null when neither end is set', () => {
    expect(formatDoseRange(null, null, 'metric', 'liquid')).toBeNull();
  });
});
