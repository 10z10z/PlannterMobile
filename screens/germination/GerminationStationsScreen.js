import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, Button, Text } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { fetchStations } from '../../lib/germination';
import ScreenTitle from '../../components/ScreenTitle';
import StationFormDialog from './StationFormDialog';
import StationTabScreen from './StationTabScreen';

const Tab = createMaterialTopTabNavigator();

/** Stations sit in swipeable tabs, the same shape as the growspace screen. */
export default function GerminationStationsScreen({ navigation }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);

  const loadStations = useCallback(async () => {
    setLoading(true);
    try {
      setStations(await fetchStations());
    } catch {
      // Leave the previous list in place.
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStations();
    }, [loadStations])
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title={<ScreenTitle icon="sprout-outline" label="Sowing" />} />
        <Appbar.Action
          icon="calendar-month-outline"
          onPress={() => navigation.navigate('Calendar')}
        />
        <Appbar.Action icon="plus" onPress={() => setDialogVisible(true)} />
      </Appbar.Header>

      {!loading && stations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="bodyLarge" style={styles.emptyText}>
            No germination stations yet.
          </Text>
          <Button mode="contained" icon="plus" onPress={() => setDialogVisible(true)}>
            Create a station to start sowing
          </Button>
        </View>
      ) : (
        !loading && (
          // Routes are named by station id at runtime, so there is no param
          // list to give this one. id: see navigation/types.js.
          <Tab.Navigator id={undefined}>
            {stations.map((station) => (
              <Tab.Screen
                key={station.id}
                name={station.id}
                component={StationTabScreen}
                initialParams={{ stationId: station.id }}
                options={{ tabBarLabel: station.name }}
              />
            ))}
          </Tab.Navigator>
        )
      )}

      <StationFormDialog
        visible={dialogVisible}
        station={null}
        onDismiss={() => setDialogVisible(false)}
        onSaved={() => {
          setDialogVisible(false);
          loadStations();
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
