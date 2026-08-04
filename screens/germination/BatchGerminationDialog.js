import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { setSowingGerminated } from '../../lib/germination';

/**
 * Marks a whole sowing at once, for a tray that came up together — holding the
 * card gets here, rather than tapping through every cell.
 */
export default function BatchGerminationDialog({ visible, sowing, onDismiss, onSaved }) {
  const [germinated, setGerminated] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cells = (sowing?.grid ?? []).flat().filter((cell) => cell && cell.seeds_planted > 0);
  const maxPerCell = cells.reduce((most, cell) => Math.max(most, cell.seeds_planted), 0);

  useEffect(() => {
    if (!visible) return;
    setGerminated('1');
    setError('');
  }, [visible]);

  if (!sowing) return null;

  const value = parseInt(germinated, 10);
  const valid = Number.isInteger(value) && value >= 0 && value <= maxPerCell;

  const step = (delta) => {
    const next = Math.min(Math.max((Number.isInteger(value) ? value : 0) + delta, 0), maxPerCell);
    setGerminated(String(next));
  };

  const apply = async (count) => {
    setSaving(true);
    setError('');
    try {
      await setSowingGerminated(cells, count);
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    }
    setSaving(false);
  };

  const handleSave = () => {
    if (!valid) {
      setError(`Enter a number between 0 and ${maxPerCell}`);
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
                <TextInput
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
                <Button onPress={() => apply(maxPerCell)} disabled={saving}>
                  All germinated
                </Button>
                <Button onPress={() => apply(0)} disabled={saving}>
                  Reset to none
                </Button>
              </View>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} loading={saving} disabled={saving || cells.length === 0}>
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
  errorText: {
    color: 'red',
    marginTop: 8,
  },
});
