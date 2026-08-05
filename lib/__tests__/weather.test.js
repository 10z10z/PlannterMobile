import {
  conditionsFor,
  isStale,
  parseCurrentWeather,
  parsePlaces,
  placeLabel,
  readingAgeLabel,
  readingAgeMinutes,
} from '../weather';

const at = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();
const reading = (minutesAgo, tempC = 14, humidityPct = 78) => ({
  tempC,
  humidityPct,
  observedAt: '2026-08-05T09:00',
  fetchedAt: at(minutesAgo),
});

describe('parsePlaces', () => {
  it('keeps the fields a place is identified by', () => {
    const json = {
      results: [
        {
          id: 2759794,
          name: 'Amsterdam',
          admin1: 'North Holland',
          country_code: 'NL',
          latitude: 52.374,
          longitude: 4.8897,
          population: 741636,
        },
      ],
    };
    expect(parsePlaces(json)).toEqual([
      {
        id: '2759794',
        name: 'Amsterdam',
        region: 'North Holland',
        country: 'NL',
        latitude: 52.374,
        longitude: 4.8897,
      },
    ]);
  });

  it('drops a result with no coordinates, which is unusable', () => {
    expect(parsePlaces({ results: [{ id: 1, name: 'Nowhere' }] })).toEqual([]);
  });

  it('falls back to the coordinates when a result carries no id', () => {
    const [place] = parsePlaces({ results: [{ name: 'Plot', latitude: 1, longitude: 2 }] });
    expect(place.id).toBe('1,2');
  });

  it('is empty when nothing matched', () => {
    expect(parsePlaces({})).toEqual([]);
    expect(parsePlaces(null)).toEqual([]);
  });
});

describe('placeLabel', () => {
  it('reads a place the way it would be said', () => {
    expect(
      placeLabel({ name: 'Amsterdam', region: 'North Holland', country: 'NL' })
    ).toBe('Amsterdam, North Holland, NL');
  });

  it('leaves out the parts a place does not have', () => {
    expect(placeLabel({ name: 'Valletta', region: null, country: 'MT' })).toBe('Valletta, MT');
  });

  it('is null without a place', () => {
    expect(placeLabel(null)).toBeNull();
  });
});

describe('parseCurrentWeather', () => {
  const now = new Date('2026-08-05T12:00:00Z');

  it('takes the current temperature and humidity', () => {
    const json = {
      current: { time: '2026-08-05T13:00', temperature_2m: 14.2, relative_humidity_2m: 78 },
    };
    expect(parseCurrentWeather(json, now)).toEqual({
      tempC: 14.2,
      humidityPct: 78,
      observedAt: '2026-08-05T13:00',
      fetchedAt: now.toISOString(),
    });
  });

  it('keeps a freezing reading rather than treating zero as missing', () => {
    const json = { current: { temperature_2m: 0, relative_humidity_2m: 0 } };
    const parsed = parseCurrentWeather(json, now);
    expect(parsed.tempC).toBe(0);
    expect(parsed.humidityPct).toBe(0);
  });

  it('keeps whichever figure came back when the other did not', () => {
    const parsed = parseCurrentWeather({ current: { temperature_2m: 9 } }, now);
    expect(parsed.tempC).toBe(9);
    expect(parsed.humidityPct).toBeNull();
  });

  it('is null when the response carries no reading at all', () => {
    expect(parseCurrentWeather({}, now)).toBeNull();
    expect(parseCurrentWeather({ current: {} }, now)).toBeNull();
    expect(parseCurrentWeather(null, now)).toBeNull();
  });
});

describe('readingAgeMinutes and isStale', () => {
  it('counts how long ago a reading was fetched', () => {
    expect(readingAgeMinutes(reading(0))).toBe(0);
    expect(readingAgeMinutes(reading(12))).toBe(12);
  });

  it('treats a reading older than the window as worth fetching again', () => {
    expect(isStale(reading(5))).toBe(false);
    expect(isStale(reading(45))).toBe(true);
  });

  it('treats no reading at all as stale, so the first fetch happens', () => {
    expect(isStale(null)).toBe(true);
    expect(readingAgeMinutes(null)).toBeNull();
  });

  it('treats an unreadable timestamp as stale rather than as current', () => {
    expect(isStale({ fetchedAt: 'rubbish' })).toBe(true);
  });
});

describe('readingAgeLabel', () => {
  it('says how current a reading is', () => {
    expect(readingAgeLabel(reading(0))).toBe('just now');
    expect(readingAgeLabel(reading(12))).toBe('12m ago');
    expect(readingAgeLabel(reading(200))).toBe('3h ago');
  });

  it('is null without a reading', () => {
    expect(readingAgeLabel(null)).toBeNull();
  });
});

describe('conditionsFor', () => {
  const outdoor = { environment: 'outdoor', temp_c: 20, humidity_pct: 50 };
  const indoor = { environment: 'indoor', temp_c: 20, humidity_pct: 50 };

  it('reads an outdoor space off the forecast', () => {
    const conditions = conditionsFor(outdoor, reading(5));
    expect(conditions).toMatchObject({ tempC: 14, humidityPct: 78, liveTemp: true });
  });

  it('leaves an indoor space on the figures recorded for it', () => {
    const conditions = conditionsFor(indoor, reading(5));
    expect(conditions).toMatchObject({
      tempC: 20,
      humidityPct: 50,
      liveTemp: false,
      liveHumidity: false,
    });
  });

  it('falls back to the recorded figures when there is no reading', () => {
    expect(conditionsFor(outdoor, null)).toMatchObject({
      tempC: 20,
      humidityPct: 50,
      liveTemp: false,
    });
  });

  it('falls back one figure at a time', () => {
    // a reading with no humidity still contributes its temperature
    const partial = { tempC: 9, humidityPct: null, fetchedAt: at(1) };
    expect(conditionsFor(outdoor, partial)).toMatchObject({
      tempC: 9,
      humidityPct: 50,
      liveTemp: true,
      liveHumidity: false,
    });
  });

  it('does not mistake a freezing reading for a missing one', () => {
    const freezing = { tempC: 0, humidityPct: 90, fetchedAt: at(1) };
    expect(conditionsFor(outdoor, freezing)).toMatchObject({ tempC: 0, liveTemp: true });
  });

  it('shows nothing rather than guessing for a space with neither', () => {
    expect(conditionsFor({ environment: 'indoor' }, null)).toMatchObject({
      tempC: null,
      humidityPct: null,
    });
  });
});
