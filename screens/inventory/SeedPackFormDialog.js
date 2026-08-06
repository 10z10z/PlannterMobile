import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import useForm from '../../hooks/useForm';
import { germinationWindowCheck, seedPackSchema } from '../../lib/schemas';
import ImagePickerField from '../../components/ImagePickerField';
import DateField from '../../components/DateField';
import ErrorText from '../../components/ErrorText';

export default function SeedPackFormDialog({ visible, onDismiss, onSaved, seedPack }) {
  const isEditing = !!seedPack;
  const save = useSaveInventoryItem('seedPacks', { onSuccess: onSaved });
  const resetSave = save.reset;

  const form = useForm(seedPackSchema, { checks: [germinationWindowCheck] });
  const resetForm = form.reset;

  useEffect(() => {
    if (!visible) return;
    resetSave();
    resetForm(
      seedPack
        ? {
            name: seedPack.name,
            image_url: seedPack.image_url,
            plant_type: seedPack.plant_type ?? '',
            germination_days_min: seedPack.germination_days_min?.toString() ?? '',
            germination_days_max: seedPack.germination_days_max?.toString() ?? '',
            packaged_on: seedPack.packaged_on ?? null,
            seed_count: seedPack.seed_count?.toString() ?? '',
          }
        : {
            name: '',
            image_url: null,
            plant_type: '',
            germination_days_min: '',
            germination_days_max: '',
            packaged_on: null,
            seed_count: '',
          }
    );
  }, [visible, seedPack, resetSave, resetForm]);

  const handleSave = () => {
    form.submit((values) => save.mutate({ id: seedPack?.id, values }));
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Seed Pack' : 'New Seed Pack'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField
              value={form.values.image_url}
              onChange={(url) => form.set('image_url', url)}
              entity="seed_packs"
            />

            <FormField label="Name" {...form.field('name')} />
            <FormField label="Plant type (optional)" {...form.field('plant_type')} />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Germination time (days)
            </Text>
            <View style={styles.row}>
              <FormField
                label="Min"
                keyboardType="number-pad"
                dense
                style={styles.rowField}
                {...form.field('germination_days_min')}
              />
              <FormField
                label="Max"
                keyboardType="number-pad"
                dense
                style={styles.rowField}
                {...form.field('germination_days_max')}
              />
            </View>

            <DateField
              label="Packaged on (optional)"
              value={form.values.packaged_on}
              onChange={(date) => form.set('packaged_on', date)}
              maximumDate={new Date()}
            />
            <FormField
              label="Seed count (optional)"
              keyboardType="number-pad"
              hint="Worth filling in for rare varieties that are counted by the seed."
              {...form.field('seed_count')}
            />

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
  sectionLabel: {
    marginTop: 4,
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
