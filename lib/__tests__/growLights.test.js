jest.mock('../supabase', () => ({ supabase: {} }));

import {
  assignmentSummary,
  assignmentTitle,
  lightSpecs,
  lightTypeLabel,
  photoperiodLabel,
  spectrumLabel,
} from '../growLights';

/** A well-documented LED panel, the kind that publishes every figure. */
const panel = {
  name: 'Mars TS 1000',
  type: 'led',
  watts: 150,
  color_temp_k: 3500,
  spectrum: 'full',
  ppf_umol_s: 300,
  efficacy_umol_j: 2.1,
  ppfd_umol_m2_s: 600,
  ppfd_distance_cm: 45,
};

describe('photoperiodLabel', () => {
  it('reads hours lit against hours dark', () => {
    expect(photoperiodLabel(18)).toBe('18/6');
    expect(photoperiodLabel(12)).toBe('12/12');
  });

  it('keeps a half hour on both sides', () => {
    expect(photoperiodLabel(18.5)).toBe('18.5/5.5');
  });

  it('treats round-the-clock as a real cycle rather than as unset', () => {
    expect(photoperiodLabel(24)).toBe('24/0');
  });

  it('treats never-on as a real answer too', () => {
    expect(photoperiodLabel(0)).toBe('0/24');
  });

  it('is null when no cycle has been set', () => {
    expect(photoperiodLabel(null)).toBeNull();
    expect(photoperiodLabel(undefined)).toBeNull();
    expect(photoperiodLabel('')).toBeNull();
  });

  it('refuses a figure that is not a day', () => {
    expect(photoperiodLabel(25)).toBeNull();
    expect(photoperiodLabel(-1)).toBeNull();
  });
});

describe('lightSpecs', () => {
  it('takes the most useful figures first', () => {
    expect(lightSpecs(panel)).toEqual([
      '150 W',
      '3500K',
      'Full spectrum',
      '600 PPFD @ 45cm',
    ]);
  });

  it('caps the list so a row stays a summary, not a spec sheet', () => {
    expect(lightSpecs(panel, { limit: 2 })).toEqual(['150 W', '3500K']);
  });

  it('leaves out what a cheap fixture never published', () => {
    expect(lightSpecs({ type: 'led', watts: 45 })).toEqual(['45 W']);
  });

  it('hides colour temperature for lamps whose chemistry fixes it', () => {
    // an HPS is always about 2000K, so a stored figure there is meaningless
    const hps = { type: 'hps', watts: 600, color_temp_k: 2000 };
    expect(lightSpecs(hps)).toEqual(['600 W']);
  });

  it('drops PPFD when the distance it was measured at is missing', () => {
    const vague = { type: 'led', ppfd_umol_m2_s: 600 };
    expect(lightSpecs(vague)).toEqual([]);
  });

  it('is empty for a fixture that says nothing about itself', () => {
    expect(lightSpecs({ type: 'led' })).toEqual([]);
    expect(lightSpecs(null)).toEqual([]);
  });
});

describe('assignmentTitle', () => {
  it('counts the fixtures and names them', () => {
    expect(assignmentTitle({ quantity: 2, light: panel })).toBe('2 x Mars TS 1000');
  });

  it('falls back to the fixture type when the group was never named', () => {
    expect(assignmentTitle({ quantity: 1, light: { type: 't5' } })).toBe('1 x T5');
  });
});

describe('assignmentSummary', () => {
  it('leads with the run cycle, then the figures that matter', () => {
    const summary = assignmentSummary({ quantity: 2, hours_on: 18, light: panel });
    expect(summary).toBe('18/6 h · 150 W · 3500K · Full spectrum');
  });

  it('drops the cycle when none has been set', () => {
    expect(assignmentSummary({ quantity: 1, light: panel })).toBe(
      '150 W · 3500K · Full spectrum'
    );
  });

  it('is the cycle alone for a fixture with no published figures', () => {
    expect(assignmentSummary({ quantity: 1, hours_on: 16, light: { type: 'led' } })).toBe(
      '16/8 h'
    );
  });

  it('is empty when there is nothing to say', () => {
    expect(assignmentSummary({ quantity: 1, light: { type: 'led' } })).toBe('');
  });
});

describe('the label helpers', () => {
  it('names types and spectrums', () => {
    expect(lightTypeLabel('cmh')).toBe('CMH/LEC');
    expect(lightTypeLabel(undefined)).toBe('LED');
    expect(spectrumLabel('bloom')).toBe('Bloom');
    expect(spectrumLabel(null)).toBeNull();
  });
});
