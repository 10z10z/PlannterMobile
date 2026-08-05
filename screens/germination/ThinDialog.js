import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { thinSowing, thinnableCells, thinningSummary } from '../../lib/germination';
import ErrorText from '../../components/ErrorText';

/** "8 seedlings and 4 seeds", leaving out whichever side is zero. */
function describeLosses({ seedlings, seeds }) {
  const parts = [];
  if (seedlings > 0) parts.push(`${seedlings} seedling${seedlings === 1 ? '' : 's'}`);
  if (seeds > 0) parts.push(`${seeds} unsprouted seed${seeds === 1 ? '' : 's'}`);
  return parts.join(' and ');
}

/**
 * Confirms thinning a sowing down to one seedling per cell.
 *
 * Thinning cannot be undone and kills healthy seedlings, so the dialog says
 * plainly how many go and how many stay before offering the button.
 */
export default function ThinDialog({ visible, sowing, onDismiss, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cells = thinnableCells(sowing?.grid);
  const summary = thinningSummary(cells);

  const handleThin = async () => {
    setSaving(true);
    setError('');
    try {
      await thinSowing(cells, sowing);
      onDone();
    } catch (thinError) {
      setError(thinError.message);
    }
    setSaving(false);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Thin to one per cell</Dialog.Title>
        <Dialog.Content>
          {summary.cells === 0 ? (
            <Text>
              Nothing to thin — every cell that has come up is already down to a single seedling.
            </Text>
          ) : (
            <>
              <Text>
                {`Keeps the strongest seedling in each of ${summary.cells} cell${
                  summary.cells === 1 ? '' : 's'
                }, and removes ${describeLosses(summary)}.`}
              </Text>
              <Text style={styles.detail}>
                Cells that have not come up yet are left alone. This cannot be undone.
              </Text>
            </>
          )}
          <ErrorText style={styles.errorText}>{error}</ErrorText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleThin} loading={saving} disabled={saving || summary.cells === 0}>
            Thin
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  detail: {
    marginTop: 12,
    opacity: 0.7,
  },
  errorText: {
    marginTop: 12,
  },
});
