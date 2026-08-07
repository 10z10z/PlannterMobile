import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Text } from 'react-native-paper';
import DialogScroll from '../../components/DialogScroll';
import FormField from '../../components/FormField';
import { useUnits } from '../../contexts/UnitsContext';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import useForm from '../../hooks/useForm';
import { doseRangeCheck, fertilizerSchema } from '../../lib/schemas';
import { FERTILIZER_FORMS, FERTILIZER_ORIGINS } from '../../lib/enums';
import { doseUnit, formatDose } from '../../lib/units';
import ImagePickerField from '../../components/ImagePickerField';
import NutrientInputs, { NUTRIENT_KEYS } from '../../components/NutrientInputs';
import ErrorText from '../../components/ErrorText';

function emptyNutrients() {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, '']));
}

function nutrientsFrom(record) {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, record[key] === null ? '' : String(record[key])])
  );
}

const CHECKS = [
  doseRangeCheck('foliar_dose_min', 'foliar_dose_max', 'foliar dose'),
  doseRangeCheck('fertigation_dose_min', 'fertigation_dose_max', 'fertigation dose'),
];

/**
 * Create/edit dialog for a fertilizer. Doses are typed in the user's preferred
 * units and converted to per-litre on save.
 */
export default function FertilizerFormDialog({ visible, onDismiss, onSaved, fertilizer }) {
  const { system } = useUnits();
  const isEditing = !!fertilizer;
  const save = useSaveInventoryItem('fertilizers', { onSuccess: onSaved });
  // Stable across renders, unlike the mutation object around it, so the reset
  // below can be a dependency without re-running the form's setup every render.
  const resetSave = save.reset;

  const form = useForm(fertilizerSchema(system, NUTRIENT_KEYS), { checks: CHECKS });
  const resetForm = form.reset;

  // Reset the form each time the dialog opens, for whichever record it opened on.
  useEffect(() => {
    if (!visible) return;
    resetSave();
    resetForm(
      fertilizer
        ? {
            name: fertilizer.name,
            image_url: fertilizer.image_url,
            form: fertilizer.form,
            origin: fertilizer.origin,
            ...nutrientsFrom(fertilizer),
            foliar_dose_min: formatDose(fertilizer.foliar_dose_min, system),
            foliar_dose_max: formatDose(fertilizer.foliar_dose_max, system),
            fertigation_dose_min: formatDose(fertilizer.fertigation_dose_min, system),
            fertigation_dose_max: formatDose(fertilizer.fertigation_dose_max, system),
          }
        : {
            name: '',
            image_url: null,
            form: 'liquid',
            origin: 'synthetic',
            ...emptyNutrients(),
            foliar_dose_min: '',
            foliar_dose_max: '',
            fertigation_dose_min: '',
            fertigation_dose_max: '',
          }
    );
  }, [visible, fertilizer, system, resetSave, resetForm]);

  const handleSave = () => {
    form.submit((values) => save.mutate({ id: fertilizer?.id, values }));
  };

  const unit = doseUnit(form.values.form, system);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Fertilizer' : 'New Fertilizer'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <DialogScroll>
            <ImagePickerField
              value={form.values.image_url}
              onChange={(url) => form.set('image_url', url)}
              entity="fertilizers"
            />

            <FormField label="Name" {...form.field('name')} />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Form
            </Text>
            <SegmentedButtons
              value={form.values.form}
              onValueChange={(value) => form.set('form', value)}
              buttons={FERTILIZER_FORMS}
            />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Type
            </Text>
            <SegmentedButtons
              value={form.values.origin}
              onValueChange={(value) => form.set('origin', value)}
              buttons={FERTILIZER_ORIGINS}
            />

            <NutrientInputs field={form.field} values={form.values} />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Foliar dose ({unit})
            </Text>
            <View style={styles.row}>
              <FormField
                label="Min"
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
                {...form.field('foliar_dose_min')}
              />
              <FormField
                label="Max"
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
                {...form.field('foliar_dose_max')}
              />
            </View>

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Fertigation dose ({unit})
            </Text>
            <View style={styles.row}>
              <FormField
                label="Min"
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
                {...form.field('fertigation_dose_min')}
              />
              <FormField
                label="Max"
                keyboardType="decimal-pad"
                dense
                style={styles.rowField}
                {...form.field('fertigation_dose_max')}
              />
            </View>

            <ErrorText>{save.isError ? messageFor(save.error) : ''}</ErrorText>
          </DialogScroll>
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
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowField: {
    flex: 1,
  },
});
