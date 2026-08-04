import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import GrowspaceTabScreen from './GrowspaceTabScreen';

const Tab = createMaterialTopTabNavigator();

export default function GrowspacesOverviewScreen() {
  const { session } = useAuth();
  const [growspaces, setGrowspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchGrowspaces = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('growspaces')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setGrowspaces(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchGrowspaces();
    }, [fetchGrowspaces])
  );

  const openDialog = () => {
    setName('');
    setDescription('');
    setError('');
    setDialogVisible(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('growspaces').insert({
      name: name.trim(),
      description: description.trim() || null,
      user_id: session.user.id,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDialogVisible(false);
    fetchGrowspaces();
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Plannter" />
        <Appbar.Action icon="plus" onPress={openDialog} />
      </Appbar.Header>

      {!loading && growspaces.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No growspaces yet.
          </Text>
          <Button mode="contained" icon="plus" onPress={openDialog}>
            Create a growspace to start growing
          </Button>
        </View>
      ) : (
        !loading && (
          <Tab.Navigator>
            {growspaces.map((growspace) => (
              <Tab.Screen
                key={growspace.id}
                name={growspace.id}
                component={GrowspaceTabScreen}
                initialParams={{ growspaceId: growspace.id }}
                options={{ tabBarLabel: growspace.name }}
              />
            ))}
          </Tab.Navigator>
        )
      )}

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>New Growspace</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={name} onChangeText={setName} style={styles.input} />
            <TextInput
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    opacity: 0.7,
  },
  input: {
    marginBottom: 8,
  },
  errorText: {
    color: 'red',
  },
});
