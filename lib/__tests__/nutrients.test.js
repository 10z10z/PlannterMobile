import {
  DEFAULT_NUTRIENT_PPM_PER_EC,
  WATER_PART_ID,
  calibrationFactor,
  ecFromMeterPpm,
  estimateEc,
  macroBars,
  meterPpmFor,
  microBars,
  mixParts,
  perLiterDose,
  ppmFromDose,
  ppmFromMix,
  statusForValue,
  suggestedDose,
  waterContribution,
  waterFromReport,
} from '../nutrients';

/**
 * A 10-5-20 liquid feed as the label prints it: 10% N, 5% P₂O₅, 20% K₂O — which
 * is the shape the fertilizer rows come back in, since that is what gets typed.
 */
const feed = { id: 'feed', n: 10, p: 5, k: 20 };

describe('ppmFromDose', () => {
  it('converts label percentages to ppm at the given dose', () => {
    // percent * dose * 10, per the w/v assumption the module documents.
    // Nitrogen is quoted as the element and goes straight through: 10 * 2 * 10.
    expect(ppmFromDose(feed, 2).n).toBe(200);
  });

  it('brings phosphorus and potassium back from the oxides the label quotes', () => {
    const result = ppmFromDose(feed, 2);

    // 5% P₂O₅ is 5 * 0.4364 = 2.182% actual phosphorus, so 43.64 ppm rather
    // than the 100 that reading the label figure as elemental would give.
    expect(result.p).toBeCloseTo(43.64, 2);
    // 20% K₂O is 20 * 0.8301 = 16.603% potassium.
    expect(result.k).toBeCloseTo(332.06, 2);
  });

  it('totals the macros', () => {
    const result = ppmFromDose(feed, 2);
    expect(result.macroTotal).toBeCloseTo(575.7, 2);
    expect(result.total).toBeCloseTo(575.7, 2);
  });

  it('keeps micros to three decimals so trace elements survive rounding', () => {
    // 0.0005% at 1 ml/L is 0.005 ppm — two decimals would double it to 0.01
    expect(ppmFromDose({ mo: 0.0005 }, 1).micros.mo).toBe(0.005);
  });

  it('treats a missing, zero or negative dose as nothing added', () => {
    expect(ppmFromDose(feed, 0).total).toBe(0);
    expect(ppmFromDose(feed, -5).total).toBe(0);
    expect(ppmFromDose(feed, undefined).total).toBe(0);
  });

  it('treats absent or unparseable nutrient columns as zero', () => {
    const result = ppmFromDose({ n: null, p: 'n/a', k: 20 }, 1);
    expect(result).toMatchObject({ n: 0, p: 0 });
    expect(result.k).toBeCloseTo(166.03, 2);
  });
});

describe('ppmFromMix', () => {
  it('adds up what each bottle contributes at its own dose', () => {
    const result = ppmFromMix([
      { fertilizer: { n: 10 }, dosePerLiter: 2 },
      { fertilizer: { n: 5, k: 10 }, dosePerLiter: 1 },
    ]);
    expect(result.n).toBe(250);
    expect(result.k).toBeCloseTo(83.02, 2);
  });

  it('counts Ca and Mg already in the source water', () => {
    const result = ppmFromMix([{ fertilizer: { ca: 1 }, dosePerLiter: 1 }], { ca: 40, mg: 12 });
    expect(result.micros.ca).toBe(50); // 40 from the tap + 10 from the bottle
    expect(result.micros.mg).toBe(12);
  });

  it('is all zeroes for an empty tank', () => {
    expect(ppmFromMix([], null).total).toBe(0);
    expect(ppmFromMix(undefined, undefined).total).toBe(0);
  });
});

describe('waterContribution', () => {
  it('splits a hardness reading into calcium and magnesium', () => {
    // 100 ppm as CaCO3, three quarters of it calcium, by their molar masses
    const water = waterContribution(100);
    expect(water.ca).toBeCloseTo(30.033, 3);
    expect(water.mg).toBeCloseTo(6.072, 3);
  });

  it('yields less than the reading, since carbonate is not a nutrient', () => {
    const water = waterContribution(200);
    expect(water.ca + water.mg).toBeLessThan(200);
  });

  it('is null for soft, unset or unparseable water', () => {
    expect(waterContribution(0)).toBeNull();
    expect(waterContribution(-10)).toBeNull();
    expect(waterContribution(null)).toBeNull();
    expect(waterContribution('soft')).toBeNull();
  });
});

describe('waterFromReport', () => {
  it('takes lab figures as given', () => {
    expect(waterFromReport(38, 9)).toEqual({ ca: 38, mg: 9 });
  });

  it('fills in the figure that was left out', () => {
    expect(waterFromReport(38, undefined)).toEqual({ ca: 38, mg: 0 });
  });

  it('clamps negatives away rather than subtracting from the mix', () => {
    expect(waterFromReport(-5, 9)).toEqual({ ca: 0, mg: 9 });
  });

  it('is null when the report says nothing', () => {
    expect(waterFromReport(0, 0)).toBeNull();
    expect(waterFromReport(null, null)).toBeNull();
  });
});

describe('perLiterDose', () => {
  it('spreads a total amount over the tank volume', () => {
    expect(perLiterDose(10, 4)).toBe(2.5);
  });

  it('is zero when the volume is missing or empty', () => {
    expect(perLiterDose(10, 0)).toBe(0);
    expect(perLiterDose(10, null)).toBe(0);
    expect(perLiterDose('some', 4)).toBe(0);
  });
});

describe('meter scales', () => {
  it('reads a meter’s ppm back as the conductivity it measured', () => {
    // The same beaker, two meters: 690 on a 500-scale meter is a far stronger
    // solution than 690 on a 700-scale one.
    expect(ecFromMeterPpm(690, 500)).toBeCloseTo(1.38, 2);
    expect(ecFromMeterPpm(690, 700)).toBeCloseTo(0.986, 3);
  });

  it('says what a meter should show for a given conductivity', () => {
    expect(meterPpmFor(1.38, 500)).toBe(690);
    expect(meterPpmFor(1, 700)).toBe(700);
  });

  it('has no answer for a reading or a scale that isn’t one', () => {
    expect(ecFromMeterPpm(0, 500)).toBeNull();
    expect(ecFromMeterPpm(690, 0)).toBeNull();
    expect(ecFromMeterPpm('', 500)).toBeNull();
    expect(meterPpmFor(-1, 500)).toBeNull();
  });
});

describe('calibrationFactor', () => {
  it('derives the grower’s own nutrient ppm per mS/cm from one measured batch', () => {
    // The app worked the tank out at 525 ppm of nutrient; the meter said EC
    // 1.29. Everything unaccounted for — the counter-ions, the tap, the meter's
    // own scale — is absorbed into the one ratio.
    expect(calibrationFactor(525, 1.29)).toBeCloseTo(407, 0);
  });

  it('leaves the default alone when half the form is filled in', () => {
    expect(calibrationFactor(525, null)).toBeNull();
    expect(calibrationFactor(0, 1.29)).toBeNull();
    expect(calibrationFactor(525, 0)).toBeNull();
  });
});

describe('estimateEc', () => {
  it('turns nutrient ppm into a conductivity on the calibrated factor', () => {
    expect(estimateEc(420, 420)).toBe(1);
    expect(estimateEc(525, 407)).toBeCloseTo(1.29, 2);
  });

  it('falls back to the uncalibrated figure', () => {
    expect(estimateEc(DEFAULT_NUTRIENT_PPM_PER_EC)).toBe(1);
  });

  it('is zero for an empty tank or a nonsense factor', () => {
    expect(estimateEc(0, 420)).toBe(0);
    expect(estimateEc(420, 0)).toBe(0);
  });

  it('round-trips a measurement back to the reading it came from', () => {
    // Calibrate on one batch, and that batch's predicted meter reading is the
    // one that was typed in — which is the least a calibration should do.
    const factor = calibrationFactor(525, ecFromMeterPpm(690, 500));
    expect(meterPpmFor(estimateEc(525, factor), 500)).toBe(690);
  });
});

describe('statusForValue', () => {
  it('reads a value against its band, with the bounds counting as on target', () => {
    expect(statusForValue(40, [50, 70])).toBe('below');
    expect(statusForValue(50, [50, 70])).toBe('on');
    expect(statusForValue(70, [50, 70])).toBe('on');
    expect(statusForValue(71, [50, 70])).toBe('above');
  });
});

describe('macroBars', () => {
  it('places the value and the target zone on the bar', () => {
    const [nitrogen] = macroBars(ppmFromDose(feed, 1), 'vegetative', []);
    expect(nitrogen).toMatchObject({
      key: 'n',
      value: 100,
      min: 150,
      max: 200,
      status: 'below',
      fillPct: (100 / 300) * 100, // n's bar runs to 300 ppm
      zoneLeftPct: 50,
    });
  });

  it('clips the fill when the mix overshoots the scale', () => {
    const [nitrogen] = macroBars(ppmFromDose(feed, 10), 'vegetative', []);
    expect(nitrogen.value).toBe(1000);
    expect(nitrogen.fillPct).toBe(100);
  });

  it('breaks the bar into one segment per contributing bottle', () => {
    const entries = [
      { fertilizer: { id: 'a', n: 10 }, dosePerLiter: 1 },
      { fertilizer: { id: 'b', n: 5 }, dosePerLiter: 1 },
    ];
    const [nitrogen] = macroBars(ppmFromMix(entries), 'vegetative', mixParts(entries));
    expect(nitrogen.segments.map((s) => s.id)).toEqual(['a', 'b']);
    // the segments tile the fill rather than each starting from zero
    const width = nitrogen.segments.reduce((sum, s) => sum + s.widthPct, 0);
    expect(width).toBeCloseTo(nitrogen.fillPct, 6);
  });

  it('leaves out bottles that contribute nothing to this nutrient', () => {
    const entries = [
      { fertilizer: { id: 'a', n: 10 }, dosePerLiter: 1 },
      { fertilizer: { id: 'cal-mag', ca: 10 }, dosePerLiter: 1 },
    ];
    const [nitrogen] = macroBars(ppmFromMix(entries), 'vegetative', mixParts(entries));
    expect(nitrogen.segments.map((s) => s.id)).toEqual(['a']);
  });

  it('is empty for an unknown stage', () => {
    expect(macroBars(ppmFromDose(feed, 1), 'dormant', [])).toEqual([]);
  });
});

describe('microBars', () => {
  it('reads the trace figures and keeps a visible zone for narrow bands', () => {
    const bars = microBars(ppmFromDose({ ca: 15, mo: 0.01 }, 1), []);
    const calcium = bars.find((bar) => bar.key === 'ca');
    const molybdenum = bars.find((bar) => bar.key === 'mo');

    expect(calcium).toMatchObject({ value: 150, status: 'on' });
    expect(molybdenum.value).toBe(0.1);
    expect(molybdenum.status).toBe('above');
    expect(molybdenum.zoneWidthPct).toBeGreaterThanOrEqual(2);
  });
});

describe('mixParts', () => {
  it('lists the source water first, then each bottle in mix order', () => {
    const parts = mixParts(
      [
        { fertilizer: { id: 'a', n: 10 }, dosePerLiter: 1 },
        { fertilizer: { id: 'b', k: 10 }, dosePerLiter: 1 },
      ],
      { ca: 40 }
    );
    expect(parts.map((part) => part.id)).toEqual([WATER_PART_ID, 'a', 'b']);
    expect(parts[0].result.micros.ca).toBe(40);
  });

  it('omits the water part when the tap contributes nothing', () => {
    const parts = mixParts([{ fertilizer: { id: 'a', n: 10 }, dosePerLiter: 1 }], null);
    expect(parts.map((part) => part.id)).toEqual(['a']);
  });
});

describe('suggestedDose', () => {
  it('picks the dose that best satisfies every macro at once', () => {
    // 5-5-5 at 3.5 ml/L puts N dead centre of the vegetative band and gets as
    // close on the other two as one dose can — no dose satisfies all three,
    // which is the whole reason the candidates are scored against each other.
    expect(suggestedDose({ n: 5, p: 5, k: 5 }, 'vegetative')).toBe(3.5);
  });

  it('takes the stage into account', () => {
    const veg = suggestedDose(feed, 'vegetative');
    const germ = suggestedDose(feed, 'germination');
    expect(germ).toBeLessThan(veg);
  });

  it('lands the mix inside the bands it can reach', () => {
    // The vegetative bands want equal N and K in the water, which on a label
    // means roughly 10 parts N to 12 parts K₂O — a bag reading 10-5-10 is
    // already short on potassium once the oxide is taken off it.
    const balanced = { n: 10, p: 5, k: 12 };
    const dose = suggestedDose(balanced, 'vegetative');
    const result = ppmFromDose(balanced, dose);

    expect(statusForValue(result.n, [150, 200])).toBe('on');
    expect(statusForValue(result.k, [150, 200])).toBe('on');
  });

  it('has nothing to suggest without a fertilizer, a stage, or any macros', () => {
    expect(suggestedDose(null, 'vegetative')).toBeNull();
    expect(suggestedDose(feed, 'dormant')).toBeNull();
    expect(suggestedDose({ ca: 10 }, 'vegetative')).toBeNull();
  });
});
