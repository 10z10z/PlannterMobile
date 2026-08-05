import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, List, Portal, RadioButton, Text } from 'react-native-paper';
import {
  environmentLabel,
  fetchStations,
  moveSowing,
  otherStations,
} from '../../lib/germination';

/**
 * Moves a whole sowing to another germination station — a tray carried to a
 * warmer shelf, or out of one that's being packed away. What's growing in it
 * comes along untouched.
 */
export default function MoveSowingDialog({ visible, sowing, stationId, onDismiss, onDone }) {
  const [stations, setStations] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTargetId(null);
    setError('');
    setLoading(true);
    fetchStations()
      .then((rows) => setStations(otherStations(rows, stationId)))
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, [visible, stationId]);

  const handleMove = async () => {
    if (!targetId) {
      setError('Pick a station to move to');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await moveSowing(sowing.id, targetId);
      onDone();
    } catch (moveError) {
      setError(moveError.message);
    }
    setSaving(false);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Move sowing</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            {loading ? (
              <Text style={styles.message}>Loading stations…</Text>
            ) : stations.length === 0 ? (
              <Text style={styles.message}>
                There is nowhere to move this to — it is in your only germination station.
              </Text>
            ) : (
              <RadioButton.Group value={targetId} onValueChange={setTargetId}>
                {stations.map((station) => (
                  <List.Item
                    key={station.id}
                    title={station.name}
                    description={environmentLabel(station.environment)}
                    onPress={() => setTargetId(station.id)}
                    left={() => <RadioButton value={station.id} />}
                  />
                ))}
              </RadioButton.Group>
            )}
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleMove} loading={saving} disabled={saving || !targetId}>
            Move
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  message: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  errorText: {
    color: 'red',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
