import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, List, Portal, RadioButton, Text } from 'react-native-paper';
import { environmentLabel, moveSowing, otherStations } from '../../lib/germination';
import { messageFor } from '../../lib/errors';
import { useStations } from '../../hooks/useStations';
import { useDataMutation } from '../../hooks/useDataMutation';
import ErrorText from '../../components/ErrorText';

/**
 * Moves a whole sowing to another germination station — a tray carried to a
 * warmer shelf, or out of one that's being packed away. What's growing in it
 * comes along untouched.
 */
export default function MoveSowingDialog({ visible, sowing, stationId, onDismiss, onDone }) {
  const stationQuery = useStations();
  const stations = otherStations(stationQuery.data ?? [], stationId);
  const loading = stationQuery.isPending;

  const [targetId, setTargetId] = useState(null);
  // Only what this dialog checks itself; the server's objections arrive on the
  // mutation, and both are shown in the same place.
  const [validationError, setValidationError] = useState('');

  const move = useDataMutation({
    mutationFn: ({ sowingId, toStationId }) => moveSowing(sowingId, toStationId),
    // Both stations change: the sowing leaves one and arrives in the other.
    affects: 'sowingChanged',
    onSuccess: onDone,
  });
  const resetMove = move.reset;

  useEffect(() => {
    if (!visible) return;
    setTargetId(null);
    setValidationError('');
    resetMove();
  }, [visible, stationId, resetMove]);

  const handleMove = () => {
    if (!targetId) {
      setValidationError('Pick a station to move to');
      return;
    }
    setValidationError('');
    move.mutate({ sowingId: sowing.id, toStationId: targetId });
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
            <ErrorText style={styles.errorText}>
              {validationError ||
                (move.isError ? messageFor(move.error) : '') ||
                (stationQuery.isError ? messageFor(stationQuery.error) : '')}
            </ErrorText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={handleMove}
            loading={move.isPending}
            disabled={move.isPending || !targetId}
          >
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
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
