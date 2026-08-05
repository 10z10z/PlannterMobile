import {
  COLOR_SCHEMES,
  DEFAULT_SCHEME,
  navigationColors,
  normalizeScheme,
  schemeColors,
  schemeOf,
  schemeSwatch,
} from '../themes';

/**
 * Every colour role Paper's own MD3 theme carries, which each scheme has to
 * fill or the components reading it come out undefined.
 *
 * Written out rather than read off `MD3LightTheme`: Paper can't be imported in
 * this test environment, which has no react-native-web to resolve. If a Paper
 * upgrade adds a role, this list is where it gets noticed.
 */
const ROLES = [
  'primary', 'primaryContainer', 'secondary', 'secondaryContainer',
  'tertiary', 'tertiaryContainer', 'surface', 'surfaceVariant', 'surfaceDisabled',
  'background', 'error', 'errorContainer', 'onPrimary', 'onPrimaryContainer',
  'onSecondary', 'onSecondaryContainer', 'onTertiary', 'onTertiaryContainer',
  'onSurface', 'onSurfaceVariant', 'onSurfaceDisabled', 'onError', 'onErrorContainer',
  'onBackground', 'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface',
  'inversePrimary', 'shadow', 'scrim', 'backdrop',
];
const ELEVATIONS = ['level0', 'level1', 'level2', 'level3', 'level4', 'level5'];

/** Rough perceived lightness of a `#rrggbb`, 0 to 1. */
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const isColor = (value) =>
  /^#[0-9a-f]{6}$/i.test(value) ||
  /^rgb\(\d+, \d+, \d+\)$/.test(value) ||
  /^rgba\(\d+, \d+, \d+, [\d.]+\)$/.test(value) ||
  value === 'transparent';

describe('the six schemes', () => {
  it('is six of them, each named once', () => {
    expect(COLOR_SCHEMES).toHaveLength(6);
    expect(new Set(COLOR_SCHEMES.map((scheme) => scheme.value)).size).toBe(6);
    expect(COLOR_SCHEMES.every((scheme) => scheme.label && scheme.blurb)).toBe(true);
  });

  it('opens on the app’s own colours', () => {
    expect(DEFAULT_SCHEME).toBe('plannter');
    expect(schemeOf(DEFAULT_SCHEME).label).toBe('Plannter');
  });

  it.each(COLOR_SCHEMES.map((scheme) => [scheme.value]))(
    '%s fills every role Paper asks for, light and dark',
    (value) => {
      for (const isDark of [false, true]) {
        const colors = schemeColors(value, isDark);
        for (const role of ROLES) {
          expect(isColor(colors[role])).toBe(true);
        }
        expect(Object.keys(colors.elevation)).toEqual(ELEVATIONS);
        for (const level of ELEVATIONS) {
          expect(isColor(colors.elevation[level])).toBe(true);
        }
      }
    }
  );

  it.each(COLOR_SCHEMES.map((scheme) => [scheme.value]))(
    '%s reads dark as dark and light as light',
    (value) => {
      const light = schemeColors(value, false);
      const dark = schemeColors(value, true);

      // The claim a dark scheme makes: the surface is the dark one, and the
      // writing over it is not.
      expect(luminance(dark.surface)).toBeLessThan(luminance(light.surface));
      expect(luminance(dark.onSurface)).toBeGreaterThan(luminance(dark.surface));
      expect(luminance(light.onSurface)).toBeLessThan(luminance(light.surface));
    }
  );

  it.each(COLOR_SCHEMES.map((scheme) => [scheme.value]))(
    '%s writes on its containers in something that can be read',
    (value) => {
      // Not a contrast-ratio audit — the tones come from Material's own maths.
      // This only catches a pair that ended up on the same side of the middle.
      for (const isDark of [false, true]) {
        const colors = schemeColors(value, isDark);
        for (const role of ['Primary', 'Secondary', 'Tertiary', 'Error']) {
          const base = role.toLowerCase();
          expect(
            Math.abs(luminance(colors[base]) - luminance(colors[`on${role}`]))
          ).toBeGreaterThan(0.25);
        }
      }
    }
  );

  it.each(COLOR_SCHEMES.map((scheme) => [scheme.value]))(
    '%s keeps its three accents apart',
    (value) => {
      for (const isDark of [false, true]) {
        const swatch = schemeSwatch(value, isDark);
        expect(new Set(swatch).size).toBe(3);
      }
    }
  );

  it('differs from every other scheme in the primary it wears', () => {
    const primaries = COLOR_SCHEMES.map((scheme) => scheme.light.primary);
    expect(new Set(primaries).size).toBe(6);
  });

  it('carries nothing beyond those roles, light or dark', () => {
    for (const scheme of COLOR_SCHEMES) {
      for (const isDark of [false, true]) {
        expect(Object.keys(schemeColors(scheme.value, isDark)).sort()).toEqual(
          [...ROLES, 'elevation'].sort()
        );
      }
    }
  });
});

describe('normalizeScheme', () => {
  it('keeps a scheme it knows', () => {
    expect(normalizeScheme('terracotta')).toBe('terracotta');
  });

  it('falls back for anything else, including nothing', () => {
    expect(normalizeScheme('chartreuse')).toBe(DEFAULT_SCHEME);
    expect(normalizeScheme(undefined)).toBe(DEFAULT_SCHEME);
    expect(normalizeScheme(null)).toBe(DEFAULT_SCHEME);
  });
});

describe('navigationColors', () => {
  it('hands the navigator the scheme it is being drawn beside', () => {
    const nav = navigationColors('plum', true);
    const colors = schemeColors('plum', true);
    expect(nav.primary).toBe(colors.primary);
    expect(nav.background).toBe(colors.background);
    expect(nav.card).toBe(colors.elevation.level2);
    expect(nav.text).toBe(colors.onSurface);
  });

  it('answers for an unknown scheme rather than throwing', () => {
    expect(navigationColors('nonsense', false).primary).toBe(
      schemeColors(DEFAULT_SCHEME, false).primary
    );
  });
});
