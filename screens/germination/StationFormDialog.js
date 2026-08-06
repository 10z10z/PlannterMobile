import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, SegmentedButtons, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { useUnits } from '../../contexts/UnitsContext';
import { formatTemperature, parseTemperature, tempUnit } from '../../lib/units';
import { STATION_ENVIRONMENTS, fetchStationLights } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useSaveStation } from '../../hooks/useStations';
import LightAssignmentField from '../../components/LightAssignmentField';
import ErrorText from '../../components/ErrorText';

/**
 * Creates a station or edits one — the same fields either way, so the two paths
 * don't drift apart. Lights are part of the form rather than a separate dialog,
 * since deciding what hangs over a propagator belongs with deciding how warm it
 * is kept.
 */
export default function StationFormDialog({ visible, station, onDismiss, onSaved }) {
  const { system } = useUnits();
  const isEditing = !!station;

  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState('indoor');
  const [temp, setTemp] = useState('');
  const [humidity, setHumidity] = useState('');
  const [lights, setLights] = useState([]);
  // What the station already had saved, so the free counts can add its own
  // lights back in rather than showing them as taken.
  const [baseline, setBaseline] = useState([]);
  // Set once a new station exists, so a retry after a half-failed save doesn't
  // create a second one.
  const [created, setCreated] = useState(null);
  // Only what this form checks itself; anything the server objects to arrives
  // on the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const save = useSaveStation({
    onSuccess: (saved) => {
      setCreated(saved);
      onSaved(saved);
    },
    // A save that got the station in but not its lights still made a station.
    // Holding on to it is what makes pressing save again a retry rather than a
    // second station under the same name.
    onError: (failure) => {
      if (failure?.station) setCreated(failure.station);
    },
  });
  const resetSave = save.reset;

  useEffect(() => {
    if (!visible) return;
    setValidationError('');
    resetSave();
    setCreated(null);

    if (station) {
      setName(station.name);
      setEnvironment(station.environment);
      setTemp(formatTemperature(station.temp_c, system));
      setHumidity(station.humidity_pct === null ? '' : String(station.humidity_pct));
      fetchStationLights(station.id)
        .then((rows) => {
          const current = rows.map((row) => ({
            grow_light_id: row.grow_light_id,
            quantity: row.quantity,
          }));
          setLights(current);
          setBaseline(current);
        })
        .catch((loadError) => setValidationError(messageFor(loadError)));
    } else {
      setName('');
      setEnvironment('indoor');
      setTemp('');
      setHumidity('');
      setLights([]);
      setBaseline([]);
    }
  }, [visible, station, system, resetSave]);

  const handleSave = () => {
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    const humidityValue = humidity.trim() ? Number(humidity.replace(',', '.')) : null;
    if (
      humidityValue !== null &&
      (Number.isNaN(humidityValue) || humidityValue < 0 || humidityValue > 100)
    ) {
      setValidationError('Humidity must be between 0 and 100%');
      return;
    }

    setValidationError('');
    save.mutate({
      // `created` is the station a half-failed save already made: retrying
      // updates it rather than inserting a second one under the same name.
      id: station?.id ?? created?.id,
      values: {
        name: name.trim(),
        environment,
        temp_c: parseTemperature(temp, system),
        humidity_pct: humidityValue,
      },
      lights,
    });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Station' : 'New Station'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />

            <Text variant="labelLarge" style={styles.label}>
              Environment
            </Text>
            <SegmentedButtons
              value={environment}
              onValueChange={setEnvironment}
              buttons={STATION_ENVIRONMENTS}
            />

            <View style={styles.row}>
              <TextField
                label={`Temperature (${tempUnit(system)})`}
                value={temp}
                onChangeText={setTemp}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, styles.half, styles.spacedInput]}
              />
              <TextField
                label="Humidity (%)"
                value={humidity}
                onChangeText={setHumidity}
                keyboardType="decimal-pad"
                style={[styles.input, styles.half, styles.spacedInput]}
              />
            </View>
            <HelperText type="info">Optional — the conditions this station is kept at.</HelperText>

            <LightAssignmentField value={lights} onChange={setLights} baseline={baseline} />

            <ErrorText>{validationError || (save.isError ? messageFor(save.error) : '')}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={save.isPending} disabled={save.isPending}>
            {isEditing || created ? 'Save' : 'Create'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '85%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.7,
  },
  input: {
    marginBottom: 8,
  },
  spacedInput: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
});
