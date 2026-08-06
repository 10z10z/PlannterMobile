import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import FertilizerCard from '../../components/FertilizerCard';
import QueryBoundary from '../../components/QueryBoundary';
import ErrorText from '../../components/ErrorText';
import { messageFor } from '../../lib/errors';
import { useDeleteFertilizer, useFertilizers } from '../../hooks/useFertilizers';
import FertilizerFormDialog from './FertilizerFormDialog';

export default function FertilizersTab() {
  const fertilizers = useFertilizers();
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const remove = useDeleteFertilizer({ onSuccess: () => setPendingDelete(null) });

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = (fertilizer) => {
    setEditing(fertilizer);
    setFormVisible(true);
  };

  const rows = fertilizers.data ?? [];

  return (
    <View style={styles.container}>
      <QueryBoundary
        query={fertilizers}
        isEmpty={rows.length === 0}
        emptyIcon="bottle-tonic-outline"
        emptyText="No fertilizers yet. Tap + to add the first one."
        errorText="Couldn’t load your fertilizers."
      >
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          // Refetching, not first-loading: the spinner belongs to the pull, and
          // the list underneath stays put while it happens.
          refreshing={fertilizers.isRefetching}
          onRefresh={fertilizers.refetch}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <FertilizerCard
              fertilizer={item}
              onPress={() => openEdit(item)}
              onDelete={() => setPendingDelete(item)}
            />
          )}
        />
      </QueryBoundary>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openCreate}
        accessibilityLabel="Add fertilizer"
      />

      <FertilizerFormDialog
        visible={formVisible}
        onDismiss={() => setFormVisible(false)}
        onSaved={() => setFormVisible(false)}
        fertilizer={editing}
      />

      <Portal>
        <Dialog
          visible={!!pendingDelete}
          onDismiss={() => {
            remove.reset();
            setPendingDelete(null);
          }}
        >
          <Dialog.Title>Delete fertilizer</Dialog.Title>
          <Dialog.Content>
            <Text>Remove “{pendingDelete?.name}” from your inventory?</Text>
            {/* A delete that fails now says so, in the dialog that asked for it,
                rather than closing on a row that is still there. */}
            <ErrorText>{remove.isError ? messageFor(remove.error) : ''}</ErrorText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                remove.reset();
                setPendingDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onPress={() => remove.mutate(pendingDelete.id)}
              loading={remove.isPending}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 96,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
