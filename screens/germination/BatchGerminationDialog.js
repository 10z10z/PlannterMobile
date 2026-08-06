import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, IconButton, Portal, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { setSowingGerminated } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useDataMutation } from '../../hooks/useDataMutation';
import ErrorText from '../../components/ErrorText';

/**
 * Marks a whole sowing at once, for a tray that came up together — holding the
 * card gets here, rather than tapping through every cell.
 */
export default function BatchGerminationDialog({ visible, sowing, onDismiss, onSaved }) {
  const [germinated, setGerminated] = useState('1');
  // Only what this dialog checks itself; the server's objections arrive on
  // the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const save = useDataMutation({
    mutationFn: ({ cells: rows, count, sowing: parent }) =>
      setSowingGerminated(rows, count, parent),
    affects: 'sowingChanged',
    onSuccess: onSaved,
  });

  const cells = (sowing?.grid ?? []).flat().filter((cell) => cell && cell.seeds_planted > 0);
  const maxPerCell = cells.reduce((most, cell) => Math.max(most, cell.seeds_planted), 0);

  useEffect(() => {
    if (!visible) return;
    setGerminated('1');
    setValidationError('');
  }, [visible]);

  if (!sowing) return null;

  const value = parseInt(germinated, 10);
  const valid = Number.isInteger(value) && value >= 0 && value <= maxPerCell;

  const step = (delta) => {
    const next = Math.min(Math.max((Number.isInteger(value) ? value : 0) + delta, 0), maxPerCell);
    setGerminated(String(next));
  };

  const apply = async (count) => {
    setValidationError('');
    save.mutate({ cells, count, sowing });
  };

  const handleSave = () => {
    if (!valid) {
      setValidationError(`Enter a number between 0 and ${maxPerCell}`);
      return;
    }
    apply(value);
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
                <IconButton icon="minus" mode="outlined" onPress={() => step(-1)} />
                <TextField
                  label="Germinated per cell"
                  value={germinated}
                  onChangeText={setGerminated}
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <IconButton icon="plus" mode="outlined" onPress={() => step(1)} />
              </View>
              <HelperText type="info">
                {`Applied to all ${cells.length} cell${cells.length === 1 ? '' : 's'}. A cell holding fewer seeds than this is filled, not overfilled.`}
              </HelperText>
              <View style={styles.shortcuts}>
                <Button onPress={() => apply(maxPerCell)} disabled={save.isPending}>
                  All germinated
                </Button>
                <Button onPress={() => apply(0)} disabled={save.isPending}>
                  Reset to none
                </Button>
              </View>
              <ErrorText>
                {validationError || (save.isError ? messageFor(save.error) : '')}
              </ErrorText>
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={handleSave}
            loading={save.isPending}
            disabled={save.isPending || cells.length === 0}
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
    alignItems: 'center',
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
