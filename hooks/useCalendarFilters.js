import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_FILTERS, normalizeFilters, toggleFilter } from '../lib/calendarFilters';

const FILTERS_KEY = 'calendarFilters';

/**
 * The calendar's chips, and the fact that they are remembered.
 *
 * They are how the calendar was left, not how it starts: someone who only ever
 * wants the growing side of the app shouldn't have to say so every morning.
 *
 * Read through `normalizeFilters` rather than trusted, and a stored value that
 * can't be parsed is dropped rather than thrown. What is on disk was written by
 * an older version of this app as often as by this one, and an unreadable
 * setting is no reason to open on an empty calendar — which is what an
 * exception here would do, since it happens inside an effect on mount.
 */
export default function useCalendarFilters() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    AsyncStorage.getItem(FILTERS_KEY).then((stored) => {
      if (!stored) return;
      try {
        setFilters(normalizeFilters(JSON.parse(stored)));
      } catch {
        // See above: the default chips are a better answer than a blank screen.
      }
    });
  }, []);

  const apply = (next) => {
    setFilters(next);
    AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(next));
  };

  return {
    filters,
    /** One chip on or off, within its own dimension. */
    toggle: (dimension, value) => apply(toggleFilter(filters, dimension, value)),
    /** Everything back on — from the bar itself, and from an emptied day. */
    clear: () => apply(DEFAULT_FILTERS),
  };
}
