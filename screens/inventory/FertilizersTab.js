import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import FertilizerCard from '../../components/FertilizerCard';
import FertilizerFormDialog from './FertilizerFormDialog';

export default function FertilizersTab() {
  const [fertilizers, setFertilizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchFertilizers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fertilizers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setFertilizers(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFertilizers();
    }, [fetchFertilizers])
  );

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = (fertilizer) => {
    setEditing(fertilizer);
    setFormVisible(true);
  };

  const handleSaved = () => {
    setFormVisible(false);
    fetchFertilizers();
  };

  const handleDelete = async () => {
    const id = pendingDelete.id;
    setPendingDelete(null);
    await supabase.from('fertilizers').delete().eq('id', id);
    fetchFertilizers();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={fertilizers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchFertilizers}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && <Text style={styles.emptyText}>No fertilizers yet. Tap + to add one.</Text>
        }
        renderItem={({ item }) => (
          <FertilizerCard
            fertilizer={item}
            onPress={() => openEdit(item)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={openCreate} />

      <FertilizerFormDialog
        visible={formVisible}
        onDismiss={() => setFormVisible(false)}
        onSaved={handleSaved}
        fertilizer={editing}
      />

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete fertilizer</Dialog.Title>
          <Dialog.Content>
            <Text>Remove “{pendingDelete?.name}” from your inventory?</Text>
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
