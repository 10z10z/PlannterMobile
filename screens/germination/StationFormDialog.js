import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import { useUnits } from '../../contexts/UnitsContext';
import { formatTemperature, tempUnit } from '../../lib/units';
import { STATION_ENVIRONMENTS, fetchStationLights } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useSaveStation } from '../../hooks/useStations';
import useForm from '../../hooks/useForm';
import { stationSchema } from '../../lib/schemas';
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

  const form = useForm(stationSchema(system));
  const resetForm = form.reset;

  const [lights, setLights] = useState([]);
  // What the station already had saved, so the free counts can add its own
  // lights back in rather than showing them as taken.
  const [baseline, setBaseline] = useState([]);
  // Set once a new station exists, so a retry after a half-failed save doesn't
  // create a second one.
  const [created, setCreated] = useState(null);
  const [loadError, setLoadError] = useState('');

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
    resetSave();
    setCreated(null);
    setLoadError('');

    if (station) {
      resetForm({
        name: station.name,
        environment: station.environment,
        temp: formatTemperature(station.temp_c, system),
        humidity: station.humidity_pct === null ? '' : String(station.humidity_pct),
      });
      fetchStationLights(station.id)
        .then((rows) => {
          const current = rows.map((row) => ({
            grow_light_id: row.grow_light_id,
            quantity: row.quantity,
          }));
          setLights(current);
          setBaseline(current);
        })
        .catch((error) => setLoadError(messageFor(error)));
    } else {
      resetForm({ name: '', environment: 'indoor', temp: '', humidity: '' });
      setLights([]);
      setBaseline([]);
    }
  }, [visible, station, system, resetSave, resetForm]);

  const handleSave = () => {
    form.submit((values) =>
      save.mutate({
        // `created` is the station a half-failed save already made: retrying
        // updates it rather than inserting a second one under the same name.
        id: station?.id ?? created?.id,
        values: {
          name: values.name,
          environment: values.environment,
          temp_c: values.temp,
          humidity_pct: values.humidity,
        },
        lights,
      })
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Station' : 'New Station'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <FormField label="Name" {...form.field('name')} />

            <Text variant="labelLarge" style={styles.label}>
              Environment
            </Text>
            <SegmentedButtons
              value={form.values.environment}
              onValueChange={(value) => form.set('environment', value)}
              buttons={STATION_ENVIRONMENTS}
            />

            <View style={styles.row}>
              <FormField
                label={`Temperature (${tempUnit(system)})`}
                keyboardType="numbers-and-punctuation"
                style={[styles.half, styles.spacedInput]}
                {...form.field('temp')}
              />
              <FormField
                label="Humidity (%)"
                keyboardType="decimal-pad"
                style={[styles.half, styles.spacedInput]}
                hint="Optional"
                {...form.field('humidity')}
              />
            </View>

            <LightAssignmentField value={lights} onChange={setLights} baseline={baseline} />

            <ErrorText>{loadError || (save.isError ? messageFor(save.error) : '')}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={handleSave}
            loading={save.isPending}
            disabled={save.isPending || !form.canSubmit}
          >
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
