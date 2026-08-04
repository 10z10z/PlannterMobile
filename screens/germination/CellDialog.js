import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { daysSince, setCellGerminated } from '../../lib/germination';

/**
 * Opened by holding a cell. The count of seedlings that have come up is edited
 * here, and this is also where a single cell's seedlings are sent on to a
 * growspace.
 */
export default function CellDialog({ visible, cell, onDismiss, onSaved, onTransplant }) {
  const [germinated, setGerminated] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !cell) return;
    setGerminated(String(cell.germinated));
    setError('');
  }, [visible, cell]);

  if (!cell) return null;

  const value = parseInt(germinated, 10);
  const valid = Number.isInteger(value) && value >= 0 && value <= cell.seeds_planted;
  const days = daysSince(cell.germinated_on);

  const step = (delta) => {
    const next = Math.min(Math.max((Number.isInteger(value) ? value : 0) + delta, 0), cell.seeds_planted);
    setGerminated(String(next));
  };

  const handleSave = async () => {
    if (!valid) {
      setError(`Enter a number between 0 and ${cell.seeds_planted}`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setCellGerminated(cell, value);
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
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
                <TextInput
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
              {!!error && <Text style={styles.errorText}>{error}</Text>}
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={onTransplant} disabled={cell.germinated < 1}>
            Transplant
          </Button>
          <Button onPress={handleSave} loading={saving} disabled={saving || cell.seeds_planted === 0}>
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
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
