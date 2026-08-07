import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import FormField from '../../components/FormField';
import { setSowingGerminated } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useDataMutation } from '../../hooks/useDataMutation';
import useForm from '../../hooks/useForm';
import { cellSchema } from '../../lib/schemas';
import { parseWhole } from '../../lib/numbers';
import ErrorText from '../../components/ErrorText';

/**
 * Marks a whole sowing at once, for a tray that came up together — holding the
 * card gets here, rather than tapping through every cell.
 */
export default function BatchGerminationDialog({ visible, sowing, onDismiss, onSaved }) {
  const cells = (sowing?.grid ?? []).flat().filter((cell) => cell && cell.seeds_planted > 0);
  const maxPerCell = cells.reduce((most, cell) => Math.max(most, cell.seeds_planted), 0);

  const form = useForm(cellSchema(maxPerCell, 'Germinated per cell'));
  const resetForm = form.reset;

  const save = useDataMutation({
    mutationFn: ({ cells: rows, count, sowing: parent }) =>
      setSowingGerminated(rows, count, parent),
    affects: 'sowingChanged',
    onSuccess: onSaved,
  });

  useEffect(() => {
    if (!visible) return;
    resetForm({ germinated: '1' });
  }, [visible, resetForm]);

  if (!sowing) return null;

  // The steppers work on whatever is in the field, treating anything
  // unparseable as nothing rather than refusing to move.
  const step = (delta) => {
    const current = parseWhole(form.values.germinated);
    const from = Number.isInteger(current) ? current : 0;
    form.set('germinated', String(Math.min(Math.max(from + delta, 0), maxPerCell)));
  };

  const apply = (count) => {
    save.mutate({ cells, count, sowing });
  };

  const handleSave = () => {
    form.submit((values) => apply(values.germinated));
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Mark whole {sowing.tray_id ? 'tray' : 'container'}</Dialog.Title>
        <Dialog.Content>
          {cells.length === 0 ? (
            <Text>Every cell here has been emptied by transplanting.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <IconButton
                  icon="minus"
                  mode="outlined"
                  accessibilityLabel="One fewer germinated per cell"
                  onPress={() => step(-1)}
                />
                <FormField
                  label="Germinated per cell"
                  keyboardType="number-pad"
                  style={styles.input}
                  hint={`Applied to all ${cells.length} cell${
                    cells.length === 1 ? '' : 's'
                  }. A cell holding fewer seeds than this is filled, not overfilled.`}
                  {...form.field('germinated')}
                />
                <IconButton
                  icon="plus"
                  mode="outlined"
                  accessibilityLabel="One more germinated per cell"
                  onPress={() => step(1)}
                />
              </View>
              <View style={styles.shortcuts}>
                <Button onPress={() => apply(maxPerCell)} disabled={save.isPending}>
                  All germinated
                </Button>
                <Button onPress={() => apply(0)} disabled={save.isPending}>
                  Reset to none
                </Button>
              </View>
              <ErrorText>{save.isError ? messageFor(save.error) : ''}</ErrorText>
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={handleSave}
            loading={save.isPending}
            disabled={save.isPending || cells.length === 0 || !form.canSubmit}
          >
            Apply
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
  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
});
