import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { scheduleWateringReminder } from '../../lib/notifications';
import PlantCard from '../../components/PlantCard';

export default function GrowspaceTabScreen({ route }) {
  const { growspaceId } = route.params;
  const navigation = useNavigation();
  const { session } = useAuth();
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [intervalDays, setIntervalDays] = useState('7');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPlants = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('growspace_id', growspaceId)
      .order('created_at', { ascending: false });
    if (!error) setPlants(data);
    setLoading(false);
  }, [growspaceId]);

  useFocusEffect(
    useCallback(() => {
      fetchPlants();
    }, [fetchPlants])
  );

  const openDialog = () => {
    setName('');
    setSpecies('');
    setIntervalDays('7');
    setError('');
    setDialogVisible(true);
  };

  const handleCreate = async () => {
    const interval = parseInt(intervalDays, 10);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!interval || interval < 1) {
      setError('Watering interval must be a positive number of days');
      return;
    }
    setSaving(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('plants')
      .insert({
        name: name.trim(),
        species: species.trim() || null,
        watering_interval_days: interval,
        last_watered_at: nowIso,
        user_id: session.user.id,
        growspace_id: growspaceId,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await scheduleWateringReminder(data);
    setDialogVisible(false);
    fetchPlants();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={plants}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchPlants}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>
              No plants here yet. Tap + to add one.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <PlantCard
            plant={item}
            onPress={() =>
              navigation.navigate('PlantDetail', {
                plantId: item.id,
                plantName: item.name,
              })
            }
          />
        )}
      />

      <FAB icon="plus" style={styles.fab} onPress={openDialog} />

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>New Plant</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
            <TextInput
              label="Species (optional)"
              value={species}
              onChangeText={setSpecies}
              style={styles.input}
            />
            <TextInput
              label="Watering interval (days)"
              value={intervalDays}
              onChangeText={setIntervalDays}
              keyboardType="number-pad"
              style={styles.input}
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleCreate} loading={saving} disabled={saving}>
              Create
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
  input: {
    marginBottom: 8,
  },
  errorText: {
    color: 'red',
  },
});
