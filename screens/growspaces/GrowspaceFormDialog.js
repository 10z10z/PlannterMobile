import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUnits } from '../../contexts/UnitsContext';
import { formatTemperature, parseTemperature, tempUnit } from '../../lib/units';
import {
  GROWSPACE_ENVIRONMENTS,
  fetchGrids,
  fetchGrowspaceLights,
  fetchPlants,
  plantsLoosedBy,
  saveGrids,
  saveGrowspaceLights,
  totalSpots,
} from '../../lib/growspaces';
import LightAssignmentField from '../../components/LightAssignmentField';
import GridListField from '../../components/GridListField';

/**
 * Creates a growspace or edits one, the same fields either way. The grid is part
 * of the form because how big a tent is and what hangs over it are decided
 * together, and both are things a grower changes as the space fills up.
 */
export default function GrowspaceFormDialog({ visible, growspace, onDismiss, onSaved }) {
  const { session } = useAuth();
  const { system } = useUnits();
  const isEditing = !!growspace;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('indoor');
  const [temp, setTemp] = useState('');
  const [humidity, setHumidity] = useState('');
  const [sunHours, setSunHours] = useState('');
  const [grids, setGrids] = useState([]);
  const [lights, setLights] = useState([]);
  const [baseline, setBaseline] = useState([]);
  // The plants already in this growspace, so shrinking or removing a grid can
  // say what it would turn loose before it happens.
  const [plants, setPlants] = useState([]);
  // Set once a new growspace exists, so a retry after a half-failed save doesn't
  // create a second one.
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    setCreated(null);

    if (growspace) {
      setName(growspace.name);
      setDescription(growspace.description ?? '');
      setEnvironment(growspace.environment);
      setTemp(formatTemperature(growspace.temp_c, system));
      setHumidity(growspace.humidity_pct === null ? '' : String(growspace.humidity_pct));
      setSunHours(
        growspace.sun_hours === null || growspace.sun_hours === undefined
          ? ''
          : String(growspace.sun_hours)
      );
      fetchGrids(growspace.id).then(setGrids).catch(() => setGrids([]));
      fetchGrowspaceLights(growspace.id)
        .then((rowsData) => {
          const current = rowsData.map((row) => ({
            grow_light_id: row.grow_light_id,
            quantity: row.quantity,
          }));
          setLights(current);
          setBaseline(current);
        })
        .catch((loadError) => setError(loadError.message));
      fetchPlants(growspace.id).then(setPlants).catch(() => setPlants([]));
    } else {
      setName('');
      setDescription('');
      setEnvironment('indoor');
      setTemp('');
      setHumidity('');
      setSunHours('');
      // A new growspace starts with one grid, which is what most spaces are.
      setGrids([{ id: null, name: 'Main', grid_rows: 4, grid_cols: 4 }]);
      setLights([]);
      setBaseline([]);
      setPlants([]);
    }
  }, [visible, growspace, system]);

  const gridsAreValid = grids.every(
    (grid) => grid.grid_rows > 0 && grid.grid_cols > 0 && String(grid.name).trim()
  );
  const turnedLoose = gridsAreValid ? plantsLoosedBy(plants, grids) : [];

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!gridsAreValid) {
      setError('Every grid needs a name and at least one row and column');
      return;
    }
    const humidityValue = humidity.trim() ? Number(humidity.replace(',', '.')) : null;
    if (
      humidityValue !== null &&
      (Number.isNaN(humidityValue) || humidityValue < 0 || humidityValue > 100)
    ) {
      setError('Humidity must be between 0 and 100%');
      return;
    }

    // Kept only while the space is outdoors: moving one inside shouldn't leave a
    // figure for sun it no longer gets.
    const sunValue =
      environment === 'outdoor' && sunHours.trim() ? Number(sunHours.replace(',', '.')) : null;
    if (sunValue !== null && (Number.isNaN(sunValue) || sunValue < 0 || sunValue > 24)) {
      setError('Hours of direct sun must be between 0 and 24');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      environment,
      temp_c: parseTemperature(temp, system),
      humidity_pct: humidityValue,
      sun_hours: sunValue,
    };

    let target = growspace ?? created;
    if (target) {
      const { error: updateError } = await supabase
        .from('growspaces')
        .update(payload)
        .eq('id', target.id);
      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('growspaces')
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

    // The growspace itself is saved by this point, so a failure below costs only
    // the grids or the lights, and pressing save again retries just those.
    try {
      await saveGrids(session.user.id, target.id, grids, plants);
    } catch (gridsError) {
      setSaving(false);
      setError(`Growspace saved, but its grids weren't: ${gridsError.message}`);
      return;
    }

    try {
      await saveGrowspaceLights(session.user.id, target.id, lights);
    } catch (lightsError) {
      setSaving(false);
      setError(`Growspace saved, but its lights weren't: ${lightsError.message}`);
      return;
    }

    setSaving(false);
    onSaved({ ...target, ...payload });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Growspace' : 'New Growspace'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
            <TextInput
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
            />

            <Text variant="labelLarge" style={styles.label}>
              Environment
            </Text>
            <SegmentedButtons
              value={environment}
              onValueChange={setEnvironment}
              buttons={GROWSPACE_ENVIRONMENTS}
            />

            <View style={styles.row}>
              <TextInput
                label={`Temperature (${tempUnit(system)})`}
                value={temp}
                onChangeText={setTemp}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, styles.half, styles.spacedInput]}
              />
              <TextInput
                label="Humidity (%)"
                value={humidity}
                onChangeText={setHumidity}
                keyboardType="decimal-pad"
                style={[styles.input, styles.half, styles.spacedInput]}
              />
            </View>
            <HelperText type="info">Optional — the conditions this space is kept at.</HelperText>

            <GridListField value={grids} onChange={setGrids} plants={plants} />
            <HelperText type={turnedLoose.length ? 'error' : 'info'}>
              {turnedLoose.length
                ? `${turnedLoose.length} plant${
                    turnedLoose.length === 1 ? '' : 's'
                  } would go back to the holding tray when this is saved.`
                : `${totalSpots(grids)} spots across ${grids.length} grid${
                    grids.length === 1 ? '' : 's'
                  }.`}
            </HelperText>

            {/* Outdoors the main light source isn't a fixture at all, so it
                heads the lighting section — and a greenhouse can still hang
                something underneath to stretch a short winter day. */}
            {environment === 'outdoor' && (
              <>
                <Text variant="labelLarge" style={styles.label}>
                  Sunlight
                </Text>
                <TextInput
                  label="Hours of direct sun"
                  value={sunHours}
                  onChangeText={setSunHours}
                  keyboardType="decimal-pad"
                  right={<TextInput.Affix text="h / day" />}
                  style={styles.input}
                />
                <HelperText type="info">
                  How long the sun reaches this spot on a clear day.
                </HelperText>
              </>
            )}

            <LightAssignmentField value={lights} onChange={setLights} baseline={baseline} />

            {!!error && <Text style={styles.errorText}>{error}</Text>}
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
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
