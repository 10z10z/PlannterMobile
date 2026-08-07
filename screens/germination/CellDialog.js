import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import { daysSince, setCellGerminated } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useDataMutation } from '../../hooks/useDataMutation';
import useForm from '../../hooks/useForm';
import { cellSchema } from '../../lib/schemas';
import { parseWhole } from '../../lib/numbers';
import ErrorText from '../../components/ErrorText';

/**
 * Opened by holding a cell. The count of seedlings that have come up is edited
 * here, and this is also where a single cell's seedlings are sent on to a
 * growspace.
 */
export default function CellDialog({ visible, sowing, cell, onDismiss, onSaved, onTransplant }) {
  const form = useForm(cellSchema(cell?.seeds_planted ?? 0));
  const resetForm = form.reset;

  const save = useDataMutation({
    mutationFn: ({ cell: target, value, sowing: parent }) =>
      setCellGerminated(target, value, parent),
    affects: 'sowingChanged',
    onSuccess: onSaved,
  });

  useEffect(() => {
    if (!visible || !cell) return;
    resetForm({ germinated: String(cell.germinated) });
  }, [visible, cell, resetForm]);

  if (!cell) return null;

  const days = daysSince(cell.germinated_on);

  // The steppers work on whatever is in the field, treating anything
  // unparseable as nothing rather than refusing to move.
  const step = (delta) => {
    const current = parseWhole(form.values.germinated);
    const from = Number.isInteger(current) ? current : 0;
    form.set('germinated', String(Math.min(Math.max(from + delta, 0), cell.seeds_planted)));
  };

  const handleSave = () => {
    form.submit((values) => save.mutate({ cell, value: values.germinated, sowing }));
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{`Cell ${cell.cell_row + 1}, ${cell.cell_col + 1}`}</Dialog.Title>
        <Dialog.Content>
          {cell.seeds_planted === 0 ? (
            <Text>This cell has been emptied — its seedlings were transplanted out.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <IconButton
                  icon="minus"
                  mode="outlined"
                  accessibilityLabel="One fewer germinated"
                  onPress={() => step(-1)}
                />
                <FormField
                  label="Germinated"
                  keyboardType="number-pad"
                  style={styles.input}
                  hint={`Out of ${cell.seeds_planted} seed${cell.seeds_planted === 1 ? '' : 's'} sown${
                    days !== null ? ` · first came up ${days}d ago` : ''
                  }`}
                  {...form.field('germinated')}
                />
                <IconButton
                  icon="plus"
                  mode="outlined"
                  accessibilityLabel="One more germinated"
                  onPress={() => step(1)}
                />
              </View>
              <ErrorText>{save.isError ? messageFor(save.error) : ''}</ErrorText>
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={onTransplant} disabled={cell.germinated < 1}>
            Transplant
          </Button>
          <Button
            onPress={handleSave}
            loading={save.isPending}
            disabled={save.isPending || cell.seeds_planted === 0 || !form.canSubmit}
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
  },
});
