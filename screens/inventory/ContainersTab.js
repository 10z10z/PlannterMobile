import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { fetchContainersWithUsage } from '../../lib/containers';
import ContainerCard from '../../components/ContainerCard';
import ContainerFormDialog from './ContainerFormDialog';

export default function ContainersTab() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchContainers = useCallback(async () => {
    setLoading(true);
    try {
      setContainers(await fetchContainersWithUsage());
    } catch {
      // Leave the previous list in place; pull-to-refresh retries.
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchContainers();
    }, [fetchContainers])
  );

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = (container) => {
    setEditing(container);
    setFormVisible(true);
  };

  const handleSaved = () => {
    setFormVisible(false);
    fetchContainers();
  };

  const handleDelete = async () => {
    const id = pendingDelete.id;
    setPendingDelete(null);
    await supabase.from('containers').delete().eq('id', id);
    fetchContainers();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={containers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchContainers}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && <Text style={styles.emptyText}>No containers yet. Tap + to add some.</Text>
        }
        renderItem={({ item }) => (
          <ContainerCard
            container={item}
            inUse={item.inUse}
            onPress={() => openEdit(item)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={openCreate} />

      <ContainerFormDialog
        visible={formVisible}
        onDismiss={() => setFormVisible(false)}
        onSaved={handleSaved}
        container={editing}
      />

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete containers</Dialog.Title>
          <Dialog.Content>
            <Text>
              Remove this set of containers? Plants using them will be left without a container.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingDelete(null)}>Cancel</Button>
            <Button onPress={handleDelete}>Delete</Button>
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
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    marginHorizontal: 24,
    opacity: 0.6,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
