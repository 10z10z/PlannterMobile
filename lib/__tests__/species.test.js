import {
  DEFAULT_PHASES,
  SPECIES,
  SPECIES_KEYS,
  daysToNextPhase,
  phaseFor,
  speciesFor,
  speciesIcon,
  speciesLabel,
} from '../species';

describe('the guidelines themselves', () => {
  it('covers the crops the app offers', () => {
    expect(SPECIES_KEYS).toEqual([
      'pepper',
      'tomato',
      'cucumber',
      'basil',
      'arugula',
      'lettuce',
      'radish',
    ]);
  });

  it('starts every crop as a seedling', () => {
    for (const key of SPECIES_KEYS) {
      expect(SPECIES[key].phases[0].key).toBe('seedling');
    }
  });

  it('runs each crop through in order, with only the last phase open-ended', () => {
    for (const key of [...SPECIES_KEYS, 'default']) {
      const phases = key === 'default' ? DEFAULT_PHASES : SPECIES[key].phases;
      const bounded = phases.slice(0, -1);
      expect(bounded.every((phase) => phase.until !== undefined)).toBe(true);
      expect(phases[phases.length - 1].until).toBeUndefined();
      // Each phase ends after the one before it
      const days = bounded.map((phase) => phase.until);
      expect([...days].sort((a, b) => a - b)).toEqual(days);
    }
  });

  it('never sends a leaf or root crop into fruiting', () => {
    for (const key of ['arugula', 'lettuce', 'radish']) {
      const keys = SPECIES[key].phases.map((phase) => phase.key);
      expect(keys).not.toContain('fruiting');
      expect(keys[keys.length - 1]).toBe('harvest');
    }
  });
});

describe('speciesFor', () => {
  it('matches a crop by its own name', () => {
    expect(speciesFor('tomato').label).toBe('Tomato');
  });

  it('ignores case and surrounding whitespace', () => {
    expect(speciesFor('  TOMATO ').label).toBe('Tomato');
  });

  it('matches the plural a grower is likely to type', () => {
    expect(speciesFor('tomatoes').label).toBe('Tomato');
    expect(speciesFor('peppers').label).toBe('Pepper');
  });

  it('finds the crop inside a variety name', () => {
    expect(speciesFor('Cherry Tomato').label).toBe('Tomato');
    expect(speciesFor('Genovese basil').label).toBe('Basil');
  });

  it('does not match a word that merely contains a crop name', () => {
    expect(speciesFor('peppercorn')).toBeNull();
  });

  it('is null for an unknown or empty crop', () => {
    expect(speciesFor('kohlrabi')).toBeNull();
    expect(speciesFor('')).toBeNull();
    expect(speciesFor(null)).toBeNull();
  });
});

describe('speciesLabel', () => {
  it('gives a known crop its proper name', () => {
    expect(speciesLabel('cherry tomato')).toBe('Tomato');
  });

  it('passes an unknown crop through as typed', () => {
    expect(speciesLabel('Kohlrabi')).toBe('Kohlrabi');
  });

  it('is null when nothing was entered', () => {
    expect(speciesLabel(null)).toBeNull();
    expect(speciesLabel('')).toBeNull();
  });
});

describe('speciesIcon', () => {
  it('gives a known crop its own icon and everything else a leaf', () => {
    expect(speciesIcon('radish')).toBe('carrot');
    expect(speciesIcon('kohlrabi')).toBe('leaf');
  });
});

describe('phaseFor', () => {
  it('walks a pepper through its phases', () => {
    expect(phaseFor('pepper', 5).key).toBe('seedling');
    expect(phaseFor('pepper', 40).key).toBe('vegetative');
    expect(phaseFor('pepper', 80).key).toBe('flowering');
    expect(phaseFor('pepper', 200).key).toBe('fruiting');
  });

  it('changes phase on the threshold day, not after it', () => {
    expect(phaseFor('pepper', 29).key).toBe('seedling');
    expect(phaseFor('pepper', 30).key).toBe('vegetative');
  });

  it('ends a radish at harvest rather than in flower', () => {
    expect(phaseFor('radish', 30).key).toBe('harvest');
  });

  it('reads an unknown crop against the default guidelines', () => {
    expect(phaseFor('kohlrabi', 5).key).toBe('seedling');
    expect(phaseFor('kohlrabi', 50).key).toBe('vegetative');
  });

  it('carries the label to show', () => {
    expect(phaseFor('lettuce', 50).label).toBe('Ready to harvest');
  });

  it('says nothing when there is no germination date to count from', () => {
    expect(phaseFor('pepper', null)).toBeNull();
    expect(phaseFor('pepper', undefined)).toBeNull();
  });

  it('says nothing rather than guessing for a negative count', () => {
    expect(phaseFor('pepper', -1)).toBeNull();
  });
});

describe('daysToNextPhase', () => {
  it('counts down to the next phase', () => {
    expect(daysToNextPhase('pepper', 20)).toBe(10);
    expect(daysToNextPhase('pepper', 29)).toBe(1);
  });

  it('is null on the last phase, which has nothing to count towards', () => {
    expect(daysToNextPhase('pepper', 200)).toBeNull();
    expect(daysToNextPhase('radish', 40)).toBeNull();
  });

  it('is null without a germination date', () => {
    expect(daysToNextPhase('pepper', null)).toBeNull();
  });
});
