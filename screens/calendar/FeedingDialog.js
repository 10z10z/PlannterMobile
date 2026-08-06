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
import FormField from '../../components/FormField';
import DateField, { toDateString } from '../../components/DateField';
import { useUnits } from '../../contexts/UnitsContext';
import { messageFor } from '../../lib/errors';
import { useInventory } from '../../hooks/useInventory';
import { usePlaces } from '../../hooks/usePlaces';
import { useGrowspacePlants } from '../../hooks/useGrowspaces';
import { useDataMutation } from '../../hooks/useDataMutation';
import useForm from '../../hooks/useForm';
import { doseKey, feedingPlantsCheck, feedingSchema } from '../../lib/schemas';
import { FEED_TARGETS } from '../../lib/enums';
import { doseUnit, formatDose, formatVolume, volumeUnit } from '../../lib/units';
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

  const [openMenu, setOpenMenu] = useState(false);

  const record = useDataMutation({
    mutationFn: recordFeeding,
    affects: 'feedingRecorded',
    onSuccess: onDone,
  });
  const resetRecord = record.reset;

  // Which products are in the mix decides which dose fields exist, so the schema
  // is rebuilt as the chips are tapped.
  const [selectedIds, setSelectedIds] = useState([]);
  const selected = useMemo(
    () => selectedIds.map((id) => fertilizers.find((f) => f.id === id)).filter(Boolean),
    [selectedIds, fertilizers]
  );

  const form = useForm(feedingSchema(system, selected));
  const resetForm = form.reset;

  // The preset is read when the dialog opens rather than watched, so a caller
  // can hand one over as a plain object without it refilling the form on every
  // render — and so anything typed since survives until the dialog is closed.
  useEffect(() => {
    if (!visible) return;
    resetRecord();

    // A mix handed over by the calculator keeps its products and rates; the
    // rates are shown in the user's own units, which is how they were dialled
    // in there too.
    const products = (preset?.products ?? []).filter((product) => product.fertilizer_id);
    const presetIds = products.map((product) => product.fertilizer_id);
    setSelectedIds(presetIds);

    resetForm({
      place_id: preset?.placeId ?? null,
      target: preset?.plants?.length ? 'plants' : 'all',
      fertilizer_ids: presetIds,
      plant_ids: (preset?.plants ?? []).map((plant) => plant.id),
      volume_liters: preset?.volumeLiters
        ? formatVolume(preset.volumeLiters, system, { withUnit: false })
        : '',
      note: '',
      fed_on: toDateString(new Date()),
      ...Object.fromEntries(
        products.map((product) => [
          doseKey(product.fertilizer_id),
          formatDose(product.dose_per_liter, system),
        ])
      ),
    });
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
    if (!visible || form.values.place_id || places.length !== 1) return;
    form.set('place_id', places[0].id);
  }, [visible, form, places]);

  const place = places.find((entry) => entry.id === form.values.place_id);

  // The plants to choose from follow the growspace — and a station has none,
  // since a tray's cells aren't plants that could be picked out.
  const plantQuery = useGrowspacePlants(place?.type === 'growspace' ? form.values.place_id : null);
  const plants = useMemo(() => plantQuery.data ?? [], [plantQuery.data]);

  const selectedPlantIds = useMemo(() => form.values.plant_ids ?? [], [form.values.plant_ids]);
  const target = form.values.target;

  // Switching space mustn't leave a selection pointing at plants standing
  // somewhere else.
  useEffect(() => {
    const ids = new Set(plants.map((plant) => plant.id));
    const kept = selectedPlantIds.filter((id) => ids.has(id));
    if (kept.length !== selectedPlantIds.length) form.set('plant_ids', kept);
  }, [plants, selectedPlantIds, form]);

  const toggleFertilizer = (fertilizer) => {
    const isOn = selectedIds.includes(fertilizer.id);
    const next = isOn
      ? selectedIds.filter((id) => id !== fertilizer.id)
      : [...selectedIds, fertilizer.id];
    setSelectedIds(next);
    form.set('fertilizer_ids', next);

    if (!isOn && form.values[doseKey(fertilizer.id)] === undefined) {
      // The label's own fertigation rate is the honest starting point.
      const labelDose =
        Number(fertilizer.fertigation_dose_min) || Number(fertilizer.foliar_dose_min);
      form.set(doseKey(fertilizer.id), labelDose ? formatDose(labelDose, system) : '');
    }
  };

  const togglePlant = (plantId) => {
    const next = selectedPlantIds.includes(plantId)
      ? selectedPlantIds.filter((id) => id !== plantId)
      : [...selectedPlantIds, plantId];
    form.set('plant_ids', next);
  };

  const handleSave = () => {
    form.submit(
      (values) => {
        // A station is always fed whole, whatever was picked out before the place
        // was switched to one.
        const byPlant = values.target === 'plants' && place.type === 'growspace';
        const fedPlants = byPlant
          ? plants
              .filter((plant) => values.plant_ids.includes(plant.id))
              .map((plant) => ({ plant_id: plant.id, plant_name: plant.name }))
          : [];

        record.mutate({
          fedOn: values.fed_on,
          ...placeIds(place),
          volumeLiters: values.volume_liters,
          note: values.note ?? '',
          products: selected.map((fertilizer) => ({
            fertilizer_id: fertilizer.id,
            fertilizer_name: fertilizer.name,
            form: fertilizer.form,
            dose_per_liter: values[doseKey(fertilizer.id)],
          })),
          plants: fedPlants,
          placeName: place?.name ?? null,
          system,
        });
      },
      [feedingPlantsCheck(place)]
    );
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
                    form.set('place_id', entry.id);
                    setOpenMenu(false);
                  }}
                />
              ))}
              {places.length === 0 && <Menu.Item title="Nothing to feed yet" disabled />}
            </Menu>
            {!!form.errors.place_id && <HelperText type="error">{form.errors.place_id}</HelperText>}

            {place?.type === 'growspace' && (
              <>
                <Text variant="labelLarge" style={styles.label}>
                  Fed
                </Text>
                <SegmentedButtons
                  value={target}
                  onValueChange={(value) => form.set('target', value)}
                  buttons={FEED_TARGETS}
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
                    {!!form.errors.plant_ids && (
                      <HelperText type="error">{form.errors.plant_ids}</HelperText>
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
            {!!form.errors.fertilizer_ids && (
              <HelperText type="error">{form.errors.fertilizer_ids}</HelperText>
            )}

            {selected.map((fertilizer) => (
              <FormField
                key={fertilizer.id}
                label={`${fertilizer.name} (${doseUnit(fertilizer.form, system)})`}
                keyboardType="decimal-pad"
                dense
                {...form.field(doseKey(fertilizer.id))}
              />
            ))}

            <FormField
              label={`Batch mixed (${volumeUnit(system)}, optional)`}
              keyboardType="decimal-pad"
              dense
              style={styles.spacedInput}
              {...form.field('volume_liters')}
            />

            <DateField
              label="Fed on"
              value={form.values.fed_on}
              onChange={(date) => form.set('fed_on', date)}
              maximumDate={new Date()}
            />

            <FormField label="Note (optional)" {...form.field('note')} />

            <ErrorText>{record.isError ? messageFor(record.error) : ''}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={handleSave}
            loading={record.isPending}
            disabled={record.isPending || !form.canSubmit}
          >
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
  spacedInput: {
    marginTop: 12,
  },
});
