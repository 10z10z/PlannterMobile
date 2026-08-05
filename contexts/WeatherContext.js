import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCurrentWeather, isStale } from '../lib/weather';

const PLACE_KEY = 'weatherPlace';
const READING_KEY = 'weatherReading';

const WeatherContext = createContext(null);

/**
 * The weather where the user's outdoor spaces are.
 *
 * Off until a place is chosen in settings — no coordinates leave the device
 * before then, and nothing is fetched. The last reading is kept on the device so
 * a space opened without a connection still shows the figures it had rather than
 * dropping back to blanks.
 */
export function WeatherProvider({ children }) {
  const [place, setPlace] = useState(null);
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Nothing is fetched until what was stored has been read back, so a cold start
  // doesn't fire a request for a place the user has since cleared.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(PLACE_KEY), AsyncStorage.getItem(READING_KEY)])
      .then(([storedPlace, storedReading]) => {
        if (storedPlace) setPlace(JSON.parse(storedPlace));
        if (storedReading) setReading(JSON.parse(storedReading));
      })
      .catch(() => {
        // A corrupt entry just means starting without one.
      })
      .finally(() => setRestored(true));
  }, []);

  const refresh = useCallback(
    async (target = place, { force = false } = {}) => {
      if (!target) return;
      if (!force && !isStale(reading)) return;

      setLoading(true);
      setError('');
      try {
        const next = await fetchCurrentWeather(target);
        if (next) {
          setReading(next);
          AsyncStorage.setItem(READING_KEY, JSON.stringify(next));
        }
      } catch (fetchError) {
        // The last reading stays on screen; only the message changes.
        setError(fetchError.message);
      }
      setLoading(false);
    },
    [place, reading]
  );

  useEffect(() => {
    if (!restored || !place) return;
    refresh(place);
    // Deliberately not depending on `refresh`: it changes with every reading,
    // which would fetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, place?.latitude, place?.longitude]);

  const choosePlace = useCallback(async (next) => {
    setPlace(next);
    setError('');
    if (next) {
      await AsyncStorage.setItem(PLACE_KEY, JSON.stringify(next));
    } else {
      // Clearing the place clears the reading with it, so a stale figure can't
      // outlive the location it came from.
      setReading(null);
      await AsyncStorage.multiRemove([PLACE_KEY, READING_KEY]);
    }
  }, []);

  const value = useMemo(
    () => ({
      place,
      // Only ever handed out with a place behind it.
      reading: place ? reading : null,
      enabled: !!place,
      loading,
      error,
      choosePlace,
      refresh,
    }),
    [place, reading, loading, error, choosePlace, refresh]
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  return useContext(WeatherContext);
}
