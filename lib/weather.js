/**
 * Live outdoor conditions, from Open-Meteo.
 *
 * Open-Meteo was chosen over the alternatives because it needs no API key and no
 * account: anything requiring a key would mean asking every user to sign up for
 * a service before an outdoor space could read its own weather. Its forecasts
 * come from the national weather services — DWD, Météo-France, NOAA and ECMWF
 * among them — rather than from a model of its own, which is what makes it a
 * credible source rather than merely a free one.
 *
 * Temperatures are requested in Celsius and humidity as a percentage, so what
 * comes back is stored the same way the rest of the app stores conditions and is
 * converted only for display.
 */

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** How long a reading is treated as current before it's fetched again. */
export const FRESH_MINUTES = 30;

/** Named for the settings screen, so the source is never a mystery. */
export const PROVIDER_NAME = 'Open-Meteo';
export const PROVIDER_URL = 'https://open-meteo.com';

/**
 * Turns the geocoder's answer into the few fields the app keeps.
 *
 * Split from the request so it can be tested without a network: the shape of
 * this response is the part that can quietly change.
 */
export function parsePlaces(json) {
  return (json?.results ?? [])
    .filter((entry) => entry?.latitude !== undefined && entry?.longitude !== undefined)
    .map((entry) => ({
      id: String(entry.id ?? `${entry.latitude},${entry.longitude}`),
      name: entry.name,
      region: entry.admin1 ?? null,
      country: entry.country_code ?? entry.country ?? null,
      latitude: entry.latitude,
      longitude: entry.longitude,
    }));
}

/** "Amsterdam, North Holland, NL" — dropping the parts a place doesn't have. */
export function placeLabel(place) {
  if (!place) return null;
  return [place.name, place.region, place.country].filter(Boolean).join(', ');
}

/**
 * The current conditions out of a forecast response.
 *
 * Null when the reading is missing rather than zero-filled: 0°C is a real
 * temperature, so a missing figure has to stay missing or a frost is invented
 * every time the service leaves a field out.
 */
export function parseCurrentWeather(json, now = new Date()) {
  const current = json?.current;
  if (!current) return null;

  const tempC = typeof current.temperature_2m === 'number' ? current.temperature_2m : null;
  const humidityPct =
    typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null;
  if (tempC === null && humidityPct === null) return null;

  return {
    tempC,
    humidityPct,
    // When the service says it measured, and when we asked — the second is what
    // staleness is judged on, since the first is in the station's own timezone.
    observedAt: current.time ?? null,
    fetchedAt: now.toISOString(),
  };
}

/**
 * Places matching a typed name. Empty for a blank query rather than a request.
 *
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function searchPlaces(query, { signal } = {}) {
  const text = String(query ?? '').trim();
  if (text.length < 2) return [];

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(text)}&count=8&language=en&format=json`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not search for places (${response.status})`);
  return parsePlaces(await response.json());
}

/**
 * The current temperature and humidity at a place.
 *
 * @param {{ latitude: number, longitude: number }|null} place
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function fetchCurrentWeather(place, { signal } = {}) {
  if (!place) return null;

  const url =
    `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
    '&current=temperature_2m,relative_humidity_2m&timezone=auto';
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not read the weather (${response.status})`);
  return parseCurrentWeather(await response.json());
}

/** How many whole minutes ago a reading was fetched. Null when there isn't one. */
export function readingAgeMinutes(reading, now = new Date()) {
  if (!reading?.fetchedAt) return null;
  const fetched = new Date(reading.fetchedAt);
  if (Number.isNaN(fetched.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - fetched.getTime()) / 60000));
}

/** Whether a reading is old enough to be worth fetching again. */
export function isStale(reading, now = new Date(), freshMinutes = FRESH_MINUTES) {
  const age = readingAgeMinutes(reading, now);
  return age === null || age >= freshMinutes;
}

/** "just now", "12m ago", "3h ago" — how current a reading is, in words. */
export function readingAgeLabel(reading, now = new Date()) {
  const age = readingAgeMinutes(reading, now);
  if (age === null) return null;
  if (age < 1) return 'just now';
  if (age < 60) return `${age}m ago`;
  return `${Math.floor(age / 60)}h ago`;
}

/**
 * Which figures a space should show.
 *
 * An outdoor space reads its conditions off the weather where it stands; an
 * indoor one keeps whatever was recorded for it, since no forecast knows what a
 * tent is being held at. Each figure falls back on its own, so a reading missing
 * humidity still contributes its temperature.
 */
export function conditionsFor(space, reading) {
  const live = space?.environment === 'outdoor' ? reading : null;

  const tempC = live?.tempC ?? space?.temp_c ?? null;
  const humidityPct = live?.humidityPct ?? space?.humidity_pct ?? null;

  return {
    tempC,
    humidityPct,
    // True only where a figure actually came from the forecast, so the screens
    // never label a stored figure as live.
    liveTemp: live?.tempC !== null && live?.tempC !== undefined,
    liveHumidity: live?.humidityPct !== null && live?.humidityPct !== undefined,
  };
}
