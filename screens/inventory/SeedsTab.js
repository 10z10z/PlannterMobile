import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import SeedPackCard from '../../components/SeedPackCard';
import SeedPackFormDialog from './SeedPackFormDialog';

export default function SeedsTab() {
  const [seedPacks, setSeedPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchSeedPacks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('seed_packs')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setSeedPacks(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSeedPacks();
    }, [fetchSeedPacks])
  );

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = (seedPack) => {
    setEditing(seedPack);
    setFormVisible(true);
  };

  const handleSaved = () => {
    setFormVisible(false);
    fetchSeedPacks();
  };

  const handleDelete = async () => {
    const id = pendingDelete.id;
    setPendingDelete(null);
    await supabase.from('seed_packs').delete().eq('id', id);
    fetchSeedPacks();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={seedPacks}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchSeedPacks}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && <Text style={styles.emptyText}>No seed packs yet. Tap + to add one.</Text>
        }
        renderItem={({ item }) => (
          <SeedPackCard
            seedPack={item}
            onPress={() => openEdit(item)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={openCreate} />

      <SeedPackFormDialog
        visible={formVisible}
        onDismiss={() => setFormVisible(false)}
        onSaved={handleSaved}
        seedPack={editing}
      />

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete seed pack</Dialog.Title>
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
