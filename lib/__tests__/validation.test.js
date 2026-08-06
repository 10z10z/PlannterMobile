import {
  LIMITS,
  choice,
  decimal,
  email,
  list,
  passthrough,
  secret,
  text,
  validate,
  validateField,
  whole,
} from '../validation';

describe('text', () => {
  const name = text({ label: 'Name', required: true });

  it('trims what it returns', () => {
    expect(name('  Basil  ')).toEqual({ value: 'Basil' });
  });

  it('treats whitespace as blank', () => {
    expect(name('   ').error).toBe('Name is required');
  });

  it('is null rather than an error when optional and blank', () => {
    expect(text({ label: 'Description' })('')).toEqual({ value: null });
    expect(text({ label: 'Description' })(null)).toEqual({ value: null });
  });

  it('caps length', () => {
    const long = 'a'.repeat(LIMITS.NAME + 1);
    expect(name(long).error).toBe(`Name must be ${LIMITS.NAME} characters or fewer`);
  });

  it('measures the trimmed length, not what was typed around it', () => {
    const atCap = ' ' + 'a'.repeat(LIMITS.NAME) + ' ';
    expect(name(atCap).error).toBeUndefined();
  });

  it('can insist on a minimum length', () => {
    expect(text({ label: 'Code', min: 4 })('ab').error).toBe('Code must be at least 4 characters');
    expect(text({ label: 'Code', min: 4 })('abcd')).toEqual({ value: 'abcd' });
  });
});

describe('decimal', () => {
  const humidity = decimal({ label: 'Humidity', min: 0, max: 100, unit: '%' });

  it('takes a comma as the decimal separator', () => {
    expect(humidity('62,5')).toEqual({ value: 62.5 });
  });

  it('reports a range with both ends as one sentence', () => {
    expect(humidity('120').error).toBe('Humidity must be between 0 and 100%');
    expect(humidity('-1').error).toBe('Humidity must be between 0 and 100%');
  });

  it('reports an open-ended range from the end that failed', () => {
    expect(decimal({ label: 'Wattage', min: 1 })('0').error).toBe('Wattage must be at least 1');
    expect(decimal({ label: 'Wattage', max: 2000 })('5000').error).toBe(
      'Wattage must be at most 2000'
    );
  });

  it('separates blank from unparseable', () => {
    expect(humidity('')).toEqual({ value: null });
    expect(humidity('wet').error).toBe('Humidity must be a number');
  });

  it('accepts the ends of the range', () => {
    expect(humidity('0')).toEqual({ value: 0 });
    expect(humidity('100')).toEqual({ value: 100 });
  });

  it('converts only after checking, so the message quotes what was typed', () => {
    const fahrenheit = decimal({
      label: 'Temperature',
      min: -4,
      max: 140,
      unit: '°F',
      transform: (value) => (value - 32) / 1.8,
    });
    expect(fahrenheit('212').error).toBe('Temperature must be between -4 and 140°F');
    expect(fahrenheit('68').value).toBeCloseTo(20, 6);
  });
});

describe('whole', () => {
  const rows = whole({ label: 'Rows', required: true, min: 1, max: LIMITS.GRID_SIDE });

  it('refuses a fraction rather than truncating it', () => {
    expect(rows('4.5').error).toBe('Rows must be a whole number');
  });

  it('holds the grid to a size that can be rendered', () => {
    expect(rows('999').error).toBe(`Rows must be between 1 and ${LIMITS.GRID_SIDE}`);
  });

  it('requires a value', () => {
    expect(rows('').error).toBe('Rows is required');
  });
});

describe('choice', () => {
  const environment = choice({
    label: 'Environment',
    options: [{ value: 'indoor' }, { value: 'outdoor' }],
  });

  it('takes a listed value', () => {
    expect(environment('indoor')).toEqual({ value: 'indoor' });
  });

  it('rejects anything else', () => {
    expect(environment('orbit').error).toBe('Environment is not one of the choices');
  });

  it('reads plain arrays as well as option objects', () => {
    expect(choice({ label: 'Unit', options: ['g', 'ml'] })('ml')).toEqual({ value: 'ml' });
  });
});

describe('passthrough', () => {
  it('carries a value through untouched', () => {
    expect(passthrough()('https://example.test/a.png')).toEqual({
      value: 'https://example.test/a.png',
    });
  });

  it('is null rather than undefined when unset', () => {
    expect(passthrough()(undefined)).toEqual({ value: null });
  });

  it('can still be required', () => {
    expect(passthrough({ required: true, label: 'A seed pack' })(null).error).toBe(
      'A seed pack is required'
    );
  });
});

describe('email', () => {
  const rule = email();

  it('takes an ordinary address', () => {
    expect(rule('grower@example.com')).toEqual({ value: 'grower@example.com' });
  });

  it('trims and lower-cases, so one person is one account', () => {
    expect(rule('  Grower@Example.COM ')).toEqual({ value: 'grower@example.com' });
  });

  it('catches the slips worth catching', () => {
    expect(rule('grower').error).toBe('That doesn’t look like an email address');
    expect(rule('grower@example').error).toBeTruthy();
    expect(rule('grower @example.com').error).toBeTruthy();
    expect(rule('grower@example.com,').error).toBeTruthy();
  });

  it('refuses one longer than anything will deliver to', () => {
    expect(rule(`${'a'.repeat(250)}@example.com`).error).toBeTruthy();
  });

  it('is required by default and optional on request', () => {
    expect(rule('').error).toBe('Email is required');
    expect(email({ required: false })('')).toEqual({ value: null });
  });
});

describe('secret', () => {
  it('does not trim, because a space is a character in a password', () => {
    expect(secret()(' hunter2 ')).toEqual({ value: ' hunter2 ' });
  });

  it('enforces a minimum where one is set', () => {
    expect(secret({ min: 8 })('short').error).toBe('Password must be at least 8 characters');
    expect(secret({ min: 8 })('longenough')).toEqual({ value: 'longenough' });
  });

  it('refuses one past the length the hash would ignore', () => {
    expect(secret()('a'.repeat(73)).error).toBe('Password must be 72 characters or fewer');
  });

  it('still insists on something', () => {
    expect(secret()('').error).toBe('Password is required');
  });
});

describe('list', () => {
  it('takes what was picked', () => {
    expect(list({ label: 'Plants' })(['a', 'b'])).toEqual({ value: ['a', 'b'] });
  });

  it('treats nothing as an empty list rather than an error', () => {
    expect(list({ label: 'Plants' })(undefined)).toEqual({ value: [] });
  });

  it('enforces a minimum, in the words the form wants', () => {
    const rule = list({ label: 'Fertilizers', min: 1, message: 'Pick at least one fertilizer' });
    expect(rule([]).error).toBe('Pick at least one fertilizer');
  });

  it('falls back to a plain message when none is given', () => {
    expect(list({ label: 'Plants', min: 2 })(['a']).error).toBe('Plants needs at least 2');
  });
});

describe('validate', () => {
  const schema = {
    name: text({ label: 'Name', required: true }),
    rows: whole({ label: 'Rows', required: true, min: 1, max: LIMITS.GRID_SIDE }),
    humidity: decimal({ label: 'Humidity', min: 0, max: 100, unit: '%' }),
  };

  it('returns cleaned values when everything passes', () => {
    const result = validate(schema, { name: ' Tray A ', rows: '4', humidity: '' });
    expect(result.ok).toBe(true);
    expect(result.values).toEqual({ name: 'Tray A', rows: 4, humidity: null });
    expect(result.errors).toEqual({});
  });

  it('reports every bad field at once, not the first', () => {
    const result = validate(schema, { name: '', rows: '0', humidity: '150' });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['humidity', 'name', 'rows']);
  });

  it('runs cross-field checks once the fields themselves parse', () => {
    const checks = [
      (values) =>
        values.rows > 10 ? { field: 'rows', message: 'That grid is bigger than the tent' } : null,
    ];
    const result = validate(schema, { name: 'Big', rows: '20', humidity: '' }, { checks });
    expect(result.errors.rows).toBe('That grid is bigger than the tent');
  });

  it('holds cross-field checks back while a field is unparseable', () => {
    const checks = [
      (values) => {
        // Would throw on undefined if it ran, which is the point.
        return values.rows.toString() === '4' ? null : { field: 'rows', message: 'never' };
      },
    ];
    expect(() =>
      validate(schema, { name: '', rows: 'abc', humidity: '' }, { checks })
    ).not.toThrow();
  });

  it('keeps the field-level message when a check names the same field', () => {
    const result = validate(schema, { name: 'x', rows: 'abc', humidity: '' });
    expect(result.errors.rows).toBe('Rows must be a whole number');
  });

  it('tolerates a missing values object', () => {
    expect(validate(schema, undefined).ok).toBe(false);
  });
});

describe('validateField', () => {
  const schema = { name: text({ label: 'Name', required: true }) };

  it('gives the message for one field', () => {
    expect(validateField(schema, 'name', '')).toBe('Name is required');
  });

  it('is empty when the field is fine', () => {
    expect(validateField(schema, 'name', 'Basil')).toBe('');
  });

  it('is empty for a field the schema does not describe', () => {
    expect(validateField(schema, 'nothing', 'x')).toBe('');
  });
});
