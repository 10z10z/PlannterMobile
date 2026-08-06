import {
  RANGES,
  cellSchema,
  containerSchema,
  containersFitSeedlingsCheck,
  doseKey,
  doseRangeCheck,
  feedingPlantsCheck,
  feedingSchema,
  fertilizerSchema,
  germinationWindowCheck,
  gridSchema,
  gridSizeCheck,
  growLightSchema,
  growspaceSchema,
  loginSchema,
  mediumSchema,
  phRangeCheck,
  plantSchema,
  scheduledActionSchema,
  seedPackSchema,
  seedsAvailableCheck,
  signupSchema,
  sowingSchema,
  sowingTargetCheck,
  stationSchema,
  subjectCheck,
  targetsRequiredCheck,
  transplantSchema,
  traySchema,
} from '../schemas';
import { LIMITS, validate } from '../validation';

describe('growspaceSchema', () => {
  const metric = growspaceSchema('metric');

  const filled = {
    name: 'Tent',
    description: '',
    environment: 'indoor',
    temp: '22',
    humidity: '60',
    sunHours: '',
  };

  it('accepts an ordinary tent', () => {
    const result = validate(metric, filled);
    expect(result.ok).toBe(true);
    expect(result.values.temp).toBe(22);
    expect(result.values.humidity).toBe(60);
    expect(result.values.sunHours).toBeNull();
  });

  it('holds humidity to a percentage', () => {
    expect(validate(metric, { ...filled, humidity: '150' }).errors.humidity).toBe(
      'Humidity must be between 0 and 100%'
    );
  });

  it('holds sun to the hours in a day', () => {
    expect(validate(metric, { ...filled, sunHours: '30' }).errors.sunHours).toBe(
      'Hours of direct sun must be between 0 and 24'
    );
  });

  it('quotes the range in the unit the field is labelled with', () => {
    const imperial = growspaceSchema('imperial');
    expect(validate(imperial, { ...filled, temp: '300' }).errors.temp).toBe(
      `Temperature must be between ${RANGES.TEMP_F.min} and ${RANGES.TEMP_F.max}°F`
    );
  });

  it('takes a Fahrenheit reading that is fine and stores it in Celsius', () => {
    const imperial = growspaceSchema('imperial');
    const result = validate(imperial, { ...filled, temp: '72' });
    expect(result.ok).toBe(true);
    expect(result.values.temp).toBeCloseTo(22.22, 1);
  });

  it('rejects an unlisted environment', () => {
    expect(validate(metric, { ...filled, environment: 'orbit' }).ok).toBe(false);
  });
});

describe('grid limits', () => {
  it('refuses the grid that locks the app', () => {
    const result = validate(gridSchema, { name: 'Main', grid_rows: '999', grid_cols: '999' });
    expect(result.ok).toBe(false);
    expect(result.errors.grid_rows).toBe(`Rows must be between 1 and ${LIMITS.GRID_SIDE}`);
    expect(result.errors.grid_cols).toBe(`Columns must be between 1 and ${LIMITS.GRID_SIDE}`);
  });

  it('refuses a grid whose sides pass but whose area does not', () => {
    const result = validate(
      gridSchema,
      { name: 'Main', grid_rows: '50', grid_cols: '50' },
      { checks: [gridSizeCheck()] }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.grid_cols).toBe(
      `That is 2500 cells — ${LIMITS.GRID_CELLS} is the most that can be drawn`
    );
  });

  it('still fits the largest plug tray sold', () => {
    const result = validate(
      gridSchema,
      { name: '288-cell', grid_rows: '12', grid_cols: '24' },
      { checks: [gridSizeCheck()] }
    );
    expect(result.ok).toBe(true);
  });

  it('needs a name on every grid', () => {
    const result = validate(gridSchema, { name: '  ', grid_rows: '4', grid_cols: '4' });
    expect(result.errors.name).toBe('Grid name is required');
  });
});

describe('traySchema', () => {
  it('takes a tray', () => {
    const result = validate(traySchema, {
      name: 'Plug tray',
      image_url: null,
      grid_rows: '6',
      grid_cols: '12',
      cell_volume_ml: '35',
      quantity: '2',
    });
    expect(result.ok).toBe(true);
    expect(result.values.quantity).toBe(2);
  });

  it('will not take half a tray', () => {
    const result = validate(traySchema, {
      name: 'Plug tray',
      grid_rows: '6',
      grid_cols: '12',
      quantity: '1.5',
    });
    expect(result.errors.quantity).toBe('Quantity must be a whole number');
  });

  it('will not take none of one', () => {
    const result = validate(traySchema, {
      name: 'Plug tray',
      grid_rows: '6',
      grid_cols: '12',
      quantity: '0',
    });
    expect(result.errors.quantity).toBe(`Quantity must be between 1 and ${LIMITS.QUANTITY}`);
  });
});

describe('containerSchema', () => {
  it('needs a volume that is more than nothing', () => {
    const result = validate(containerSchema('metric'), {
      material: 'plastic',
      volume_liters: '0',
      quantity: '6',
    });
    expect(result.errors.volume_liters).toBeTruthy();
  });

  it('converts gallons to litres', () => {
    const result = validate(containerSchema('imperial'), {
      material: 'fabric',
      volume_liters: '3',
      quantity: '6',
    });
    expect(result.ok).toBe(true);
    expect(result.values.volume_liters).toBeCloseTo(11.356, 2);
  });
});

describe('seedPackSchema', () => {
  const filled = {
    name: 'Cherokee Purple',
    plant_type: 'Tomato',
    germination_days_min: '7',
    germination_days_max: '14',
    seed_count: '25',
  };

  it('takes a pack', () => {
    expect(validate(seedPackSchema, filled).ok).toBe(true);
  });

  it('refuses a germination window that runs backwards', () => {
    const result = validate(
      seedPackSchema,
      { ...filled, germination_days_min: '20' },
      { checks: [germinationWindowCheck] }
    );
    expect(result.errors.germination_days_max).toBe(
      'The longest germination time cannot be shorter than the shortest'
    );
  });

  it('leaves a half-given window alone', () => {
    const result = validate(
      seedPackSchema,
      { ...filled, germination_days_max: '' },
      { checks: [germinationWindowCheck] }
    );
    expect(result.ok).toBe(true);
  });

  it('allows a bulk count of seeds', () => {
    expect(validate(seedPackSchema, { ...filled, seed_count: '10000' }).ok).toBe(true);
  });
});

describe('mediumSchema', () => {
  const schema = mediumSchema('metric', ['n', 'p', 'k']);

  it('holds nutrient percentages to a percentage', () => {
    const result = validate(schema, { name: 'Coco', quantity: '1', n: '150' });
    expect(result.errors.n).toBe('N must be between 0 and 100%');
  });

  it('holds pH to the scale', () => {
    const result = validate(schema, { name: 'Coco', quantity: '1', ph_min: '20' });
    expect(result.errors.ph_min).toBe('Minimum pH must be between 0 and 14');
  });

  it('refuses a pH range that runs backwards', () => {
    const result = validate(
      schema,
      { name: 'Coco', quantity: '1', ph_min: '7', ph_max: '5' },
      { checks: [phRangeCheck] }
    );
    expect(result.errors.ph_max).toBe('The top of the pH range cannot be below the bottom');
  });

  it('leaves a half-given pH range alone', () => {
    const onlyBottom = validate(
      schema,
      { name: 'Coco', quantity: '1', ph_min: '5', ph_max: '' },
      { checks: [phRangeCheck] }
    );
    expect(onlyBottom.ok).toBe(true);

    const neither = validate(schema, { name: 'Coco', quantity: '1' }, { checks: [phRangeCheck] });
    expect(neither.ok).toBe(true);
  });
});

describe('growLightSchema', () => {
  const schema = growLightSchema('metric');
  const filled = { name: 'Bar light', type: 'led', quantity: '2' };

  it('takes a fixture', () => {
    expect(validate(schema, filled).ok).toBe(true);
  });

  it('refuses a colour temperature nothing emits at', () => {
    expect(validate(schema, { ...filled, color_temp_k: '40000' }).errors.color_temp_k).toBe(
      `Colour temperature must be between ${RANGES.COLOR_TEMP_K.min} and ${RANGES.COLOR_TEMP_K.max} K`
    );
  });

  it('refuses an efficacy physics does not allow', () => {
    expect(validate(schema, { ...filled, efficacy_umol_j: '35' }).errors.efficacy_umol_j).toBe(
      `Efficacy must be between ${RANGES.EFFICACY.min} and ${RANGES.EFFICACY.max}`
    );
  });

  it('caps the IP rating at something rating-shaped', () => {
    expect(validate(schema, { ...filled, ip_rating: 'IP65 or thereabouts, maybe' }).ok).toBe(false);
  });
});

describe('the length fields on a grow light', () => {
  it('converts a hanging distance typed in inches', () => {
    const result = validate(growLightSchema('imperial'), {
      name: 'Bar light',
      type: 'led',
      quantity: '1',
      ppfd_distance_cm: '12',
    });
    expect(result.ok).toBe(true);
    expect(result.values.ppfd_distance_cm).toBeCloseTo(30.48, 2);
  });

  it('caps a coverage figure in whichever unit it was typed', () => {
    expect(
      validate(growLightSchema('imperial'), {
        name: 'Bar light',
        type: 'led',
        quantity: '1',
        coverage_width_cm: '500',
      }).errors.coverage_width_cm
    ).toBeTruthy();
  });
});

describe('stationSchema', () => {
  it('holds a propagator to the same humidity range as a tent', () => {
    const result = validate(stationSchema('metric'), {
      name: 'Heat mat',
      environment: 'indoor',
      temp: '24',
      humidity: '110',
    });
    expect(result.errors.humidity).toBe('Humidity must be between 0 and 100%');
  });
});

describe('plantSchema', () => {
  const filled = { name: 'Basil', watering_interval_days: '3' };

  it('takes a plant', () => {
    expect(validate(plantSchema, filled).ok).toBe(true);
  });

  it('refuses a watering interval that would book a nonsense reminder', () => {
    expect(validate(plantSchema, { ...filled, watering_interval_days: '0' }).errors).toHaveProperty(
      'watering_interval_days'
    );
    expect(
      validate(plantSchema, { ...filled, watering_interval_days: '400' }).errors
    ).toHaveProperty('watering_interval_days');
  });
});

describe('sowingSchema', () => {
  const filled = {
    seed_pack_id: 'pack-1',
    target: 'tray',
    tray_id: 'tray-1',
    container_id: null,
    seeds_per_cell: '2',
    sown_on: '2026-08-07',
  };

  it('takes a sowing', () => {
    expect(validate(sowingSchema, filled).ok).toBe(true);
  });

  it('insists on a pack', () => {
    expect(validate(sowingSchema, { ...filled, seed_pack_id: null }).errors.seed_pack_id).toBe(
      'A seed pack is required'
    );
  });

  it('insists on whatever it is being sown into', () => {
    const noTray = validate(
      sowingSchema,
      { ...filled, tray_id: null },
      { checks: [sowingTargetCheck] }
    );
    expect(noTray.errors.tray_id).toBe('Pick a tray');

    const noPot = validate(
      sowingSchema,
      { ...filled, target: 'container', tray_id: null },
      { checks: [sowingTargetCheck] }
    );
    expect(noPot.errors.container_id).toBe('Pick a container');
  });

  it('refuses a whole packet in one cell', () => {
    expect(
      validate(sowingSchema, { ...filled, seeds_per_cell: '500' }).errors.seeds_per_cell
    ).toBeTruthy();
  });

  it('refuses to sow more seeds than the pack holds', () => {
    const result = validate(sowingSchema, filled, {
      checks: [seedsAvailableCheck({ seed_count: 20 }, 72)],
    });
    expect(result.errors.seeds_per_cell).toBe('That needs 144 seeds and the pack has 20');
  });

  it('says nothing when the pack has no count recorded', () => {
    const result = validate(sowingSchema, filled, {
      checks: [seedsAvailableCheck({ seed_count: null }, 72)],
    });
    expect(result.ok).toBe(true);
  });
});

describe('cellSchema', () => {
  it('cannot have more come up than went in', () => {
    expect(validate(cellSchema(4), { germinated: '5' }).errors.germinated).toBe(
      'Germinated must be between 0 and 4'
    );
  });

  it('takes none of them coming up', () => {
    expect(validate(cellSchema(4), { germinated: '0' }).ok).toBe(true);
  });

  it('is labelled for the whole tray when marking one', () => {
    expect(
      validate(cellSchema(4, 'Germinated per cell'), { germinated: '9' }).errors.germinated
    ).toBe('Germinated per cell must be between 0 and 4');
  });
});

describe('transplantSchema', () => {
  const filled = {
    seedlings: '6',
    container_count: '3',
    growspace_id: 'space-1',
    container_id: null,
    name: 'Basil',
  };

  it('takes a transplant', () => {
    expect(
      validate(transplantSchema(6), filled, { checks: [containersFitSeedlingsCheck] }).ok
    ).toBe(true);
  });

  it('cannot move more seedlings than have come up', () => {
    expect(
      validate(transplantSchema(6), { ...filled, seedlings: '7' }).errors.seedlings
    ).toBeTruthy();
  });

  it('cannot spread six seedlings over ten pots', () => {
    const result = validate(
      transplantSchema(6),
      { ...filled, container_count: '10' },
      { checks: [containersFitSeedlingsCheck] }
    );
    expect(result.errors.container_count).toBe('There cannot be more containers than seedlings');
  });

  it('needs a growspace to move them into', () => {
    expect(
      validate(transplantSchema(6), { ...filled, growspace_id: null }).errors.growspace_id
    ).toBe('A growspace is required');
  });
});

describe('fertilizerSchema', () => {
  const schema = fertilizerSchema('metric', ['n', 'p', 'k']);
  const filled = { name: 'Grow A', form: 'liquid', origin: 'synthetic' };

  it('takes a bottle', () => {
    expect(validate(schema, filled).ok).toBe(true);
  });

  it('refuses a dose range that runs backwards', () => {
    const result = validate(
      schema,
      { ...filled, foliar_dose_min: '5', foliar_dose_max: '2' },
      { checks: [doseRangeCheck('foliar_dose_min', 'foliar_dose_max', 'foliar dose')] }
    );
    expect(result.errors.foliar_dose_max).toBe(
      'The top of the foliar dose range cannot be below the bottom'
    );
  });

  it('says nothing about a range with only one end given', () => {
    const result = validate(
      schema,
      { ...filled, foliar_dose_min: '5' },
      { checks: [doseRangeCheck('foliar_dose_min', 'foliar_dose_max', 'foliar dose')] }
    );
    expect(result.ok).toBe(true);
  });

  it('converts a dose typed per gallon to per litre', () => {
    const imperial = fertilizerSchema('imperial', ['n']);
    const result = validate(imperial, { ...filled, fertigation_dose_min: '4' });
    expect(result.values.fertigation_dose_min).toBeCloseTo(1.057, 2);
  });
});

describe('feedingSchema', () => {
  const schema = feedingSchema('metric', [{ id: 'f1', name: 'Grow A' }]);
  const filled = {
    place_id: 'space-1',
    target: 'all',
    fertilizer_ids: ['f1'],
    plant_ids: [],
    volume_liters: '10',
    note: '',
    fed_on: '2026-08-07',
    [doseKey('f1')]: '2',
  };

  it('takes a feed', () => {
    const result = validate(schema, filled);
    expect(result.ok).toBe(true);
    expect(result.values[doseKey('f1')]).toBe(2);
  });

  it('needs at least one product', () => {
    expect(validate(schema, { ...filled, fertilizer_ids: [] }).errors.fertilizer_ids).toBe(
      'Pick at least one fertilizer'
    );
  });

  it('needs a dose for every product in the mix', () => {
    expect(validate(schema, { ...filled, [doseKey('f1')]: '' }).errors[doseKey('f1')]).toBe(
      'Grow A is required'
    );
    expect(
      validate(schema, { ...filled, [doseKey('f1')]: '0' }).errors[doseKey('f1')]
    ).toBeTruthy();
  });

  it('stops checking a product once it leaves the mix', () => {
    const emptied = feedingSchema('metric', []);
    expect(validate(emptied, { ...filled, fertilizer_ids: ['f1'], [doseKey('f1')]: '' }).ok).toBe(
      true
    );
  });

  it('needs the plants named when feeding some of them', () => {
    const result = validate(
      schema,
      { ...filled, target: 'plants' },
      { checks: [feedingPlantsCheck({ type: 'growspace' })] }
    );
    expect(result.errors.plant_ids).toBe('Pick the plants that were fed');
  });

  it('never asks a station which plants, since it has none', () => {
    const result = validate(
      schema,
      { ...filled, target: 'plants' },
      { checks: [feedingPlantsCheck({ type: 'station' })] }
    );
    expect(result.ok).toBe(true);
  });
});

describe('scheduledActionSchema', () => {
  const filled = {
    kind: 'feed',
    place_id: 'space-1',
    subject: 'Chilli',
    due_on: '2026-08-07',
    target_ids: [],
  };

  it('takes a plan', () => {
    expect(validate(scheduledActionSchema, filled).ok).toBe(true);
  });

  it('accepts a plan named by what it is aimed at', () => {
    const result = validate(
      scheduledActionSchema,
      { ...filled, subject: '' },
      { checks: [subjectCheck('Basil, Chilli')] }
    );
    expect(result.ok).toBe(true);
  });

  it('refuses one with no name at all', () => {
    const result = validate(
      scheduledActionSchema,
      { ...filled, subject: '' },
      { checks: [subjectCheck(null)] }
    );
    expect(result.errors.subject).toBe('Say what this is for');
  });

  it('insists on targets for a kind that cannot mean the whole place', () => {
    const result = validate(scheduledActionSchema, filled, {
      checks: [targetsRequiredCheck('sowings', false, true)],
    });
    expect(result.errors.target_ids).toBe('Pick what to work on');
  });

  it('lets a feed mean the whole place', () => {
    const result = validate(scheduledActionSchema, filled, {
      checks: [targetsRequiredCheck('plants', true, true)],
    });
    expect(result.ok).toBe(true);
  });

  it('does not demand targets from a place that has none to give', () => {
    const result = validate(scheduledActionSchema, filled, {
      checks: [targetsRequiredCheck('sowings', false, false)],
    });
    expect(result.ok).toBe(true);
  });
});

describe('the auth schemas', () => {
  it('lets an existing short password through at login', () => {
    expect(validate(loginSchema, { email: 'a@b.com', password: 'six123' }).ok).toBe(true);
  });

  it('holds a new password to a length at signup', () => {
    expect(validate(signupSchema, { email: 'a@b.com', password: 'six123' }).errors.password).toBe(
      'Password must be at least 8 characters'
    );
  });

  it('normalises the address either way', () => {
    const result = validate(signupSchema, {
      email: ' Grower@Example.com ',
      password: 'longenough',
    });
    expect(result.values.email).toBe('grower@example.com');
  });
});
