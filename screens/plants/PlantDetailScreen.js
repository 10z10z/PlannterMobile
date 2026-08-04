import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { cancelWateringReminder, scheduleWateringReminder } from '../../lib/notifications';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PlantDetailScreen({ route, navigation }) {
  const { plantId } = route.params;
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPlant = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('id', plantId)
      .single();
    if (!error) setPlant(data);
    setLoading(false);
  }, [plantId]);

  useFocusEffect(
    useCallback(() => {
      fetchPlant();
    }, [fetchPlant])
  );

  const openEditDialog = () => {
    setName(plant.name);
    setSpecies(plant.species || '');
    setIntervalDays(String(plant.watering_interval_days));
    setError('');
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
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
    const { data, error } = await supabase
      .from('plants')
      .update({
        name: name.trim(),
        species: species.trim() || null,
        watering_interval_days: interval,
      })
      .eq('id', plantId)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPlant(data);
    await scheduleWateringReminder(data);
    setEditVisible(false);
  };

  const handleDelete = async () => {
    await cancelWateringReminder(plantId);
    await supabase.from('plants').delete().eq('id', plantId);
    navigation.goBack();
  };

  if (loading || !plant) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">{plant.name}</Text>
      {!!plant.species && (
        <Text variant="bodyLarge" style={styles.species}>
          {plant.species}
        </Text>
      )}

      <View style={styles.infoBlock}>
        <Text variant="bodyMedium">Watering interval: every {plant.watering_interval_days} days</Text>
        <Text variant="bodyMedium">Last watered: {formatDate(plant.last_watered_at)}</Text>
      </View>

      <Button mode="outlined" onPress={openEditDialog} style={styles.actionButton}>
        Edit
      </Button>
      <Button mode="text" textColor="red" onPress={handleDelete} style={styles.actionButton}>
        Delete plant
      </Button>

      <Portal>
        <Dialog visible={editVisible} onDismiss={() => setEditVisible(false)}>
          <Dialog.Title>Edit Plant</Dialog.Title>
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
            <Button onPress={() => setEditVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveEdit} loading={saving} disabled={saving}>
              Save
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
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  species: {
    opacity: 0.7,
    marginBottom: 16,
  },
  infoBlock: {
    marginBottom: 24,
    gap: 4,
  },
  actionButton: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 8,
  },
  errorText: {
    color: 'red',
  },
});
