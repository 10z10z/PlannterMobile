import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, SegmentedButtons, Text } from 'react-native-paper';
import DialogScroll from '../../components/DialogScroll';
import FormField from '../../components/FormField';
import { useUnits } from '../../contexts/UnitsContext';
import { formatTemperature, tempUnit } from '../../lib/units';
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
import useForm from '../../hooks/useForm';
import { growspaceSchema } from '../../lib/schemas';
import { gridsAreValid, gridProblem } from '../../lib/grids';
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

  const form = useForm(growspaceSchema(system));
  const resetForm = form.reset;

  const [grids, setGrids] = useState([]);
  const [lights, setLights] = useState([]);
  const [baseline, setBaseline] = useState([]);
  // The plants already in this growspace, so shrinking or removing a grid can
  // say what it would turn loose before it happens.
  const [plants, setPlants] = useState([]);
  // Set once a new growspace exists, so a retry after a half-failed save doesn't
  // create a second one.
  const [created, setCreated] = useState(null);
  // The grids are a list rather than a field, so their complaint can't sit under
  // an input the way the rest do.
  const [gridError, setGridError] = useState('');
  const [loadError, setLoadError] = useState('');

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
    resetSave();
    setCreated(null);
    setGridError('');
    setLoadError('');

    if (growspace) {
      resetForm({
        name: growspace.name,
        description: growspace.description ?? '',
        environment: growspace.environment,
        temp: formatTemperature(growspace.temp_c, system),
        humidity: growspace.humidity_pct === null ? '' : String(growspace.humidity_pct),
        sunHours:
          growspace.sun_hours === null || growspace.sun_hours === undefined
            ? ''
            : String(growspace.sun_hours),
      });
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
        .catch((error) => setLoadError(error.message));
      fetchPlants(growspace.id)
        .then(setPlants)
        .catch(() => setPlants([]));
    } else {
      resetForm({
        name: '',
        description: '',
        environment: 'indoor',
        temp: '',
        humidity: '',
        sunHours: '',
      });
      // A new growspace starts with one grid, which is what most spaces are.
      setGrids([{ id: null, name: 'Main', grid_rows: 4, grid_cols: 4 }]);
      setLights([]);
      setBaseline([]);
      setPlants([]);
    }
  }, [visible, growspace, system, resetSave, resetForm]);

  const environment = form.values.environment;
  const turnedLoose = gridsAreValid(grids) ? plantsLoosedBy(plants, grids) : [];

  const handleSave = () => {
    const problem = gridProblem(grids);
    setGridError(problem);

    form.submit((values) => {
      if (problem) return;
      save.mutate({
        // `created` is the growspace a half-failed save already made: retrying
        // updates it rather than inserting a second one under the same name.
        id: growspace?.id ?? created?.id,
        values: {
          name: values.name,
          description: values.description,
          environment: values.environment,
          temp_c: values.temp,
          humidity_pct: values.humidity,
          // Kept only while the space is outdoors: moving one inside shouldn't
          // leave a figure for sun it no longer gets.
          sun_hours: values.environment === 'outdoor' ? values.sunHours : null,
        },
        grids,
        lights,
        plants,
      });
    });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Growspace' : 'New Growspace'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <DialogScroll>
            <FormField label="Name" {...form.field('name')} />
            <FormField label="Description (optional)" {...form.field('description')} />

            <Text variant="labelLarge" style={styles.label}>
              Environment
            </Text>
            <SegmentedButtons
              value={environment}
              onValueChange={(value) => form.set('environment', value)}
              buttons={GROWSPACE_ENVIRONMENTS}
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

            <GridListField value={grids} onChange={setGrids} plants={plants} />
            <HelperText type={turnedLoose.length || gridError ? 'error' : 'info'}>
              {gridError ||
                (turnedLoose.length
                  ? `${turnedLoose.length} plant${
                      turnedLoose.length === 1 ? '' : 's'
                    } would go back to the holding tray when this is saved.`
                  : `${totalSpots(grids)} spots across ${grids.length} grid${
                      grids.length === 1 ? '' : 's'
                    }.`)}
            </HelperText>

            {/* Outdoors the main light source isn't a fixture at all, so it
                heads the lighting section — and a greenhouse can still hang
                something underneath to stretch a short winter day. */}
            {environment === 'outdoor' && (
              <>
                <Text variant="labelLarge" style={styles.label}>
                  Sunlight
                </Text>
                <FormField
                  label="Hours of direct sun"
                  keyboardType="decimal-pad"
                  right={<FormField.Affix text="h / day" />}
                  hint="How long the sun reaches this spot on a clear day."
                  {...form.field('sunHours')}
                />
              </>
            )}

            <LightAssignmentField value={lights} onChange={setLights} baseline={baseline} />

            <ErrorText>{loadError || (save.isError ? messageFor(save.error) : '')}</ErrorText>
          </DialogScroll>
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
