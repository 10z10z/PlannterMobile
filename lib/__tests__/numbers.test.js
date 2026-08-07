import { isUnparseable, parseDecimal, parseDecimalOrZero, parseWhole } from '../numbers';

describe('parseDecimal', () => {
  it('takes either decimal separator', () => {
    expect(parseDecimal('1.5')).toBe(1.5);
    expect(parseDecimal('1,5')).toBe(1.5);
  });

  it('ignores group separators', () => {
    expect(parseDecimal('1 234')).toBe(1234);
    expect(parseDecimal('1 234')).toBe(1234); // U+00A0, the non-breaking space
    expect(parseDecimal('1 234,5')).toBe(1234.5); // U+202F, the narrow one CLDR uses for fr and nb
    expect(parseDecimal("1'234")).toBe(1234);
  });

  it('reads the last separator as the decimal one when both appear', () => {
    expect(parseDecimal('1.234,5')).toBe(1234.5);
    expect(parseDecimal('1,234.5')).toBe(1234.5);
    expect(parseDecimal('1.234.567,8')).toBe(1234567.8);
    expect(parseDecimal('1,234,567.8')).toBe(1234567.8);
  });

  it('reads a lone comma as a decimal point', () => {
    expect(parseDecimal('1,234')).toBe(1.234);
  });

  it('is null for blank input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });

  it('is NaN for anything that is not a number', () => {
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('12abc')).toBeNaN();
    expect(parseDecimal('1.2.3')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
    expect(parseDecimal('-')).toBeNaN();
    expect(parseDecimal('.')).toBeNaN();
  });

  it('rejects what Number() would quietly accept', () => {
    expect(parseDecimal('0x10')).toBeNaN();
    expect(parseDecimal('1e3')).toBeNaN();
    expect(parseDecimal('Infinity')).toBeNaN();
    expect(parseDecimal('-Infinity')).toBeNaN();
  });

  it('normalises -0 to 0', () => {
    expect(Object.is(parseDecimal('-0'), 0)).toBe(true);
    expect(Object.is(parseDecimal('-0,0'), 0)).toBe(true);
  });

  it('takes signs and a bare decimal point either side', () => {
    expect(parseDecimal('+5')).toBe(5);
    expect(parseDecimal('-2,5')).toBe(-2.5);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('5.')).toBe(5);
  });

  it('passes numbers through, so a stored value can be re-checked', () => {
    expect(parseDecimal(20)).toBe(20);
    expect(parseDecimal(0)).toBe(0);
    expect(parseDecimal(Infinity)).toBeNaN();
    expect(parseDecimal(NaN)).toBeNaN();
  });
});

describe('parseWhole', () => {
  it('takes whole numbers', () => {
    expect(parseWhole('4')).toBe(4);
    expect(parseWhole('1 234')).toBe(1234);
    expect(parseWhole('-3')).toBe(-3);
  });

  it('is NaN for a fraction rather than truncating it', () => {
    expect(parseWhole('1,5')).toBeNaN();
    expect(parseWhole('4.2')).toBeNaN();
  });

  it('is NaN for trailing rubbish rather than stopping at it', () => {
    expect(parseWhole('4 trays')).toBeNaN();
    expect(parseWhole('12abc')).toBeNaN();
  });

  it('is null for blank input', () => {
    expect(parseWhole('')).toBeNull();
    expect(parseWhole(null)).toBeNull();
  });
});

describe('isUnparseable', () => {
  it('separates rubbish from blank', () => {
    expect(isUnparseable('abc')).toBe(true);
    expect(isUnparseable('')).toBe(false);
    expect(isUnparseable('1,5')).toBe(false);
  });
});

describe('parseDecimalOrZero', () => {
  it('reads a number the same way the rest of the module does', () => {
    expect(parseDecimalOrZero('1,5')).toBe(1.5);
    expect(parseDecimalOrZero('2.5')).toBe(2.5);
    expect(parseDecimalOrZero(3)).toBe(3);
  });

  it('collapses blank and rubbish to zero, which is what a live sum needs', () => {
    // The distinction the rest of this module keeps is exactly what a screen
    // recomputing on every keystroke can't use: "1." has to be worth something
    // while it is still being typed.
    expect(parseDecimalOrZero('')).toBe(0);
    expect(parseDecimalOrZero('1.')).toBe(1);
    expect(parseDecimalOrZero('abc')).toBe(0);
    expect(parseDecimalOrZero(null)).toBe(0);
    expect(parseDecimalOrZero(undefined)).toBe(0);
  });
});
