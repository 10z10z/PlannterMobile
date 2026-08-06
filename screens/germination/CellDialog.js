import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, IconButton, Portal, Text } from 'react-native-paper';
import TextField from '../../components/TextField';
import { daysSince, setCellGerminated } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useDataMutation } from '../../hooks/useDataMutation';
import ErrorText from '../../components/ErrorText';

/**
 * Opened by holding a cell. The count of seedlings that have come up is edited
 * here, and this is also where a single cell's seedlings are sent on to a
 * growspace.
 */
export default function CellDialog({ visible, sowing, cell, onDismiss, onSaved, onTransplant }) {
  const [germinated, setGerminated] = useState('0');
  // Only what this dialog checks itself; the server's objections arrive on
  // the mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const save = useDataMutation({
    mutationFn: ({ cell: target, value, sowing: parent }) =>
      setCellGerminated(target, value, parent),
    affects: 'sowingChanged',
    onSuccess: onSaved,
  });

  useEffect(() => {
    if (!visible || !cell) return;
    setGerminated(String(cell.germinated));
    setValidationError('');
  }, [visible, cell]);

  if (!cell) return null;

  const value = parseInt(germinated, 10);
  const valid = Number.isInteger(value) && value >= 0 && value <= cell.seeds_planted;
  const days = daysSince(cell.germinated_on);

  const step = (delta) => {
    const next = Math.min(
      Math.max((Number.isInteger(value) ? value : 0) + delta, 0),
      cell.seeds_planted
    );
    setGerminated(String(next));
  };

  const handleSave = () => {
    if (!valid) {
      setValidationError(`Enter a number between 0 and ${cell.seeds_planted}`);
      return;
    }
    setValidationError('');
    save.mutate({ cell, value, sowing });
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
                <IconButton icon="minus" mode="outlined" onPress={() => step(-1)} />
                <TextField
                  label="Germinated"
                  value={germinated}
                  onChangeText={setGerminated}
                  keyboardType="number-pad"
                  style={styles.input}
                />
                <IconButton icon="plus" mode="outlined" onPress={() => step(1)} />
              </View>
              <HelperText type="info">
                {`Out of ${cell.seeds_planted} seed${cell.seeds_planted === 1 ? '' : 's'} sown`}
                {days !== null ? ` · first came up ${days}d ago` : ''}
              </HelperText>
              <ErrorText>
                {validationError || (save.isError ? messageFor(save.error) : '')}
              </ErrorText>
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
            disabled={save.isPending || cell.seeds_planted === 0}
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
    alignItems: 'center',
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
  },
});
