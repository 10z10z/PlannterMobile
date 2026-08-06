import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, SegmentedButtons, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { useUnits } from '../../contexts/UnitsContext';
import { formatTemperature, parseTemperature, tempUnit } from '../../lib/units';
import {
  GROWSPACE_ENVIRONMENTS,
  fetchGrids,
  fetchGrowspaceLights,
  fetchPlants,
  plantsLoosedBy,
  totalSpots,
} from '../../lib/growspaces';
import { messageFor } from '../../lib/errors';
import { useSaveGrowspace } from '../../hooks/useGrowspaces';
import LightAssignmentField from '../../components/LightAssignmentField';
import GridListField from '../../components/GridListField';
import ErrorText from '../../components/ErrorText';

/**
 * Creates a growspace or edits one, the same fields either way. The grid is part
 * of the form because how big a tent is and what hangs over it are decided
 * together, and both are things a grower changes as the space fills up.
 */
export default function GrowspaceFormDialog({ visible, growspace, onDismiss, onSaved }) {
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
  // Only what this form checks itself; anything the server objects to arrives
  // on the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const save = useSaveGrowspace({
    onSuccess: (saved) => {
      setCreated(saved);
      onSaved(saved);
    },
    // A save that got the growspace in but not its grids still made one.
    // Holding on to it is what makes pressing save again a retry.
    onError: (failure) => {
      if (failure?.growspace) setCreated(failure.growspace);
    },
  });
  const resetSave = save.reset;

  useEffect(() => {
    if (!visible) return;
    setValidationError('');
    resetSave();
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
      fetchGrids(growspace.id)
        .then(setGrids)
        .catch(() => setGrids([]));
      fetchGrowspaceLights(growspace.id)
        .then((rowsData) => {
          const current = rowsData.map((row) => ({
            grow_light_id: row.grow_light_id,
            quantity: row.quantity,
          }));
          setLights(current);
          setBaseline(current);
        })
        .catch((loadError) => setValidationError(loadError.message));
      fetchPlants(growspace.id)
        .then(setPlants)
        .catch(() => setPlants([]));
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
  }, [visible, growspace, system, resetSave]);

  const gridsAreValid = grids.every(
    (grid) => grid.grid_rows > 0 && grid.grid_cols > 0 && String(grid.name).trim()
  );
  const turnedLoose = gridsAreValid ? plantsLoosedBy(plants, grids) : [];

  const handleSave = () => {
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (!gridsAreValid) {
      setValidationError('Every grid needs a name and at least one row and column');
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

    // Kept only while the space is outdoors: moving one inside shouldn't leave a
    // figure for sun it no longer gets.
    const sunValue =
      environment === 'outdoor' && sunHours.trim() ? Number(sunHours.replace(',', '.')) : null;
    if (sunValue !== null && (Number.isNaN(sunValue) || sunValue < 0 || sunValue > 24)) {
      setValidationError('Hours of direct sun must be between 0 and 24');
      return;
    }

    setValidationError('');
    save.mutate({
      // `created` is the growspace a half-failed save already made: retrying
      // updates it rather than inserting a second one under the same name.
      id: growspace?.id ?? created?.id,
      values: {
        name: name.trim(),
        description: description.trim() || null,
        environment,
        temp_c: parseTemperature(temp, system),
        humidity_pct: humidityValue,
        sun_hours: sunValue,
      },
      grids,
      lights,
      plants,
    });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Growspace' : 'New Growspace'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <TextField label="Name" value={name} onChangeText={setName} style={styles.input} />
            <TextField
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
                <TextField
                  label="Hours of direct sun"
                  value={sunHours}
                  onChangeText={setSunHours}
                  keyboardType="decimal-pad"
                  right={<TextField.Affix text="h / day" />}
                  style={styles.input}
                />
                <HelperText type="info">
                  How long the sun reaches this spot on a clear day.
                </HelperText>
              </>
            )}

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
