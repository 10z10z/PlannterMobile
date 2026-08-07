import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, Text } from 'react-native-paper';
import DialogScroll from '../../components/DialogScroll';
import FormField from '../../components/FormField';
import { useUnits } from '../../contexts/UnitsContext';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import useForm from '../../hooks/useForm';
import { containerSchema } from '../../lib/schemas';
import { formatVolume, volumeUnit } from '../../lib/units';
import { CONTAINER_MATERIALS } from '../../lib/containers';
import ImagePickerField from '../../components/ImagePickerField';
import ErrorText from '../../components/ErrorText';

/**
 * One record is a group of identical containers ("6 x 11L"), so a grow's worth of
 * pots doesn't have to be entered one by one.
 */
export default function ContainerFormDialog({ visible, onDismiss, onSaved, container }) {
  const { system } = useUnits();
  const isEditing = !!container;
  const save = useSaveInventoryItem('containers', { onSuccess: onSaved });
  const resetSave = save.reset;

  const form = useForm(containerSchema(system));
  const resetForm = form.reset;

  useEffect(() => {
    if (!visible) return;
    resetSave();
    resetForm(
      container
        ? {
            material: container.material,
            image_url: container.image_url,
            volume_liters: formatVolume(container.volume_liters, system, { withUnit: false }),
            quantity: String(container.quantity),
          }
        : { material: 'plastic', image_url: null, volume_liters: '', quantity: '1' }
    );
  }, [visible, container, system, resetSave, resetForm]);

  const handleSave = () => {
    form.submit((values) => save.mutate({ id: container?.id, values }));
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Containers' : 'New Containers'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <DialogScroll>
            <ImagePickerField
              value={form.values.image_url}
              onChange={(url) => form.set('image_url', url)}
              entity="containers"
            />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Material
            </Text>
            <SegmentedButtons
              value={form.values.material}
              onValueChange={(value) => form.set('material', value)}
              buttons={CONTAINER_MATERIALS}
              style={styles.segmented}
            />

            <FormField
              label={`Volume (${volumeUnit(system)})`}
              keyboardType="decimal-pad"
              {...form.field('volume_liters')}
            />
            <FormField
              label="Quantity"
              keyboardType="number-pad"
              hint="One entry covers a whole set of identical containers."
              {...form.field('quantity')}
            />

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
  segmented: {
    marginBottom: 8,
  },
  sectionLabel: {
    marginBottom: 4,
    opacity: 0.7,
  },
});
