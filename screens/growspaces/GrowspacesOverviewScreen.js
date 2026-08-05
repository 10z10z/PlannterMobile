import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, Button, Text } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import GrowspaceTabScreen from './GrowspaceTabScreen';
import GrowspaceFormDialog from './GrowspaceFormDialog';

const Tab = createMaterialTopTabNavigator();

export default function GrowspacesOverviewScreen() {
  const [growspaces, setGrowspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);

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

  const openDialog = () => setDialogVisible(true);

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="My Growspace" />
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

      <GrowspaceFormDialog
        visible={dialogVisible}
        growspace={null}
        onDismiss={() => setDialogVisible(false)}
        onSaved={() => {
          setDialogVisible(false);
          fetchGrowspaces();
        }}
      />
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
});
