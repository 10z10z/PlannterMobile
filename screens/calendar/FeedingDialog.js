import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  HelperText,
  Menu,
  Portal,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import TextField from '../../components/TextField';
import DateField, { toDateString } from '../../components/DateField';
import { useUnits } from '../../contexts/UnitsContext';
import { messageFor } from '../../lib/errors';
import { useInventory } from '../../hooks/useInventory';
import { usePlaces } from '../../hooks/usePlaces';
import { useGrowspacePlants } from '../../hooks/useGrowspaces';
import { useDataMutation } from '../../hooks/useDataMutation';
import {
  doseUnit,
  formatDose,
  formatVolume,
  parseDose,
  parseVolume,
  volumeUnit,
} from '../../lib/units';
import { placeIcon, placeIds } from '../../lib/places';
import { recordFeeding } from '../../lib/feedings';
import ErrorText from '../../components/ErrorText';

/**
 * Records a feed: which products at which rates, into what, on what day.
 *
 * The doses are per litre of finished mix, the same figures the NPK calculator
 * works in, which is what lets a mixture worked out there arrive here already
 * filled in. Everything stays editable — a mix is often adjusted at the tank.
 *
 * A growspace can be fed as a whole or plant by plant. A germination station is
 * always fed as a whole: what is growing in it are cells of a tray rather than
 * plants that could be picked out. Both are on the one list of places, so which
 * of the two questions gets asked follows the place that was picked.
 */
export default function FeedingDialog({ visible, preset, onDismiss, onDone }) {
  const { system } = useUnits();

  const placeQuery = usePlaces();
  const places = useMemo(() => placeQuery.data ?? [], [placeQuery.data]);

  // Alphabetical, because this is a picker rather than a list of what arrived
  // most recently — the shelf itself is ordered newest first.
  const shelf = useInventory('fertilizers');
  const fertilizers = useMemo(
    () => [...(shelf.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [shelf.data]
  );

  const [placeId, setPlaceId] = useState(null);
  const [target, setTarget] = useState('all');
  const [selectedPlantIds, setSelectedPlantIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  // Doses are held as the user reads them; the maths converts to per litre.
  const [doses, setDoses] = useState({});
  const [volumeText, setVolumeText] = useState('');
  const [note, setNote] = useState('');
  const [fedOn, setFedOn] = useState(toDateString(new Date()));

  const [openMenu, setOpenMenu] = useState(false);
  // Only what this form checks itself; anything the server objects to arrives
  // on the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const record = useDataMutation({
    mutationFn: recordFeeding,
    affects: 'feedingRecorded',
    onSuccess: onDone,
  });
  const resetRecord = record.reset;

  // The preset is read when the dialog opens rather than watched, so a caller
  // can hand one over as a plain object without it refilling the form on every
  // render — and so anything typed since survives until the dialog is closed.
  useEffect(() => {
    if (!visible) return;
    setTarget(preset?.plants?.length ? 'plants' : 'all');
    setSelectedPlantIds((preset?.plants ?? []).map((plant) => plant.id));
    setNote('');
    setFedOn(toDateString(new Date()));
    setValidationError('');
    resetRecord();
    setVolumeText(
      preset?.volumeLiters ? formatVolume(preset.volumeLiters, system, { withUnit: false }) : ''
    );
    setPlaceId(preset?.placeId ?? null);

    // A mix handed over by the calculator keeps its products and rates; the
    // rates are shown in the user's own units, which is how they were dialled
    // in there too.
    const products = preset?.products ?? [];
    setSelectedIds(products.map((product) => product.fertilizer_id).filter(Boolean));
    setDoses(
      Object.fromEntries(
        products
          .filter((product) => product.fertilizer_id)
          .map((product) => [product.fertilizer_id, formatDose(product.dose_per_liter, system)])
      )
    );
    // Opening is the trigger, not the preset changing; see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /**
   * With one place there is no choice to make, so it is made.
   *
   * Separate from the setup above because the list now arrives from the cache
   * rather than from a fetch this dialog waited on — it may already be there
   * when the dialog opens, or land a moment later.
   */
  useEffect(() => {
    if (!visible || placeId || places.length !== 1) return;
    setPlaceId(places[0].id);
  }, [visible, placeId, places]);

  const place = places.find((entry) => entry.id === placeId);

  // The plants to choose from follow the growspace — and a station has none,
  // since a tray's cells aren't plants that could be picked out.
  const plantQuery = useGrowspacePlants(place?.type === 'growspace' ? placeId : null);
  const plants = useMemo(() => plantQuery.data ?? [], [plantQuery.data]);

  // Switching space mustn't leave a selection pointing at plants standing
  // somewhere else.
  useEffect(() => {
    const ids = new Set(plants.map((plant) => plant.id));
    setSelectedPlantIds((current) => current.filter((id) => ids.has(id)));
  }, [plants]);

  const selected = selectedIds.map((id) => fertilizers.find((f) => f.id === id)).filter(Boolean);

  const toggleFertilizer = (fertilizer) => {
    const isOn = selectedIds.includes(fertilizer.id);
    setSelectedIds(
      isOn ? selectedIds.filter((id) => id !== fertilizer.id) : [...selectedIds, fertilizer.id]
    );
    if (!isOn && doses[fertilizer.id] === undefined) {
      // The label's own fertigation rate is the honest starting point.
      const labelDose =
        Number(fertilizer.fertigation_dose_min) || Number(fertilizer.foliar_dose_min);
      setDoses({
        ...doses,
        [fertilizer.id]: labelDose ? formatDose(labelDose, system) : '',
      });
    }
  };

  const togglePlant = (plantId) =>
    setSelectedPlantIds((current) =>
      current.includes(plantId) ? current.filter((id) => id !== plantId) : [...current, plantId]
    );

  const handleSave = () => {
    if (!place) {
      setValidationError('Pick a growspace or station');
      return;
    }
    if (!selected.length) {
      setValidationError('Pick at least one fertilizer');
      return;
    }

    const products = selected.map((fertilizer) => ({
      fertilizer_id: fertilizer.id,
      fertilizer_name: fertilizer.name,
      form: fertilizer.form,
      dose_per_liter: parseDose(String(doses[fertilizer.id] ?? ''), system) ?? 0,
    }));
    if (products.some((product) => !(product.dose_per_liter > 0))) {
      setValidationError('Every product in the mix needs a dose');
      return;
    }

    // A station is always fed whole, whatever was picked out before the place
    // was switched to one.
    const byPlant = target === 'plants' && place.type === 'growspace';
    const fedPlants = byPlant
      ? plants
          .filter((plant) => selectedPlantIds.includes(plant.id))
          .map((plant) => ({ plant_id: plant.id, plant_name: plant.name }))
      : [];
    if (byPlant && !fedPlants.length) {
      setValidationError('Pick the plants that were fed');
      return;
    }

    setValidationError('');
    record.mutate({
      fedOn,
      ...placeIds(place),
      volumeLiters: parseVolume(volumeText, system),
      note,
      products,
      plants: fedPlants,
      placeName: place?.name ?? null,
      system,
    });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Log a feeding</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="labelLarge" style={styles.label}>
              Fed into
            </Text>
            <Menu
              visible={openMenu}
              onDismiss={() => setOpenMenu(false)}
              anchor={
                <Button
                  mode="outlined"
                  icon={placeIcon(place?.type)}
                  onPress={() => setOpenMenu(true)}
                >
                  {place ? place.name : 'Pick a growspace or station'}
                </Button>
              }
            >
              {places.map((entry) => (
                <Menu.Item
                  key={entry.id}
                  title={entry.name}
                  leadingIcon={placeIcon(entry.type)}
                  onPress={() => {
                    setPlaceId(entry.id);
                    setOpenMenu(false);
                  }}
                />
              ))}
              {places.length === 0 && <Menu.Item title="Nothing to feed yet" disabled />}
            </Menu>

            {place?.type === 'growspace' && (
              <>
                <Text variant="labelLarge" style={styles.label}>
                  Fed
                </Text>
                <SegmentedButtons
                  value={target}
                  onValueChange={setTarget}
                  buttons={[
                    { value: 'all', label: 'Whole space' },
                    { value: 'plants', label: 'Some plants' },
                  ]}
                />
                {target === 'plants' && (
                  <View style={styles.plantList}>
                    {plants.map((plant) => (
                      <Checkbox.Item
                        key={plant.id}
                        label={plant.name}
                        status={selectedPlantIds.includes(plant.id) ? 'checked' : 'unchecked'}
                        onPress={() => togglePlant(plant.id)}
                        position="leading"
                        style={styles.plantRow}
                      />
                    ))}
                    {plants.length === 0 && (
                      <HelperText type="info">No plants in this growspace yet.</HelperText>
                    )}
                  </View>
                )}
              </>
            )}

            <Text variant="labelLarge" style={styles.label}>
              Fertilizers
            </Text>
            <View style={styles.chips}>
              {fertilizers.map((fertilizer) => {
                const isOn = selectedIds.includes(fertilizer.id);
                return (
                  <Chip
                    key={fertilizer.id}
                    compact
                    mode={isOn ? 'flat' : 'outlined'}
                    selected={isOn}
                    showSelectedCheck={false}
                    icon={isOn ? 'check' : undefined}
                    onPress={() => toggleFertilizer(fertilizer)}
                  >
                    {fertilizer.name}
                  </Chip>
                );
              })}
              {fertilizers.length === 0 && (
                <HelperText type="info">Add a fertilizer under Inventory first.</HelperText>
              )}
            </View>

            {selected.map((fertilizer) => (
              <TextField
                key={fertilizer.id}
                label={`${fertilizer.name} (${doseUnit(fertilizer.form, system)})`}
                value={String(doses[fertilizer.id] ?? '')}
                onChangeText={(text) => setDoses({ ...doses, [fertilizer.id]: text })}
                keyboardType="decimal-pad"
                dense
                style={styles.input}
              />
            ))}

            <TextField
              label={`Batch mixed (${volumeUnit(system)}, optional)`}
              value={volumeText}
              onChangeText={setVolumeText}
              keyboardType="decimal-pad"
              dense
              style={[styles.input, styles.spacedInput]}
            />

            <DateField label="Fed on" value={fedOn} onChange={setFedOn} maximumDate={new Date()} />

            <TextField
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              style={styles.input}
            />

            <ErrorText>
              {validationError || (record.isError ? messageFor(record.error) : '')}
            </ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={record.isPending} disabled={record.isPending}>
            Log feeding
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
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  plantList: {
    marginTop: 4,
  },
  plantRow: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  input: {
    marginBottom: 8,
  },
  spacedInput: {
    marginTop: 12,
  },
});
