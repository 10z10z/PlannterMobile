import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, List, Text } from 'react-native-paper';
import TextField from '../components/TextField';
import { useUnits } from '../contexts/UnitsContext';
import { useWeather } from '../contexts/WeatherContext';
import { formatTemperature, tempUnit } from '../lib/units';
import { PROVIDER_NAME, placeLabel, readingAgeLabel, searchPlaces } from '../lib/weather';

/**
 * Picks the place an outdoor space's weather is read from.
 *
 * A typed search rather than the device's location: it needs no permission
 * prompt and no native module, and a grower's plot is often not where their
 * phone is. Nothing is sent anywhere until a place is chosen.
 */
export default function WeatherSettings() {
  const { system } = useUnits();
  const { place, reading, loading, error, choosePlace, refresh } = useWeather();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Searched a beat after typing stops, so a place name isn't one request per
  // keystroke. The request is abandoned if the text changes again first.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setSearchError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError('');
      searchPlaces(text, { signal: controller.signal })
        .then(setResults)
        .catch((searchFailure) => {
          if (searchFailure.name !== 'AbortError') setSearchError(searchFailure.message);
        })
        .finally(() => setSearching(false));
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const pick = (result) => {
    choosePlace(result);
    setQuery('');
    setResults([]);
  };

  return (
    <View>
      {place ? (
        <List.Item
          title={placeLabel(place)}
          description={
            reading
              ? [
                  reading.tempC !== null
                    ? `${formatTemperature(reading.tempC, system)} ${tempUnit(system)}`
                    : null,
                  reading.humidityPct !== null ? `${reading.humidityPct}% RH` : null,
                  readingAgeLabel(reading),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : loading
                ? 'Reading the weather…'
                : 'No reading yet'
          }
          left={(props) => <List.Icon {...props} icon="weather-partly-cloudy" />}
          right={() => (loading ? <ActivityIndicator style={styles.spinner} /> : null)}
          style={styles.placeRow}
        />
      ) : (
        <Text variant="bodyMedium" style={styles.intro}>
          Pick the place your outdoor spaces are in, and they'll show the temperature and humidity
          there instead of figures you keep up to date by hand.
        </Text>
      )}

      {!!error && (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      )}

      <TextField
        label={place ? 'Change place' : 'Search for a town or city'}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        right={searching ? <TextField.Icon icon="timer-sand" /> : undefined}
        style={styles.input}
      />
      {!!searchError && (
        <HelperText type="error" visible>
          {searchError}
        </HelperText>
      )}

      {results.map((result) => (
        <List.Item
          key={result.id}
          title={result.name}
          description={[result.region, result.country].filter(Boolean).join(', ')}
          left={(props) => <List.Icon {...props} icon="map-marker-outline" />}
          onPress={() => pick(result)}
          style={styles.placeRow}
        />
      ))}

      {query.trim().length >= 2 && !searching && results.length === 0 && !searchError && (
        <HelperText type="info" visible>
          Nothing found by that name.
        </HelperText>
      )}

      {!!place && (
        <View style={styles.actions}>
          <Button mode="outlined" icon="refresh" onPress={() => refresh(place, { force: true })}>
            Refresh
          </Button>
          <Button mode="text" onPress={() => choosePlace(null)}>
            Turn off
          </Button>
        </View>
      )}

      <HelperText type="info" visible style={styles.credit}>
        {`Forecasts from ${PROVIDER_NAME}, which draws on the national weather services. Only the coordinates of the place you choose are sent.`}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    opacity: 0.7,
    marginBottom: 8,
  },
  input: {
    marginBottom: 4,
  },
  placeRow: {
    paddingHorizontal: 0,
  },
  spinner: {
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  credit: {
    paddingHorizontal: 0,
  },
});
