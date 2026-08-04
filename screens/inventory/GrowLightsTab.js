import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { fetchGrowLightsWithUsage } from '../../lib/growLights';
import GrowLightCard from '../../components/GrowLightCard';
import GrowLightFormDialog from './GrowLightFormDialog';

export default function GrowLightsTab() {
  const [lights, setLights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchLights = useCallback(async () => {
    setLoading(true);
    try {
      setLights(await fetchGrowLightsWithUsage());
    } catch {
      // Leave the previous list in place; pull-to-refresh retries.
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLights();
    }, [fetchLights])
  );

  const openCreate = () => {
    setEditing(null);
    setFormVisible(true);
  };

  const openEdit = (light) => {
    setEditing(light);
    setFormVisible(true);
  };

  const handleSaved = () => {
    setFormVisible(false);
    fetchLights();
  };

  const handleDelete = async () => {
    const id = pendingDelete.id;
    setPendingDelete(null);
    await supabase.from('grow_lights').delete().eq('id', id);
    fetchLights();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={lights}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchLights}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && <Text style={styles.emptyText}>No grow lights yet. Tap + to add some.</Text>
        }
        renderItem={({ item }) => (
          <GrowLightCard
            light={item}
            inUse={item.inUse}
            onPress={() => openEdit(item)}
            onDelete={() => setPendingDelete(item)}
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={openCreate} />

      <GrowLightFormDialog
        visible={formVisible}
        onDismiss={() => setFormVisible(false)}
        onSaved={handleSaved}
        light={editing}
      />

      <Portal>
        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete grow lights</Dialog.Title>
          <Dialog.Content>
            <Text>
              Remove this set of lights? They will also be unassigned from any growspace using
              them.
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
