import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Portal, Switch, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import { useUnits } from '../../contexts/UnitsContext';
import useForm from '../../hooks/useForm';
import { mediumSchema, phRangeCheck } from '../../lib/schemas';
import { formatVolume, volumeUnit } from '../../lib/units';
import ImagePickerField from '../../components/ImagePickerField';
import NutrientInputs, { NUTRIENT_KEYS } from '../../components/NutrientInputs';
import ErrorText from '../../components/ErrorText';

const PRESETS = [
  'Coco coir',
  'Coco brick',
  'Perlite',
  'Vermiculite',
  'Vermicompost',
  'Clay pebbles',
  'Peat moss',
];

// Nutrients plus the substrate-only fields the same inputs render for mediums.
const EXTRA_KEYS = ['ec', 'ph_min', 'ph_max'];
const ALL_KEYS = [...NUTRIENT_KEYS, ...EXTRA_KEYS];

function emptySpecs() {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, '']));
}

function specsFrom(record) {
  return Object.fromEntries(
    ALL_KEYS.map((key) => [key, record[key] === null ? '' : String(record[key])])
  );
}

export default function MediumFormDialog({ visible, onDismiss, onSaved, medium }) {
  const { system } = useUnits();
  const isEditing = !!medium;
  const save = useSaveInventoryItem('mediums', { onSuccess: onSaved });
  const resetSave = save.reset;

  const form = useForm(mediumSchema(system, NUTRIENT_KEYS), { checks: [phRangeCheck] });
  const resetForm = form.reset;

  useEffect(() => {
    if (!visible) return;
    resetSave();
    resetForm(
      medium
        ? {
            name: medium.name,
            image_url: medium.image_url,
            quantity: String(medium.quantity),
            volume_liters: formatVolume(medium.volume_liters, system, { withUnit: false }),
            low_stock: medium.low_stock,
            ...specsFrom(medium),
          }
        : {
            name: '',
            image_url: null,
            quantity: '1',
            volume_liters: '',
            low_stock: false,
            ...emptySpecs(),
          }
    );
  }, [visible, medium, system, resetSave, resetForm]);

  const handleSave = () => {
    form.submit((values) => save.mutate({ id: medium?.id, values }));
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Medium' : 'New Medium'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField
              value={form.values.image_url}
              onChange={(url) => form.set('image_url', url)}
              entity="growing_mediums"
            />

            <FormField label="Name" {...form.field('name')} />
            <View style={styles.chips}>
              {PRESETS.map((preset) => (
                <Chip key={preset} compact onPress={() => form.set('name', preset)}>
                  {preset}
                </Chip>
              ))}
            </View>

            <View style={styles.row}>
              <FormField
                label="How many"
                keyboardType="number-pad"
                dense
                style={styles.rowField}
                {...form.field('quantity')}
              />
              <FormField
                label={`Volume each (${volumeUnit(system)})`}
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
                {...form.field('volume_liters')}
              />
            </View>

            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Running low</Text>
              <Switch
                value={Boolean(form.values.low_stock)}
                onValueChange={(value) => form.set('low_stock', value)}
              />
            </View>

            <Text variant="labelLarge" style={styles.optionalLabel}>
              Optional — for pre-charged soils
            </Text>
            <NutrientInputs field={form.field} values={form.values} showPh showEc />

            <ErrorText>{save.isError ? messageFor(save.error) : ''}</ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            loading={save.isPending}
            disabled={save.isPending || !form.canSubmit}
          >
            Save
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowField: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  optionalLabel: {
    marginTop: 16,
    opacity: 0.7,
  },
});
