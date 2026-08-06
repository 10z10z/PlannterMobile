import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal } from 'react-native-paper';
import FormField from '../../components/FormField';
import { messageFor } from '../../lib/errors';
import { useSaveInventoryItem } from '../../hooks/useInventory';
import useForm from '../../hooks/useForm';
import { gridSizeCheck, traySchema } from '../../lib/schemas';
import { parseWhole } from '../../lib/numbers';
import ImagePickerField from '../../components/ImagePickerField';
import ErrorText from '../../components/ErrorText';

/**
 * One record is a group of identical trays, as with containers. The grid is what
 * gives a tray its capacity, so rows and columns are the only figures required
 * besides the name.
 */
export default function TrayFormDialog({ visible, onDismiss, onSaved, tray }) {
  const isEditing = !!tray;
  const save = useSaveInventoryItem('trays', { onSuccess: onSaved });
  const resetSave = save.reset;

  const form = useForm(traySchema, { checks: [gridSizeCheck()] });
  const resetForm = form.reset;

  useEffect(() => {
    if (!visible) return;
    resetSave();
    resetForm(
      tray
        ? {
            name: tray.name,
            image_url: tray.image_url,
            grid_rows: String(tray.grid_rows),
            grid_cols: String(tray.grid_cols),
            cell_volume_ml: tray.cell_volume_ml === null ? '' : String(tray.cell_volume_ml),
            quantity: String(tray.quantity),
          }
        : {
            name: '',
            image_url: null,
            grid_rows: '',
            grid_cols: '',
            cell_volume_ml: '',
            quantity: '1',
          }
    );
  }, [visible, tray, resetSave, resetForm]);

  const rowCount = parseWhole(form.values.grid_rows);
  const colCount = parseWhole(form.values.grid_cols);
  const cells = rowCount > 0 && colCount > 0 ? rowCount * colCount : null;

  const handleSave = () => {
    form.submit((values) => save.mutate({ id: tray?.id, values }));
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEditing ? 'Edit Trays' : 'New Trays'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <ImagePickerField
              value={form.values.image_url}
              onChange={(url) => form.set('image_url', url)}
              entity="trays"
            />

            <FormField label="Name" {...form.field('name')} />

            <View style={styles.row}>
              <FormField
                label="Rows"
                keyboardType="number-pad"
                style={styles.half}
                {...form.field('grid_rows')}
              />
              <FormField
                label="Columns"
                keyboardType="number-pad"
                style={styles.half}
                {...form.field('grid_cols')}
              />
            </View>
            <HelperText type="info">
              {cells ? `${cells} cells per tray.` : 'Rows x columns gives the number of cells.'}
            </HelperText>

            <FormField
              label="Cell volume (ml, optional)"
              keyboardType="decimal-pad"
              {...form.field('cell_volume_ml')}
            />
            <FormField
              label="Quantity"
              keyboardType="number-pad"
              hint="One entry covers a whole set of identical trays."
              {...form.field('quantity')}
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
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
});
