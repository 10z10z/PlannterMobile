import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import TextField from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { formatTemperature, parseTemperature, tempUnit } from '../../lib/units';
import {
  STATION_ENVIRONMENTS,
  fetchStationLights,
  saveStationLights,
} from '../../lib/germination';
import LightAssignmentField from '../../components/LightAssignmentField';
import ErrorText from '../../components/ErrorText';

/**
 * Creates a station or edits one — the same fields either way, so the two paths
 * don't drift apart. Lights are part of the form rather than a separate dialog,
 * since deciding what hangs over a propagator belongs with deciding how warm it
 * is kept.
 */
export default function StationFormDialog({ visible, station, onDismiss, onSaved }) {
  const { session } = useAuth();
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
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
        .catch((loadError) => setError(loadError.message));
    } else {
      setName('');
      setEnvironment('indoor');
      setTemp('');
      setHumidity('');
      setLights([]);
      setBaseline([]);
    }
  }, [visible, station, system]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const humidityValue = humidity.trim() ? Number(humidity.replace(',', '.')) : null;
    if (humidityValue !== null && (Number.isNaN(humidityValue) || humidityValue < 0 || humidityValue > 100)) {
      setError('Humidity must be between 0 and 100%');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      environment,
      temp_c: parseTemperature(temp, system),
      humidity_pct: humidityValue,
    };

    let target = station ?? created;
    if (target) {
      const { error: updateError } = await supabase
        .from('germination_stations')
        .update(payload)
        .eq('id', target.id);
      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('germination_stations')
        .insert({ ...payload, user_id: session.user.id })
        .select()
        .single();
      if (insertError) {
        setSaving(false);
        setError(insertError.message);
        return;
      }
      target = data;
      setCreated(data);
    }

    // The station itself is saved by this point, so a failure here costs only
    // the light assignments, and pressing save again retries just those.
    try {
      await saveStationLights(session.user.id, target.id, lights);
    } catch (lightsError) {
      setSaving(false);
      setError(`Station saved, but its lights weren't: ${lightsError.message}`);
      return;
    }

    setSaving(false);
    onSaved({ ...target, ...payload });
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
            <HelperText type="info">
              Optional — the conditions this station is kept at.
            </HelperText>

            <LightAssignmentField value={lights} onChange={setLights} baseline={baseline} />

            <ErrorText>{error}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={saving} disabled={saving}>
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
