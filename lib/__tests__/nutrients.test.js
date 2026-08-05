import {
  WATER_PART_ID,
  macroBars,
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

/** A 10-5-20 liquid feed, the shape the fertilizer rows come back in. */
const feed = { id: 'feed', n: 10, p: 5, k: 20 };

describe('ppmFromDose', () => {
  it('converts label percentages to ppm at the given dose', () => {
    // percent * dose * 10, per the w/v assumption the module documents
    expect(ppmFromDose(feed, 2)).toMatchObject({ n: 200, p: 100, k: 400 });
  });

  it('totals the macros and estimates EC on the 700 scale', () => {
    const result = ppmFromDose(feed, 2);
    expect(result.macroTotal).toBe(700);
    expect(result.total).toBe(700);
    expect(result.ec).toBe(1);
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
    expect(ppmFromDose({ n: null, p: 'n/a', k: 20 }, 1)).toMatchObject({ n: 0, p: 0, k: 200 });
  });
});

describe('ppmFromMix', () => {
  it('adds up what each bottle contributes at its own dose', () => {
    const result = ppmFromMix([
      { fertilizer: { n: 10 }, dosePerLiter: 2 },
      { fertilizer: { n: 5, k: 10 }, dosePerLiter: 1 },
    ]);
    expect(result).toMatchObject({ n: 250, k: 100 });
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
    const [nitrogen] = macroBars(
      ppmFromMix(entries),
      'vegetative',
      mixParts(entries)
    );
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
    // 5-5-5 at 3.5 ml/L lands N and K dead centre of the vegetative bands
    expect(suggestedDose({ n: 5, p: 5, k: 5 }, 'vegetative')).toBe(3.5);
  });

  it('takes the stage into account', () => {
    const veg = suggestedDose(feed, 'vegetative');
    const germ = suggestedDose(feed, 'germination');
    expect(germ).toBeLessThan(veg);
  });

  it('lands the mix inside the bands it can reach', () => {
    const dose = suggestedDose({ n: 5, p: 5, k: 5 }, 'vegetative');
    const result = ppmFromDose({ n: 5, p: 5, k: 5 }, dose);
    expect(statusForValue(result.n, [150, 200])).toBe('on');
    expect(statusForValue(result.k, [150, 200])).toBe('on');
  });

  it('has nothing to suggest without a fertilizer, a stage, or any macros', () => {
    expect(suggestedDose(null, 'vegetative')).toBeNull();
    expect(suggestedDose(feed, 'dormant')).toBeNull();
    expect(suggestedDose({ ca: 10 }, 'vegetative')).toBeNull();
  });
});
