import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import MediumCard from '../../components/MediumCard';
import MediumFormDialog from './MediumFormDialog';

export default function MediumsTab() {
  const [mediums, setMediums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchMediums = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('growing_mediums')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setMediums(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMediums();
    }, [fetchMediums])
  );

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = (medium) => {
    setEditing(medium);
    setFormVisible(true);
  };

  const handleSaved = () => {
    setFormVisible(false);
    fetchMediums();
  };

  const handleDelete = async () => {
    const id = pendingDelete.id;
    setPendingDelete(null);
    await supabase.from('growing_mediums').delete().eq('id', id);
    fetchMediums();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={mediums}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchMediums}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && <Text style={styles.emptyText}>No growing mediums yet. Tap + to add one.</Text>
        }
        renderItem={({ item }) => (
          <MediumCard
            medium={item}
            onPress={() => openEdit(item)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={openCreate} />

      <MediumFormDialog
        visible={formVisible}
        onDismiss={() => setFormVisible(false)}
        onSaved={handleSaved}
        medium={editing}
      />

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete medium</Dialog.Title>
          <Dialog.Content>
            <Text>Remove "{pendingDelete?.name}" from your inventory?</Text>
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
